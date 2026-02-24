"""
Tests for src/prizepicks_client.py -- live PrizePicks data fetch.
No API key needed. No credits consumed. But MUST run from residential IP.
"""
import pytest
import requests


class TestPrizePicksApiAccess:
    """Test 7.1: Verify PrizePicks API is reachable."""

    def test_api_returns_200(self):
        """PrizePicks projections endpoint should return 200."""
        url = "https://api.prizepicks.com/projections"
        params = {"league_id": "7", "single_stat": "true", "per_page": "10"}
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

        response = requests.get(url, params=params, headers=headers, timeout=15)

        if response.status_code == 403:
            pytest.skip(
                "PrizePicks returned 403 -- you're likely on a cloud IP. "
                "Run this test from your local machine."
            )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}"
        )

    def test_response_has_data_and_included(self):
        """Response should have 'data' and 'included' arrays (JSON:API format)."""
        url = "https://api.prizepicks.com/projections"
        params = {"league_id": "7", "single_stat": "true", "per_page": "10"}
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

        response = requests.get(url, params=params, headers=headers, timeout=15)
        if response.status_code == 403:
            pytest.skip("Blocked -- run from local machine")

        json_data = response.json()
        assert "data" in json_data, "Response missing 'data' array"
        assert "included" in json_data, "Response missing 'included' array"

        print(f"\n  Projections returned: {len(json_data['data'])}")
        print(f"  Included items: {len(json_data['included'])}")


class TestPrizePicksDataParsing:
    """Test 7.2: Verify parsed data has required fields."""

    def _fetch_sample(self):
        """Fetch a small sample of PrizePicks data."""
        url = "https://api.prizepicks.com/projections"
        params = {"league_id": "7", "single_stat": "true", "per_page": "10"}
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
        response = requests.get(url, params=params, headers=headers, timeout=15)

        if response.status_code == 403:
            pytest.skip("Blocked -- run from local machine")
        if response.status_code != 200:
            pytest.skip(f"API returned {response.status_code}")

        return response.json()

    def test_projection_has_required_attributes(self):
        """Each projection should have line_score and stat_type."""
        json_data = self._fetch_sample()
        projections = json_data.get("data", [])

        if not projections:
            pytest.skip("No NBA projections available right now")

        proj = projections[0]
        attrs = proj.get("attributes", {})

        assert "line_score" in attrs, "Projection missing 'line_score'"
        assert "stat_type" in attrs, "Projection missing 'stat_type'"
        assert "start_time" in attrs, "Projection missing 'start_time'"

        print(f"\n  Stat type: {attrs['stat_type']}")
        print(f"  Line: {attrs['line_score']}")
        print(f"  Start time: {attrs['start_time']}")

    def test_projection_links_to_player(self):
        """Each projection should reference a player via relationships."""
        json_data = self._fetch_sample()
        projections = json_data.get("data", [])

        if not projections:
            pytest.skip("No projections available")

        proj = projections[0]
        relationships = proj.get("relationships", {})
        player_ref = relationships.get("new_player", {}).get("data", {})

        assert "id" in player_ref, "Projection doesn't reference a player"
        assert player_ref["type"] == "new_player", (
            f"Expected type 'new_player', got '{player_ref.get('type')}'"
        )

        # Find this player in included
        player_id = player_ref["id"]
        included = json_data.get("included", [])
        player = next(
            (item for item in included
             if item["type"] == "new_player" and item["id"] == player_id),
            None
        )

        assert player is not None, f"Player {player_id} not found in 'included'"
        assert "display_name" in player["attributes"], "Player missing 'display_name'"

        print(f"  Player: {player['attributes']['display_name']}")
        print(f"  Team: {player['attributes'].get('team', 'N/A')}")
