import os
from pathlib import Path


def _load_env():
    """Load .env file from the abritage directory.

    Uses os.environ.setdefault so explicit env vars take precedence.
    """
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


_load_env()

# --- Sportsbook weights (sharpness ranking) ---
SPORTSBOOK_WEIGHTS = {
    "fanduel": 100,
    "pinnacle": 80,
    "draftkings": 60,
    "betmgm": 40,
    "williamhill_us": 40,
}
DEFAULT_WEIGHT = 20

# --- PrizePicks break-even thresholds ---
BREAKEVEN_THRESHOLDS = {
    "2-pick-power": 0.577,
    "3-pick-power": 0.585,
    "4-pick-flex": 0.550,
    "5-pick-flex": 0.542,
    "6-pick-flex": 0.542,
}

# --- PrizePicks stat type -> Odds API market key ---
STAT_TYPE_MAP = {
    "Points": "player_points",
    "Rebounds": "player_rebounds",
    "Assists": "player_assists",
    "3-Pt Made": "player_threes",
    "Pts+Rebs+Asts": "player_points_rebounds_assists",
    "Pts+Rebs": "player_points_rebounds",
    "Pts+Asts": "player_points_assists",
    "Steals": "player_steals",
    "Blks": "player_blocks",
    "Turnovers": "player_turnovers",
}

# Reverse lookup: odds_api_market_key -> prizepicks_label
MARKET_TO_STAT = {v: k for k, v in STAT_TYPE_MAP.items()}

# --- The-Odds-API sport keys ---
ODDS_API_SPORT_KEYS = {
    "NBA": "basketball_nba",
    "NFL": "americanfootball_nfl",
    "NHL": "icehockey_nhl",
    "MLB": "baseball_mlb",
    "CBB": "basketball_ncaab",
    "CFB": "americanfootball_ncaaf",
}

# --- PrizePicks league IDs ---
PRIZEPICKS_LEAGUE_IDS = {
    "NBA": "7",
    "NFL": "9",
    "NHL": "8",
    "MLB": "2",
    "CBB": "20",
    "CFB": "15",
}

# --- Filtering ---
EDGE_MINIMUM = 0.02
CACHE_TTL_MINUTES = 30
