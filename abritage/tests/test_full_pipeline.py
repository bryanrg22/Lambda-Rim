"""
Full end-to-end pipeline test.
test_pipeline_with_mock_data: FREE -- uses hardcoded data, no API calls.
test_pipeline_with_live_api: COSTS ~11 credits -- uses real API.
"""
import os

import pytest
import requests

from src.devig import american_to_probability, devig_power, build_consensus, calculate_edge
from src.player_matcher import normalize_name

API_KEY = os.environ.get("ODDS_API_KEY")


class TestFullPipeline:
    """Test 8: End-to-end pipeline."""

    def test_pipeline_with_mock_data(self):
        """Run the full math pipeline with hardcoded sportsbook data.
        This test is FREE -- no API calls, no credits.
        """
        # Simulated PrizePicks prop
        pp_prop = {
            "player_name": "LeBron James",
            "stat_type": "Points",
            "line": 25.5,
        }

        # Simulated sportsbook odds
        mock_odds = [
            {"book": "fanduel", "over_odds": -145, "under_odds": 125, "line": 25.5},
            {"book": "draftkings", "over_odds": -140, "under_odds": 120, "line": 25.5},
        ]

        # Step 1: De-vig each sportsbook
        books_data = []
        for sb in mock_odds:
            fair_over, fair_under = devig_power(sb["over_odds"], sb["under_odds"])
            books_data.append({
                "book": sb["book"],
                "fair_over": fair_over,
                "fair_under": fair_under,
            })

        # Verify de-vig
        for bd in books_data:
            assert abs(bd["fair_over"] + bd["fair_under"] - 1.0) < 0.0001

        # Step 2: Build consensus
        consensus = build_consensus(books_data)
        assert 0.5 < consensus < 0.7, f"Consensus {consensus} seems wrong"

        # Step 3: Calculate edge
        edge = calculate_edge(consensus, "6-pick-flex")

        print(f"\n  Player: {pp_prop['player_name']}")
        print(f"  Prop: {pp_prop['stat_type']} Over {pp_prop['line']}")
        print(f"  Consensus: {consensus:.2%}")
        print(f"  Edge: {edge:+.2%}")

        # Mock data should produce ~+2.7% edge
        assert edge > 0.02, f"Expected +EV edge, got {edge:+.4f}"

    @pytest.mark.skipif(not API_KEY, reason="ODDS_API_KEY not set")
    def test_pipeline_with_live_api(self):
        """Run with live API data. Costs ~11 credits."""
        # Fetch events
        events_url = f"https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey={API_KEY}"
        events_resp = requests.get(events_url, timeout=10)
        assert events_resp.status_code == 200

        events = events_resp.json()
        if not events:
            pytest.skip("No NBA events -- likely off-season")

        event = events[0]
        print(f"\n  Event: {event['away_team']} @ {event['home_team']}")

        # Fetch player props
        props_url = f"https://api.the-odds-api.com/v4/sports/basketball_nba/events/{event['id']}/odds"
        params = {
            "apiKey": API_KEY,
            "regions": "us",
            "markets": "player_points",
            "oddsFormat": "american",
        }
        props_resp = requests.get(props_url, params=params, timeout=15)
        assert props_resp.status_code == 200

        data = props_resp.json()
        bookmakers = data.get("bookmakers", [])
        if not bookmakers:
            pytest.skip("No bookmakers for this event")

        # De-vig first player found across all books
        first_player = None
        books_data = []

        for book in bookmakers:
            for market in book.get("markets", []):
                if market["key"] != "player_points":
                    continue

                players = {}
                for o in market["outcomes"]:
                    name = o["description"]
                    if name not in players:
                        players[name] = {}
                    players[name][o["name"].lower()] = {
                        "price": o["price"],
                        "point": o["point"],
                    }

                for player, odds in players.items():
                    if "over" in odds and "under" in odds:
                        if first_player is None:
                            first_player = player
                        if player == first_player:
                            fair_over, fair_under = devig_power(
                                odds["over"]["price"], odds["under"]["price"]
                            )
                            books_data.append({
                                "book": book["key"],
                                "fair_over": fair_over,
                                "fair_under": fair_under,
                            })

        assert first_player is not None, "No players found"
        assert len(books_data) > 0, "No sportsbook data extracted"

        consensus = build_consensus(books_data)
        edge = calculate_edge(consensus, "6-pick-flex")

        print(f"  Player: {first_player}")
        print(f"  Books: {[b['book'] for b in books_data]}")
        print(f"  Consensus: {consensus:.2%}")
        print(f"  Edge: {edge:+.2%}")
        print(f"  Credits remaining: {props_resp.headers.get('x-requests-remaining')}")

        # Consensus should be reasonable
        assert 0.30 < consensus < 0.85, f"Consensus {consensus} seems off"
