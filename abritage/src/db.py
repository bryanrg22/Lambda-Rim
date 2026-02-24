import sqlite3


def init_db(db_path: str = "ev_results.db") -> sqlite3.Connection:
    """Initialize SQLite database with required tables.

    Args:
        db_path: Path to SQLite database file. Use ':memory:' for testing.

    Returns:
        sqlite3.Connection with row_factory set to sqlite3.Row
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS player_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prizepicks_name TEXT NOT NULL,
            odds_api_name TEXT NOT NULL,
            sport TEXT NOT NULL,
            UNIQUE(prizepicks_name, sport)
        );

        CREATE TABLE IF NOT EXISTS odds_cache (
            cache_key TEXT PRIMARY KEY,
            response_json TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ev_opportunities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            player_name TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            league TEXT NOT NULL,

            prizepicks_line REAL NOT NULL,
            sportsbook_line REAL,

            fair_prob_over REAL,
            fair_prob_under REAL,

            recommended_side TEXT,
            edge_percentage REAL,

            num_books INTEGER,
            books_used TEXT,

            found_at TEXT DEFAULT (datetime('now')),
            game_time TEXT,

            result TEXT DEFAULT 'pending',
            actual_value REAL
        );

        CREATE INDEX IF NOT EXISTS idx_ev_pending
            ON ev_opportunities(result) WHERE result = 'pending';

        CREATE INDEX IF NOT EXISTS idx_ev_date
            ON ev_opportunities(found_at);
    """)

    conn.commit()
    return conn


def save_opportunity(conn: sqlite3.Connection, opportunity: dict) -> int:
    """Insert an +EV opportunity into the database.

    Args:
        conn: sqlite3.Connection
        opportunity: Dict with keys matching ev_opportunities columns

    Returns:
        Row id of the inserted record
    """
    cursor = conn.execute(
        """INSERT INTO ev_opportunities
           (player_name, stat_type, league, prizepicks_line, sportsbook_line,
            fair_prob_over, fair_prob_under, recommended_side, edge_percentage,
            num_books, books_used, game_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            opportunity["player_name"],
            opportunity["stat_type"],
            opportunity["league"],
            opportunity["prizepicks_line"],
            opportunity.get("sportsbook_line"),
            opportunity.get("fair_prob_over"),
            opportunity.get("fair_prob_under"),
            opportunity.get("recommended_side"),
            opportunity.get("edge_percentage"),
            opportunity.get("num_books"),
            opportunity.get("books_used"),
            opportunity.get("game_time"),
        ),
    )
    conn.commit()
    return cursor.lastrowid


def get_pending_opportunities(conn: sqlite3.Connection) -> list[dict]:
    """Get all opportunities with result='pending'.

    Args:
        conn: sqlite3.Connection

    Returns:
        List of dicts representing pending opportunities
    """
    cursor = conn.execute(
        "SELECT * FROM ev_opportunities WHERE result = 'pending' ORDER BY found_at DESC"
    )
    return [dict(row) for row in cursor.fetchall()]


def update_result(conn: sqlite3.Connection, opp_id: int, result: str, actual_value: float = None) -> None:
    """Update the result of an opportunity after the game.

    Args:
        conn: sqlite3.Connection
        opp_id: Row id of the opportunity
        result: One of 'hit', 'miss', 'push', 'pending'
        actual_value: The actual stat value (optional)
    """
    conn.execute(
        "UPDATE ev_opportunities SET result = ?, actual_value = ? WHERE id = ?",
        (result, actual_value, opp_id),
    )
    conn.commit()
