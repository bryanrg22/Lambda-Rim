# Lambda Rim: +EV Detection System — Standalone Proof of Concept

A standalone Python project that compares PrizePicks lines against sportsbook consensus to identify +EV (positive expected value) opportunities. This is isolated from the main Lambda Rim project — the goal is to prove the strategy works before any integration.

---

## Table of Contents

1. [Overview](#overview)
2. [Standalone Tech Stack](#standalone-tech-stack)
3. [Project Structure](#project-structure)
4. [System Flow](#system-flow)
5. [PrizePicks Data Fetching](#prizepicks-data-fetching)
6. [The-Odds-API Setup](#the-odds-api-setup)
7. [The Math](#the-math)
8. [Data Matching](#data-matching)
9. [Data Storage](#data-storage)
10. [Implementation Steps](#implementation-steps)
11. [Free Tier Strategy](#free-tier-strategy)
12. [Example Workflow](#example-workflow)
13. [Do NOT](#do-not)
14. [Verification & Testing](#verification--testing)

---

## Overview

### What This System Does

```
┌─────────────────┐     ┌─────────────────┐
│   PrizePicks    │     │  Sportsbooks    │
│  (fetched live) │     │ (The-Odds-API)  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    ┌─────────────┐    │
         └───►│   COMPARE   │◄───┘
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │  +EV Found? │
              │             │
              │  YES → BET  │
              │  NO → SKIP  │
              └─────────────┘
```

### The Core Idea

1. **PrizePicks** sets lines but isn't a sharp market
2. **Sportsbooks** (FanDuel, DraftKings, etc.) are sharper — real money moves their lines
3. **Compare** the two to find where PrizePicks is mispriced
4. **Bet** when sportsbooks imply higher probability than PrizePicks requires

### Why Standalone First

This is a proof of concept. Before wiring anything into the main Lambda Rim app (Flask, Firestore, frontend), we need to answer:
- Does this strategy actually find +EV opportunities?
- How often do edges appear?
- Are the edges real or just noise?
- Is the free tier of The-Odds-API enough to be useful?

Once we prove it works, then we integrate.

---

## Standalone Tech Stack

This project runs entirely on its own — no connection to the existing Lambda Rim backend, database, or frontend.

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | Python 3.9+ | Already familiar, matches main project |
| Math | `scipy` | `brentq` root-finding for power method de-vig |
| HTTP | `requests` | Fetch data from PrizePicks API and The-Odds-API |
| Fuzzy Matching | `rapidfuzz` | Player name matching across data sources |
| Storage | SQLite | Local file-based DB, zero setup, persists between runs |
| Output | Terminal / CSV | Print results to console, optionally export to CSV |
| Testing | `pytest` | Verify math and matching logic |

### Python Dependencies

Create `abritage/requirements.txt`:
```
requests>=2.28.0
scipy>=1.9.0
rapidfuzz>=3.0.0
pytest>=7.0.0
```

### Setup Commands

```bash
cd abritage
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables

Create `abritage/.env` (gitignored):
```
ODDS_API_KEY=your_api_key_here
```

Load it in Python:
```python
import os
from pathlib import Path

# Load .env file manually (no extra dependency needed)
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip()

ODDS_API_KEY = os.environ["ODDS_API_KEY"]
```

---

## Project Structure

Everything lives in `abritage/` — completely isolated from the rest of the repo.

```
abritage/
├── requirements.txt              # Python dependencies
├── .env                          # API key (gitignored)
├── .gitignore                    # Ignore .env, venv/, *.db, __pycache__/
├── Lambda_Rim_EV_System_README.md    # This file
├── Lambda_Rim_Testing_README.md      # Testing guide
│
├── src/
│   ├── __init__.py
│   ├── prizepicks_client.py      # Fetch PrizePicks projections
│   ├── odds_api_client.py        # Fetch sportsbook odds from The-Odds-API
│   ├── devig.py                  # Math: odds conversion, de-vig, consensus, edge
│   ├── player_matcher.py         # Player name normalization and matching
│   ├── ev_scanner.py             # Main pipeline: ties everything together
│   ├── db.py                     # SQLite setup and queries
│   └── config.py                 # Constants (weights, thresholds, sport keys)
│
├── tests/
│   ├── __init__.py
│   ├── test_devig.py             # Unit tests for math functions
│   ├── test_player_matcher.py    # Unit tests for name matching
│   ├── test_odds_api.py          # Integration test (costs API credits)
│   └── test_full_pipeline.py     # End-to-end test
│
├── scan.py                       # CLI entry point: `python scan.py --league NBA`
└── ev_results.db                 # SQLite database (created on first run)
```

---

## System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               RUN MANUALLY: python scan.py --league NBA         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. FETCH PRIZEPICKS PROJECTIONS (live API call)                │
│     └─► GET https://api.prizepicks.com/projections              │
│     └─► Params: league_id=7, single_stat=true, state_code=CA   │
│     └─► Output: [{player_name, stat_type, line, ...}, ...]     │
│     └─► NOTE: Must run from residential IP (PrizePicks blocks   │
│         cloud IPs). Run from your local machine.                │
│                                                                 │
│  2. FETCH SPORTSBOOK ODDS (The-Odds-API)                        │
│     └─► GET /v4/sports/basketball_nba/events (get game IDs)     │
│     └─► GET /v4/sports/.../events/{id}/odds (get player props)  │
│     └─► Batch markets in one call to save credits               │
│     └─► Cache in SQLite (reuse if < 30 min old)                 │
│                                                                 │
│  3. MATCH PLAYERS                                               │
│     └─► Link PrizePicks player names to Odds-API player names   │
│     └─► Strategy: exact → normalized → override → fuzzy         │
│                                                                 │
│  4. DE-VIG SPORTSBOOK ODDS                                      │
│     └─► Power method: find k where IP_over^k + IP_under^k = 1  │
│     └─► Extract fair probabilities for each sportsbook          │
│                                                                 │
│  5. BUILD CONSENSUS                                             │
│     └─► Weighted average across sportsbooks                     │
│     └─► FanDuel=100, Pinnacle=80, DraftKings=60, etc.           │
│                                                                 │
│  6. CALCULATE EDGE                                              │
│     └─► Edge = Fair_Probability - Break_Even_Threshold          │
│     └─► Filter to edge > 2%                                    │
│                                                                 │
│  7. OUTPUT RESULTS                                              │
│     └─► Print +EV opportunities to terminal                     │
│     └─► Store in SQLite for tracking over time                  │
│     └─► Optionally export to CSV                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PrizePicks Data Fetching

### How PrizePicks API Works

PrizePicks has a public API that returns current projections. No API key needed.

**Important:** PrizePicks blocks requests from cloud provider IPs (AWS, GCP, etc.). This script must run from your **local machine** (residential IP).

### Endpoint

```
GET https://api.prizepicks.com/projections
```

### Parameters

```python
PRIZEPICKS_LEAGUE_IDS = {
    "NBA": "7",
    "NFL": "9",
    "NHL": "8",
    "MLB": "2",
    "CBB": "20",
    "CFB": "15",
}

params = {
    "league_id": "7",          # NBA
    "single_stat": "true",     # Individual stat props only
    "per_page": "250",         # Max results per page
}
```

### Response Structure

The PrizePicks API returns JSON:API format with `data` and `included` arrays.

```python
response = requests.get("https://api.prizepicks.com/projections", params=params)
json_data = response.json()

# json_data["data"] = list of projection objects
# json_data["included"] = list of related objects (players, leagues, etc.)
```

**Each projection in `data`:**
```json
{
  "id": "12345",
  "type": "projection",
  "attributes": {
    "line_score": 25.5,
    "stat_type": "Points",
    "odds_type": "standard",
    "projection_type": "Single Stat",
    "start_time": "2025-01-15T00:10:00Z",
    "status": "pre_game"
  },
  "relationships": {
    "new_player": {
      "data": { "id": "67890", "type": "new_player" }
    }
  }
}
```

**Each player in `included`:**
```json
{
  "id": "67890",
  "type": "new_player",
  "attributes": {
    "display_name": "LeBron James",
    "team": "LAL",
    "position": "SF",
    "league": "NBA"
  }
}
```

### Parsing PrizePicks Data

```python
def fetch_prizepicks(league_id: str) -> list[dict]:
    """Fetch current PrizePicks projections for a league.

    Args:
        league_id: PrizePicks league ID (e.g., "7" for NBA)

    Returns:
        List of dicts with keys: player_name, stat_type, line, team, start_time
    """
    url = "https://api.prizepicks.com/projections"
    params = {
        "league_id": league_id,
        "single_stat": "true",
        "per_page": "250",
    }

    response = requests.get(url, params=params, timeout=15)
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

    # Extract projections
    props = []
    for proj in json_data.get("data", []):
        attrs = proj["attributes"]
        player_id = proj["relationships"]["new_player"]["data"]["id"]
        player = players.get(player_id, {})

        props.append({
            "player_name": player.get("name", "Unknown"),
            "team": player.get("team", ""),
            "stat_type": attrs["stat_type"],
            "line": float(attrs["line_score"]),
            "start_time": attrs.get("start_time", ""),
            "odds_type": attrs.get("odds_type", "standard"),
        })

    return props
```

---

## The-Odds-API Setup

### Get Your API Key

1. Go to: https://the-odds-api.com
2. Sign up for free tier
3. Copy your API key
4. Add to `abritage/.env` as `ODDS_API_KEY=your_key`

**The-Odds-API docs:** https://the-odds-api.com/lp/v4/

### Free Tier Limits

| Limit | Amount |
|-------|--------|
| Credits per month | 500 |
| Cost per request | ~1-10 credits depending on endpoint |

**This means:** ~50-100 API calls per month. Use wisely.

### Endpoints You Need

#### 1. List Events (Get Game IDs) — costs 1 credit

```
GET https://api.the-odds-api.com/v4/sports/{sport}/events
    ?apiKey=YOUR_KEY
```

**Sports keys:**
```python
ODDS_API_SPORT_KEYS = {
    "NBA": "basketball_nba",
    "NFL": "americanfootball_nfl",
    "NHL": "icehockey_nhl",
    "MLB": "baseball_mlb",
    "CBB": "basketball_ncaab",
    "CFB": "americanfootball_ncaaf",
}
```

**Response:**
```json
[
  {
    "id": "e912304a8f2f9c04ef82830e0c987654",
    "sport_key": "basketball_nba",
    "commence_time": "2025-01-15T00:10:00Z",
    "home_team": "Los Angeles Lakers",
    "away_team": "Boston Celtics"
  }
]
```

**Response headers to track:**
```
x-requests-remaining: 489
x-requests-used: 11
```

#### 2. Get Player Props for an Event — costs ~10 credits

```
GET https://api.the-odds-api.com/v4/sports/{sport}/events/{eventId}/odds
    ?apiKey=YOUR_KEY
    &regions=us
    &markets=player_points,player_rebounds,player_assists,player_threes
    &oddsFormat=american
```

**Batch multiple markets in one call — same credit cost as one market.**

**Response structure:**
```json
{
  "id": "e912304a8f2f9c04ef82830e0c987654",
  "bookmakers": [
    {
      "key": "fanduel",
      "title": "FanDuel",
      "last_update": "2025-01-15T19:30:00Z",
      "markets": [
        {
          "key": "player_points",
          "outcomes": [
            {
              "name": "Over",
              "description": "LeBron James",
              "price": -145,
              "point": 25.5
            },
            {
              "name": "Under",
              "description": "LeBron James",
              "price": 125,
              "point": 25.5
            }
          ]
        }
      ]
    }
  ]
}
```

### Available Markets (Player Props)

**NBA:**
| Market Key | Stat Type | PrizePicks Label |
|------------|-----------|-----------------|
| `player_points` | Points | `Points` |
| `player_rebounds` | Rebounds | `Rebounds` |
| `player_assists` | Assists | `Assists` |
| `player_threes` | 3-Pointers Made | `3-Pt Made` |
| `player_points_rebounds_assists` | Pts+Rebs+Asts | `Pts+Rebs+Asts` |
| `player_points_rebounds` | Pts+Rebs | `Pts+Rebs` |
| `player_points_assists` | Pts+Asts | `Pts+Asts` |
| `player_steals` | Steals | `Steals` |
| `player_blocks` | Blocks | `Blks` |
| `player_turnovers` | Turnovers | `Turnovers` |

**NFL:**
| Market Key | Stat Type | PrizePicks Label |
|------------|-----------|-----------------|
| `player_pass_yds` | Passing Yards | `Pass Yards` |
| `player_pass_tds` | Passing TDs | `Pass TDs` |
| `player_rush_yds` | Rushing Yards | `Rush Yards` |
| `player_receptions` | Receptions | `Receptions` |
| `player_reception_yds` | Receiving Yards | `Rec Yards` |

### Available Sportsbooks (US Region)

| Sportsbook | API Key | Sharpness | Weight |
|------------|---------|-----------|--------|
| FanDuel | `fanduel` | Best for props | 100 |
| Pinnacle | `pinnacle` | Sharpest overall (if available) | 80 |
| DraftKings | `draftkings` | Strong | 60 |
| BetMGM | `betmgm` | Average | 40 |
| Caesars | `williamhill_us` | Average | 40 |

---

## The Math

### Step 1: Convert American Odds to Implied Probability

```python
def american_to_probability(odds: int) -> float:
    """Convert American odds to implied probability.

    Args:
        odds: American odds integer (e.g., -145, +125)

    Returns:
        Implied probability as float between 0 and 1
    """
    if odds < 0:
        return abs(odds) / (abs(odds) + 100)
    else:
        return 100 / (odds + 100)
```

**Negative odds (favorite):**
```
Example: -145
IP = 145 / (145 + 100) = 145 / 245 = 59.18%
```

**Positive odds (underdog):**
```
Example: +125
IP = 100 / (125 + 100) = 100 / 225 = 44.44%
```

### Step 2: Notice the Vig

```
Over:  59.18%
Under: 44.44%
─────────────
Total: 103.62%  ← Should be 100%, extra 3.62% is the vig (sportsbook margin)
```

### Step 3: De-Vig Using Power Method

Find exponent `k` such that:
```
IP_over^k + IP_under^k = 1
```

Then fair probabilities are:
```
Fair_over = IP_over^k
Fair_under = IP_under^k
```

```python
from scipy.optimize import brentq

def devig_power(over_odds: int, under_odds: int) -> tuple[float, float]:
    """Remove vig using the power method.

    Args:
        over_odds: American odds for the over (e.g., -145)
        under_odds: American odds for the under (e.g., +125)

    Returns:
        Tuple of (fair_over_probability, fair_under_probability)
        Both sum to 1.0
    """
    ip_over = american_to_probability(over_odds)
    ip_under = american_to_probability(under_odds)

    def objective(k):
        return ip_over**k + ip_under**k - 1.0

    k = brentq(objective, 0.5, 2.0)
    return ip_over**k, ip_under**k
```

**Example:**
```
IP_over = 0.5918, IP_under = 0.4444
Solve: 0.5918^k + 0.4444^k = 1 → k ≈ 1.052
Fair_over = 0.5918^1.052 = 57.24%
Fair_under = 0.4444^1.052 = 42.76%
Check: 57.24% + 42.76% = 100%
```

### Step 4: Build Consensus from Multiple Books

Weight sportsbooks by sharpness:

```python
SPORTSBOOK_WEIGHTS = {
    "fanduel": 100,
    "pinnacle": 80,
    "draftkings": 60,
    "betmgm": 40,
    "williamhill_us": 40,
}
DEFAULT_WEIGHT = 20

def build_consensus(books_data: list[dict]) -> float:
    """Build weighted consensus probability from multiple sportsbooks.

    Args:
        books_data: List of dicts with keys 'book' (str) and 'fair_over' (float)

    Returns:
        Weighted average fair over probability
    """
    total_weight = 0
    weighted_sum = 0

    for book in books_data:
        w = SPORTSBOOK_WEIGHTS.get(book["book"], DEFAULT_WEIGHT)
        weighted_sum += w * book["fair_over"]
        total_weight += w

    return weighted_sum / total_weight
```

**Example:**
```
FanDuel (100):   57.2%
DraftKings (60): 56.8%
BetMGM (40):     57.5%

Consensus = (100*57.2 + 60*56.8 + 40*57.5) / (100+60+40) = 57.14%
```

### Step 5: Calculate Edge

```python
BREAKEVEN_THRESHOLDS = {
    "2-pick-power": 0.577,
    "3-pick-power": 0.585,
    "4-pick-flex": 0.550,
    "5-pick-flex": 0.542,
    "6-pick-flex": 0.542,
}

def calculate_edge(fair_prob: float, entry_type: str = "6-pick-flex") -> float:
    """Calculate edge as fair_prob minus break-even threshold.

    Args:
        fair_prob: Consensus fair probability (float, 0-1)
        entry_type: PrizePicks entry type string

    Returns:
        Edge as float (e.g., 0.0294 means +2.94%)
    """
    return fair_prob - BREAKEVEN_THRESHOLDS[entry_type]
```

**PrizePicks Break-Even Thresholds:**

| Entry Type | Break-Even | Recommended? |
|------------|------------|--------------|
| 2-pick Power | 57.7% | Hard to beat |
| 3-pick Power | 58.5% | Avoid |
| 4-pick Flex | 55.0% | Okay |
| 5-pick Flex | 54.2% | Best |
| 6-pick Flex | 54.2% | Best |

### Edge Quality Guide

| Edge | Quality | Action |
|------|---------|--------|
| < 1% | Noise | Skip |
| 1-2% | Marginal | Proceed with caution |
| 2-3% | Good | Include in entries |
| 3-5% | Very Good | Prioritize |
| 5%+ | Excellent | Verify data is fresh, then bet |

---

## Data Matching

### The Problem

PrizePicks says: `"LeBron James"`
The-Odds-API says: `"LeBron James"`
→ Easy match

But sometimes:
- PrizePicks: `"Shai Gilgeous-Alexander"`
- The-Odds-API: `"Shai Gilgeous Alexander"` (no hyphen)

### Matching Strategy (4 tiers)

```
1. EXACT MATCH
   └─ If names identical → done

2. NORMALIZE & MATCH
   └─ Lowercase
   └─ Remove periods ("P.J." → "PJ")
   └─ Remove hyphens ("Gilgeous-Alexander" → "Gilgeous Alexander")
   └─ Remove suffixes ("Jr.", "Sr.", "III", "II")
   └─ Try exact match again

3. OVERRIDE TABLE (SQLite table)
   └─ Manual mappings for known mismatches
   └─ Build this over time as mismatches are found

4. FUZZY MATCH (last resort)
   └─ Use rapidfuzz library
   └─ 85% similarity threshold
   └─ Log fuzzy matches for manual review
   └─ Add confirmed matches to override table
```

```python
import re
from rapidfuzz import fuzz

def normalize_name(name: str) -> str:
    """Normalize player name for matching."""
    name = name.lower()
    name = name.replace(".", "")
    name = name.replace("-", " ")
    name = re.sub(r"\s+(jr|sr|ii|iii|iv)$", "", name)
    name = " ".join(name.split())
    return name

def match_player(pp_name: str, odds_api_names: list[str], overrides: dict) -> str | None:
    """Match a PrizePicks player name to an Odds API name.

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
```

### Stat Type Mapping

Map between The-Odds-API market keys and PrizePicks labels:

```python
STAT_TYPE_MAP = {
    # prizepicks_label: odds_api_market_key
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
```

---

## Data Storage

### SQLite Schema

SQLite requires zero setup — just a local file. It persists between runs so you can track results over time.

**File:** `abritage/ev_results.db` (created automatically on first run)

```python
import sqlite3

def init_db(db_path: str = "ev_results.db") -> sqlite3.Connection:
    """Initialize SQLite database with required tables."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.executescript("""
        -- Store player name overrides for matching
        CREATE TABLE IF NOT EXISTS player_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prizepicks_name TEXT NOT NULL,
            odds_api_name TEXT NOT NULL,
            sport TEXT NOT NULL,
            UNIQUE(prizepicks_name, sport)
        );

        -- Cache Odds API responses to avoid wasting credits
        CREATE TABLE IF NOT EXISTS odds_cache (
            cache_key TEXT PRIMARY KEY,
            response_json TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        -- Store +EV opportunities found
        CREATE TABLE IF NOT EXISTS ev_opportunities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            -- Player & prop info
            player_name TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            league TEXT NOT NULL,

            -- Lines
            prizepicks_line REAL NOT NULL,
            sportsbook_line REAL,

            -- Probabilities
            fair_prob_over REAL,
            fair_prob_under REAL,

            -- Edge
            recommended_side TEXT,  -- 'over' or 'under'
            edge_percentage REAL,

            -- Metadata
            num_books INTEGER,
            books_used TEXT,  -- JSON array as string

            -- Timestamps
            found_at TEXT DEFAULT (datetime('now')),
            game_time TEXT,

            -- Outcome tracking (fill in after game)
            result TEXT DEFAULT 'pending',  -- 'hit', 'miss', 'push', 'pending'
            actual_value REAL
        );

        CREATE INDEX IF NOT EXISTS idx_ev_pending
            ON ev_opportunities(result) WHERE result = 'pending';

        CREATE INDEX IF NOT EXISTS idx_ev_date
            ON ev_opportunities(found_at);
    """)

    conn.commit()
    return conn
```

---

## Implementation Steps

### Phase 1: Core Math (File: `src/devig.py`)

**Goal:** Get the math functions working and verified with unit tests.

```
Step 1: Create src/devig.py with:
        - american_to_probability(odds: int) -> float
        - devig_power(over_odds: int, under_odds: int) -> tuple[float, float]
        - build_consensus(books_data: list[dict]) -> float
        - calculate_edge(fair_prob: float, entry_type: str) -> float

Step 2: Create tests/test_devig.py with pytest test cases
        (see Testing README for exact test cases)

Step 3: Verify:
        cd abritage && python -m pytest tests/test_devig.py -v
        All tests must pass before proceeding.
```

### Phase 2: PrizePicks Fetcher (File: `src/prizepicks_client.py`)

**Goal:** Fetch live PrizePicks data and parse it into a usable format.

```
Step 1: Create src/prizepicks_client.py with:
        - fetch_prizepicks(league_id: str) -> list[dict]
          Returns list of dicts with: player_name, stat_type, line, team, start_time

Step 2: Manual test — run it and print results:
        python -c "from src.prizepicks_client import fetch_prizepicks; import json; print(json.dumps(fetch_prizepicks('7')[:5], indent=2))"

Step 3: Verify:
        - Returns 50+ props for NBA on a game day
        - Each prop has player_name, stat_type, and line
        - Lines are numeric (floats)
        - Must run from your local machine (not cloud)
```

### Phase 3: Odds API Client (File: `src/odds_api_client.py`)

**Goal:** Fetch sportsbook odds with credit-conscious caching.

```
Step 1: Create src/odds_api_client.py with:
        - OddsApiClient class
        - __init__(self, api_key: str, db_conn: sqlite3.Connection)
        - get_events(sport_key: str) -> list[dict]
        - get_player_props(sport_key: str, event_id: str, markets: list[str]) -> dict
        - _check_cache(cache_key: str) -> dict | None
        - _write_cache(cache_key: str, data: dict) -> None
        - remaining_credits: int  (tracked from response headers)

Step 2: Manual test — fetch one event:
        Costs ~1 credit for events, ~10 for props.

Step 3: Verify:
        - Events list returns game IDs with team names
        - Player props return bookmaker data with Over/Under/price/point
        - x-requests-remaining decreases correctly
        - Cache prevents duplicate API calls within 30 min
```

### Phase 4: Player Matching (File: `src/player_matcher.py`)

**Goal:** Reliably link PrizePicks names to The-Odds-API names.

```
Step 1: Create src/player_matcher.py with:
        - normalize_name(name: str) -> str
        - match_player(pp_name, odds_api_names, overrides) -> str | None
        - load_overrides(conn: sqlite3.Connection) -> dict
        - save_override(conn, pp_name, api_name, sport) -> None

Step 2: Create tests/test_player_matcher.py with edge cases

Step 3: Verify:
        cd abritage && python -m pytest tests/test_player_matcher.py -v
```

### Phase 5: Database + Config (Files: `src/db.py`, `src/config.py`)

**Goal:** Set up SQLite and centralize constants.

```
Step 1: Create src/db.py with:
        - init_db(db_path) -> sqlite3.Connection
        - save_opportunity(conn, opportunity_dict) -> int
        - get_pending_opportunities(conn) -> list[dict]
        - update_result(conn, opp_id, result, actual_value) -> None

Step 2: Create src/config.py with:
        - SPORTSBOOK_WEIGHTS dict
        - BREAKEVEN_THRESHOLDS dict
        - STAT_TYPE_MAP dict
        - ODDS_API_SPORT_KEYS dict
        - PRIZEPICKS_LEAGUE_IDS dict
        - EDGE_MINIMUM = 0.02

Step 3: Verify:
        python -c "from src.db import init_db; conn = init_db(); print('DB initialized')"
```

### Phase 6: Main Pipeline (Files: `src/ev_scanner.py`, `scan.py`)

**Goal:** Wire everything together into a runnable CLI tool.

```
Step 1: Create src/ev_scanner.py with:
        - scan_for_ev(league: str, conn, api_key: str) -> list[dict]
          This function:
          a) Fetches PrizePicks props for the league
          b) Gets sportsbook odds via OddsApiClient
          c) Matches players across both sources
          d) De-vigs and builds consensus for each matched prop
          e) Calculates edge
          f) Filters to edge > 2%
          g) Saves results to SQLite
          h) Returns list of +EV opportunities

Step 2: Create scan.py as CLI entry point:
        python scan.py --league NBA
        python scan.py --league NBA --min-edge 3
        python scan.py --league NBA --export csv

Step 3: Verify:
        python scan.py --league NBA
        Expected: table of +EV opportunities printed to terminal
        (may be empty if no edges exist today — that's valid data)
```

### Phase 7: Outcome Tracking (Optional)

**Goal:** After games conclude, check if picks hit.

```
Step 1: Add to scan.py:
        python scan.py --update-results
        Checks pending opportunities against actual game results

Step 2: Add summary stats:
        python scan.py --stats
        Shows: total picks, hit rate, average edge, ROI
```

---

## Free Tier Strategy

### The Problem

500 credits/month ≈ 50-100 API calls. Each player props call ≈ 10 credits.

**You can't poll constantly.** Be strategic.

### Strategy: Targeted, Manual Runs

```
1. RUN ONCE PER DAY (or twice on heavy game days)
   └─ Morning (9-10 AM PT): Lines may be stale
   └─ Pre-game (2-3 hours before tip-off): Late news moves lines

2. ONLY FETCH GAMES THAT HAVE PRIZEPICKS PROPS
   └─ Fetch PrizePicks data first (free, no credits)
   └─ Identify which games have props you'd bet
   └─ Only fetch odds for those specific games

3. BATCH MARKETS IN ONE CALL
   └─ ?markets=player_points,player_rebounds,player_assists,player_threes
   └─ Same credit cost as fetching one market

4. CACHE IN SQLITE
   └─ Store fetched odds with timestamp
   └─ Skip API call if cached data is < 30 min old
   └─ Avoids wasting credits on re-runs
```

### Credit Budget Example

**Per day (assuming ~16 credits/day budget for 30 days = 480 credits):**
```
Morning scan:
  - 1 events list call = ~1 credit
  - 3 NBA games × 1 props call each = ~10 credits

Pre-game scan (uses cache if < 30 min):
  - 2 priority games × 1 call each = ~6 credits (or 0 if cached)

Total: ~11-16 credits/day × 30 days = 330-480 credits (within 500)
```

### Upgrade Path

If the strategy proves profitable and you want more data:
- **$25/month (Starter):** 20,000 credits → scan every 5 min
- **$49/month (Standard):** 90,000 credits → comfortable daily use

---

## Example Workflow

### Running the Scanner

```bash
cd abritage
source venv/bin/activate
python scan.py --league NBA
```

### What Happens Internally

**Step 1: Fetch PrizePicks Data**
```
Fetching PrizePicks NBA projections...
Found 87 props across 6 games
Sample: LeBron James | Points | 25.5
```

**Step 2: Fetch Sportsbook Odds**
```
Fetching events for basketball_nba...
Found 6 NBA events
Fetching player props for LAL vs BOS (event abc123)... [10 credits]
Fetching player props for GSW vs PHX (event def456)... [10 credits]
Using cached data for MIA vs NYK (cached 12 min ago)
Credits remaining: 472
```

**Step 3: Match Players**
```
Matched 54 of 87 PrizePicks props to sportsbook data
Unmatched: 33 (no sportsbook odds available for those props)
```

**Step 4-6: De-Vig, Consensus, Edge**
```
Processing 54 matched props...
Found 4 opportunities with edge > 2%
```

**Step 7: Results**

```
┌──────────────────────────────────────────────────────────────────┐
│                     +EV OPPORTUNITIES                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. LeBron James — Points Over 25.5                              │
│     Fair Prob: 56.93%  |  Break-Even: 54.2%  |  Edge: +2.73%    │
│     Books: fanduel, draftkings (2 books)                         │
│     Quality: Good                                                │
│                                                                  │
│  2. Jayson Tatum — Rebounds Over 8.5                             │
│     Fair Prob: 58.12%  |  Break-Even: 54.2%  |  Edge: +3.92%    │
│     Books: fanduel, draftkings, betmgm (3 books)                │
│     Quality: Very Good                                           │
│                                                                  │
│  3. Tyrese Haliburton — Assists Over 9.5                        │
│     Fair Prob: 56.50%  |  Break-Even: 54.2%  |  Edge: +2.30%    │
│     Books: fanduel, draftkings (2 books)                         │
│     Quality: Good                                                │
│                                                                  │
│  4. Stephen Curry — 3-Pt Made Over 4.5                          │
│     Fair Prob: 59.85%  |  Break-Even: 54.2%  |  Edge: +5.65%    │
│     Books: fanduel, pinnacle, draftkings (3 books)              │
│     Quality: Excellent — verify data is fresh                    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Total props scanned: 54  |  +EV found: 4  |  Credits used: 21  │
│  Results saved to ev_results.db                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Do NOT

These constraints keep the proof of concept clean and isolated.

- **Do NOT connect to Firestore, the Flask backend, or any part of the main Lambda Rim project.** This is standalone. PrizePicks data is fetched live, not read from the existing database.
- **Do NOT build a frontend or API server.** Output goes to terminal and SQLite. If it works, we'll integrate later.
- **Do NOT auto-run on a schedule (cron/timer).** Run manually with `python scan.py`. We need to see what's happening before automating.
- **Do NOT spend credits carelessly.** Always check `remaining_credits` before making API calls. Cache aggressively. The free tier is 500/month — that's roughly 16/day.
- **Do NOT hardcode the API key.** Read from `.env` file or `ODDS_API_KEY` environment variable.
- **Do NOT install dependencies globally.** Use a virtual environment inside `abritage/venv/`.
- **Do NOT commit `.env` or `ev_results.db` to git.** Add them to `abritage/.gitignore`.
- **Do NOT over-engineer.** No classes where a function works. No abstraction for one use case. This is a proof of concept — keep it simple and readable.
- **Do NOT try to handle every sport at once.** Start with NBA only. Add others after NBA works.

---

## Verification & Testing

Every component must have a way to verify correctness.

### Unit Tests (free, run anytime)

```bash
cd abritage
source venv/bin/activate

# Run all math + matching tests (0 credits, 0 API calls)
python -m pytest tests/test_devig.py tests/test_player_matcher.py -v
```

### Manual API Smoke Test

```bash
# Check The-Odds-API key works (costs 0 credits — sports list is free)
curl "https://api.the-odds-api.com/v4/sports?apiKey=$ODDS_API_KEY"

# Check remaining credits
curl -sI "https://api.the-odds-api.com/v4/sports?apiKey=$ODDS_API_KEY" | grep x-requests
```

### Full Pipeline Test

```bash
# Run the scanner and check output
python scan.py --league NBA

# Check what's in the database
python -c "
import sqlite3
conn = sqlite3.connect('ev_results.db')
rows = conn.execute('SELECT player_name, stat_type, edge_percentage FROM ev_opportunities ORDER BY edge_percentage DESC').fetchall()
for r in rows:
    print(f'{r[0]:25s} | {r[1]:12s} | Edge: {r[2]:+.2%}')
"
```

### Strategy Validation (over time)

After running for a few days/weeks:

```bash
# Check hit rate of +EV picks
python scan.py --stats

# Expected output:
#   Total picks tracked: 47
#   Resolved: 38
#   Hit rate: 57.9% (target: >54.2%)
#   Average edge: +3.1%
#   Implied ROI: +5.4%
```

This is the real validation — if hit rate stays above the break-even threshold over 50+ picks, the strategy works.

### Pre-Integration Checklist

Before wiring this into the main Lambda Rim project, verify:

```
[ ] Math tests pass (pytest tests/test_devig.py)
[ ] Matching tests pass (pytest tests/test_player_matcher.py)
[ ] Scanner runs without errors (python scan.py --league NBA)
[ ] 50+ picks tracked in SQLite
[ ] Hit rate is above 54.2% break-even
[ ] Average edge is above 2%
[ ] Credit usage is sustainable on free tier
```

---

## Quick Reference

### CLI Commands

```bash
# Setup (one-time)
cd abritage
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run scanner
python scan.py --league NBA

# Run tests
python -m pytest tests/ -v

# Check database
sqlite3 ev_results.db "SELECT * FROM ev_opportunities ORDER BY found_at DESC LIMIT 10;"

# Check credit usage
curl -sI "https://api.the-odds-api.com/v4/sports?apiKey=$ODDS_API_KEY" | grep x-requests
```

### Python Code Snippets (copy-paste ready)

```python
# American odds → probability
def american_to_probability(odds):
    if odds < 0:
        return abs(odds) / (abs(odds) + 100)
    else:
        return 100 / (odds + 100)

# Power method de-vig
from scipy.optimize import brentq

def devig_power(over_odds, under_odds):
    ip_over = american_to_probability(over_odds)
    ip_under = american_to_probability(under_odds)

    def objective(k):
        return ip_over**k + ip_under**k - 1.0

    k = brentq(objective, 0.5, 2.0)
    return ip_over**k, ip_under**k

# Weighted consensus
SPORTSBOOK_WEIGHTS = {
    "fanduel": 100, "pinnacle": 80, "draftkings": 60,
    "betmgm": 40, "williamhill_us": 40,
}

def build_consensus(books_data):
    total_weight = 0
    weighted_sum = 0
    for book in books_data:
        w = SPORTSBOOK_WEIGHTS.get(book["book"], 20)
        weighted_sum += w * book["fair_over"]
        total_weight += w
    return weighted_sum / total_weight

# Edge calculation
def calculate_edge(fair_prob, entry_type="6-pick-flex"):
    breakeven = {
        "2-pick-power": 0.577, "3-pick-power": 0.585,
        "4-pick-flex": 0.550, "5-pick-flex": 0.542, "6-pick-flex": 0.542,
    }
    return fair_prob - breakeven[entry_type]
```

---

*Lambda Rim +EV Detection System — Standalone Proof of Concept*
