"""
Tests for The-Odds-API connection.
WARNING: These tests make real API calls and consume credits.
Run sparingly. Estimated cost: ~11 credits total.
"""
import os

import pytest
import requests

API_KEY = os.environ.get("ODDS_API_KEY")

pytestmark = pytest.mark.skipif(
    not API_KEY,
    reason="ODDS_API_KEY environment variable not set"
)


class TestOddsApiConnection:
    """Test 1.1: Verify API key works."""

    def test_api_key_returns_200(self):
        """Sports list endpoint should return 200. Costs 0 credits."""
        url = f"https://api.the-odds-api.com/v4/sports?apiKey={API_KEY}"
        response = requests.get(url, timeout=10)

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}. "
            f"If 401, your API key is wrong. If 429, you're rate limited."
        )

        remaining = response.headers.get("x-requests-remaining")
        assert remaining is not None, "Missing x-requests-remaining header"
        print(f"\n  Credits remaining: {remaining}")

    def test_sports_list_contains_nba(self):
        """Verify basketball_nba is in the supported sports list."""
        url = f"https://api.the-odds-api.com/v4/sports?apiKey={API_KEY}"
        response = requests.get(url, timeout=10)
        sports = response.json()

        sport_keys = [s["key"] for s in sports]
        assert "basketball_nba" in sport_keys, (
            f"basketball_nba not found. Available: {sport_keys[:10]}"
        )


class TestFetchEvents:
    """Test 1.2: Fetch NBA events. Costs ~1 credit."""

    def test_fetch_nba_events(self):
        url = f"https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey={API_KEY}"
        response = requests.get(url, timeout=10)

        assert response.status_code == 200
        events = response.json()

        print(f"\n  Number of NBA events: {len(events)}")
        print(f"  Credits remaining: {response.headers.get('x-requests-remaining')}")

        if events:
            event = events[0]
            assert "id" in event, "Event missing 'id' field"
            assert "home_team" in event, "Event missing 'home_team' field"
            assert "away_team" in event, "Event missing 'away_team' field"
            assert "commence_time" in event, "Event missing 'commence_time' field"

            print(f"  First event: {event['away_team']} @ {event['home_team']}")
            print(f"  Event ID: {event['id']}")
        else:
            pytest.skip("No NBA events found -- likely off-season")


class TestFetchPlayerProps:
    """Test 1.3: Fetch player props for one event. Costs ~10 credits."""

    def test_fetch_player_points(self):
        # First get an event ID
        events_url = f"https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey={API_KEY}"
        events_response = requests.get(events_url, timeout=10)
        events = events_response.json()

        if not events:
            pytest.skip("No NBA events available")

        event_id = events[0]["id"]

        # Fetch player props
        props_url = f"https://api.the-odds-api.com/v4/sports/basketball_nba/events/{event_id}/odds"
        params = {
            "apiKey": API_KEY,
            "regions": "us",
            "markets": "player_points",
            "oddsFormat": "american",
        }
        response = requests.get(props_url, params=params, timeout=15)

        assert response.status_code == 200
        data = response.json()

        print(f"\n  Credits remaining: {response.headers.get('x-requests-remaining')}")

        bookmakers = data.get("bookmakers", [])
        assert len(bookmakers) > 0, "No bookmakers returned"

        book = bookmakers[0]
        assert "key" in book
        assert "markets" in book

        markets = book["markets"]
        assert len(markets) > 0, "No markets in response"

        market = markets[0]
        assert market["key"] == "player_points"

        outcomes = market["outcomes"]
        assert len(outcomes) >= 2, "Expected at least Over + Under"

        first = outcomes[0]
        assert "name" in first, "Missing 'name' (Over/Under)"
        assert "description" in first, "Missing 'description' (player name)"
        assert "price" in first, "Missing 'price' (American odds)"
        assert "point" in first, "Missing 'point' (line number)"

        print(f"  Bookmaker: {book['key']}")
        print(f"  Player: {first['description']}")
        print(f"  Line: {first['point']}, Over: {first['price']}")
