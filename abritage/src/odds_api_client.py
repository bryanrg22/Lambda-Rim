import json
from datetime import datetime, timedelta, timezone

import requests

from src.config import CACHE_TTL_MINUTES


class OddsApiClient:
    """Client for The-Odds-API with SQLite caching.

    Tracks remaining credits from response headers and caches responses
    to avoid wasting the free tier's 500 credits/month.
    """

    BASE_URL = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key: str, db_conn):
        """Initialize the Odds API client.

        Args:
            api_key: The-Odds-API key
            db_conn: sqlite3.Connection (must have odds_cache table)
        """
        self.api_key = api_key
        self.db_conn = db_conn
        self._remaining_credits = None

    @property
    def remaining_credits(self) -> int | None:
        """Credits remaining this month, updated after each API call."""
        return self._remaining_credits

    def get_events(self, sport_key: str) -> list[dict]:
        """Fetch upcoming events for a sport. Costs ~1 credit.

        Args:
            sport_key: The-Odds-API sport key (e.g., "basketball_nba")

        Returns:
            List of event dicts with id, home_team, away_team, commence_time
        """
        cache_key = f"events:{sport_key}"
        cached = self._check_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.BASE_URL}/sports/{sport_key}/events"
        params = {"apiKey": self.api_key}

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        self._update_credits(response)

        data = response.json()
        self._write_cache(cache_key, data)
        return data

    def get_player_props(self, sport_key: str, event_id: str, markets: list[str]) -> dict:
        """Fetch player prop odds for an event. Costs ~10 credits.

        Batches multiple markets in one call to save credits.

        Args:
            sport_key: The-Odds-API sport key
            event_id: Event ID from get_events()
            markets: List of market keys (e.g., ["player_points", "player_rebounds"])

        Returns:
            Response dict with bookmakers and their odds
        """
        markets_str = ",".join(markets)
        cache_key = f"props:{sport_key}:{event_id}:{markets_str}"
        cached = self._check_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.BASE_URL}/sports/{sport_key}/events/{event_id}/odds"
        params = {
            "apiKey": self.api_key,
            "regions": "us",
            "markets": markets_str,
            "oddsFormat": "american",
        }

        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        self._update_credits(response)

        data = response.json()
        self._write_cache(cache_key, data)
        return data

    def _check_cache(self, cache_key: str) -> dict | None:
        """Return cached data if it exists and hasn't expired.

        Args:
            cache_key: Unique key for this request

        Returns:
            Cached response data, or None if not cached or expired
        """
        row = self.db_conn.execute(
            "SELECT response_json, expires_at FROM odds_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()

        if row is None:
            return None

        expires_at = datetime.fromisoformat(row["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            self.db_conn.execute("DELETE FROM odds_cache WHERE cache_key = ?", (cache_key,))
            self.db_conn.commit()
            return None

        return json.loads(row["response_json"])

    def _write_cache(self, cache_key: str, data) -> None:
        """Cache a response in SQLite.

        Args:
            cache_key: Unique key for this request
            data: Response data to cache
        """
        now = datetime.now(timezone.utc)
        expires = now + timedelta(minutes=CACHE_TTL_MINUTES)

        self.db_conn.execute(
            "INSERT OR REPLACE INTO odds_cache (cache_key, response_json, fetched_at, expires_at) VALUES (?, ?, ?, ?)",
            (cache_key, json.dumps(data), now.isoformat(), expires.isoformat()),
        )
        self.db_conn.commit()

    def _update_credits(self, response: requests.Response) -> None:
        """Update remaining credits from response headers."""
        remaining = response.headers.get("x-requests-remaining")
        if remaining is not None:
            self._remaining_credits = int(remaining)
