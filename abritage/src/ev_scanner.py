import json

from src.config import (
    ODDS_API_SPORT_KEYS,
    PRIZEPICKS_LEAGUE_IDS,
    STAT_TYPE_MAP,
    MARKET_TO_STAT,
    EDGE_MINIMUM,
)
from src.prizepicks_client import fetch_prizepicks
from src.odds_api_client import OddsApiClient
from src.devig import devig_power, build_consensus, calculate_edge
from src.player_matcher import match_player, load_overrides
from src.db import save_opportunity


def scan_for_ev(league: str, conn, api_key: str, min_edge: float = EDGE_MINIMUM) -> list[dict]:
    """Run the full +EV detection pipeline for a league.

    1. Fetch PrizePicks props
    2. Fetch sportsbook odds via The-Odds-API
    3. Match players across sources
    4. De-vig and build consensus
    5. Calculate edge, filter, and save

    Args:
        league: League abbreviation (e.g., "NBA")
        conn: sqlite3.Connection (initialized with init_db)
        api_key: The-Odds-API key
        min_edge: Minimum edge to include (default 0.02 = 2%)

    Returns:
        List of +EV opportunity dicts
    """
    league_id = PRIZEPICKS_LEAGUE_IDS.get(league)
    sport_key = ODDS_API_SPORT_KEYS.get(league)
    if not league_id or not sport_key:
        print(f"Unknown league: {league}")
        return []

    # Step 1: Fetch PrizePicks projections
    print(f"Fetching PrizePicks {league} projections...")
    pp_props = fetch_prizepicks(league_id)
    print(f"Found {len(pp_props)} standard props")

    if not pp_props:
        print("No props found. Is there a game today?")
        return []

    # Figure out which markets we need from the props
    needed_markets = set()
    for prop in pp_props:
        market = STAT_TYPE_MAP.get(prop["stat_type"])
        if market:
            needed_markets.add(market)

    if not needed_markets:
        print("No mappable stat types found in PrizePicks props.")
        return []

    markets_list = sorted(needed_markets)
    print(f"Markets to fetch: {', '.join(markets_list)}")

    # Step 2: Fetch sportsbook odds
    client = OddsApiClient(api_key, conn)

    print(f"\nFetching events for {sport_key}...")
    events = client.get_events(sport_key)
    print(f"Found {len(events)} events")

    if not events:
        print("No events found.")
        return []

    # Collect all sportsbook odds per player+stat
    # Key: (player_name, market_key, line) -> list of {book, over_odds, under_odds}
    sportsbook_data = {}

    for event in events:
        event_id = event["id"]
        home = event.get("home_team", "?")
        away = event.get("away_team", "?")
        print(f"  Fetching props for {away} @ {home}...")

        try:
            props_data = client.get_player_props(sport_key, event_id, markets_list)
        except Exception as e:
            print(f"    Error: {e}")
            continue

        bookmakers = props_data.get("bookmakers", [])
        for book in bookmakers:
            book_key = book["key"]
            for market in book.get("markets", []):
                market_key = market["key"]

                # Group outcomes by player into over/under pairs
                player_odds = {}
                for outcome in market.get("outcomes", []):
                    player = outcome["description"]
                    side = outcome["name"].lower()  # "over" or "under"
                    if player not in player_odds:
                        player_odds[player] = {}
                    player_odds[player][side] = {
                        "price": outcome["price"],
                        "point": outcome["point"],
                    }

                for player, sides in player_odds.items():
                    if "over" not in sides or "under" not in sides:
                        continue
                    line = sides["over"]["point"]
                    key = (player, market_key, line)
                    if key not in sportsbook_data:
                        sportsbook_data[key] = []
                    sportsbook_data[key].append({
                        "book": book_key,
                        "over_odds": sides["over"]["price"],
                        "under_odds": sides["under"]["price"],
                        "line": line,
                    })

    if client.remaining_credits is not None:
        print(f"\nCredits remaining: {client.remaining_credits}")

    # Step 3: Match players and find edges
    print(f"\nMatching players and calculating edges...")
    overrides = load_overrides(conn)

    # Build set of all sportsbook player names per market
    api_players_by_market = {}
    for (player, market_key, line), _ in sportsbook_data.items():
        if market_key not in api_players_by_market:
            api_players_by_market[market_key] = set()
        api_players_by_market[market_key].add(player)

    opportunities = []
    matched_count = 0
    total_processed = 0

    for prop in pp_props:
        market_key = STAT_TYPE_MAP.get(prop["stat_type"])
        if not market_key:
            continue

        api_names = list(api_players_by_market.get(market_key, []))
        if not api_names:
            continue

        matched_name = match_player(prop["player_name"], api_names, overrides)
        if not matched_name:
            continue

        matched_count += 1

        # Find sportsbook entries that match this player + market + line
        key = (matched_name, market_key, prop["line"])
        sb_entries = sportsbook_data.get(key, [])

        if not sb_entries:
            continue

        total_processed += 1

        # Step 4: De-vig each sportsbook
        books_data = []
        for sb in sb_entries:
            try:
                fair_over, fair_under = devig_power(sb["over_odds"], sb["under_odds"])
                books_data.append({
                    "book": sb["book"],
                    "fair_over": fair_over,
                    "fair_under": fair_under,
                })
            except Exception:
                continue

        if not books_data:
            continue

        # Step 5: Build consensus
        consensus_over = build_consensus(books_data)
        consensus_under = 1.0 - consensus_over

        # Step 6: Calculate edge for both sides
        edge_over = calculate_edge(consensus_over)
        edge_under = calculate_edge(consensus_under)

        # Pick the better side
        if edge_over >= edge_under:
            best_side = "over"
            best_edge = edge_over
            best_prob = consensus_over
        else:
            best_side = "under"
            best_edge = edge_under
            best_prob = consensus_under

        if best_edge < min_edge:
            continue

        # Determine edge quality
        if best_edge >= 0.05:
            quality = "Excellent"
        elif best_edge >= 0.03:
            quality = "Very Good"
        elif best_edge >= 0.02:
            quality = "Good"
        elif best_edge >= 0.01:
            quality = "Marginal"
        else:
            quality = "Noise"

        opp = {
            "player_name": prop["player_name"],
            "stat_type": prop["stat_type"],
            "league": league,
            "prizepicks_line": prop["line"],
            "sportsbook_line": prop["line"],
            "fair_prob_over": consensus_over,
            "fair_prob_under": consensus_under,
            "recommended_side": best_side,
            "edge_percentage": best_edge,
            "num_books": len(books_data),
            "books_used": json.dumps([b["book"] for b in books_data]),
            "game_time": prop.get("start_time", ""),
            "quality": quality,
        }

        # Save to SQLite
        opp_id = save_opportunity(conn, opp)
        opp["id"] = opp_id
        opportunities.append(opp)

    print(f"Matched {matched_count} players, processed {total_processed} line-matched props")
    print(f"Found {len(opportunities)} opportunities with edge >= {min_edge:.1%}")

    return opportunities
