import requests


def fetch_prizepicks(league_id: str) -> list[dict]:
    """Fetch current PrizePicks projections for a league.

    Args:
        league_id: PrizePicks league ID (e.g., "7" for NBA)

    Returns:
        List of dicts with keys: player_name, stat_type, line, team, start_time, odds_type
        Only returns standard (More/Less) props -- goblin/demon are filtered out.
    """
    url = "https://api.prizepicks.com/projections"
    params = {
        "league_id": league_id,
        "single_stat": "true",
        "per_page": "250",
    }
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }

    response = requests.get(url, params=params, headers=headers, timeout=15)
    response.raise_for_status()
    json_data = response.json()

    # Build player lookup: player_id -> player_info
    players = {}
    for item in json_data.get("included", []):
        if item["type"] == "new_player":
            players[item["id"]] = {
                "name": item["attributes"]["display_name"],
                "team": item["attributes"].get("team", ""),
                "position": item["attributes"].get("position", ""),
            }

    # Extract projections (standard only)
    props = []
    for proj in json_data.get("data", []):
        attrs = proj["attributes"]
        odds_type = attrs.get("odds_type", "standard")

        # Only standard (More/Less) props can be de-vigged
        if odds_type != "standard":
            continue

        player_id = proj["relationships"]["new_player"]["data"]["id"]
        player = players.get(player_id, {})

        props.append({
            "player_name": player.get("name", "Unknown"),
            "team": player.get("team", ""),
            "stat_type": attrs["stat_type"],
            "line": float(attrs["line_score"]),
            "start_time": attrs.get("start_time", ""),
            "odds_type": odds_type,
        })

    return props
