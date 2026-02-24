import re

from rapidfuzz import fuzz


def normalize_name(name: str) -> str:
    """Normalize player name for matching.

    Lowercases, removes periods/hyphens/suffixes, collapses whitespace.
    """
    name = name.lower()
    name = name.replace(".", "")
    name = name.replace("-", " ")
    name = re.sub(r"\s+(jr|sr|ii|iii|iv)$", "", name)
    name = " ".join(name.split())
    return name


def match_player(pp_name: str, odds_api_names: list[str], overrides: dict) -> str | None:
    """Match a PrizePicks player name to an Odds API name.

    4-tier strategy: exact -> normalized -> override -> fuzzy (85% threshold).

    Args:
        pp_name: Player name from PrizePicks
        odds_api_names: List of player names from The-Odds-API
        overrides: Dict mapping pp_name -> odds_api_name

    Returns:
        Matched Odds API name, or None if no match found
    """
    # Tier 1: Exact match
    if pp_name in odds_api_names:
        return pp_name

    # Tier 2: Normalized match
    pp_norm = normalize_name(pp_name)
    for api_name in odds_api_names:
        if normalize_name(api_name) == pp_norm:
            return api_name

    # Tier 3: Override table
    if pp_name in overrides:
        override = overrides[pp_name]
        if override in odds_api_names:
            return override

    # Tier 4: Fuzzy match
    best_match = None
    best_score = 0
    for api_name in odds_api_names:
        score = fuzz.ratio(pp_norm, normalize_name(api_name))
        if score > best_score and score >= 85:
            best_score = score
            best_match = api_name

    return best_match


def load_overrides(conn) -> dict:
    """Load player name overrides from SQLite.

    Args:
        conn: sqlite3.Connection

    Returns:
        Dict mapping prizepicks_name -> odds_api_name
    """
    cursor = conn.execute("SELECT prizepicks_name, odds_api_name FROM player_overrides")
    return {row[0]: row[1] for row in cursor.fetchall()}


def save_override(conn, pp_name: str, api_name: str, sport: str) -> None:
    """Save a player name override to SQLite.

    Args:
        conn: sqlite3.Connection
        pp_name: PrizePicks player name
        api_name: Odds API player name
        sport: Sport identifier (e.g., "NBA")
    """
    conn.execute(
        "INSERT OR REPLACE INTO player_overrides (prizepicks_name, odds_api_name, sport) VALUES (?, ?, ?)",
        (pp_name, api_name, sport),
    )
    conn.commit()
