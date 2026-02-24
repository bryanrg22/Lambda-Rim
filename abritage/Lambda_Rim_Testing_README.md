# Lambda Rim: Testing Guide — Standalone Proof of Concept

A step-by-step guide to test each component of the +EV detection system. All tests run locally inside `abritage/` with no connection to the main Lambda Rim project.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Setup](#test-setup)
3. [Test 1: The-Odds-API Connection](#test-1-the-odds-api-connection)
4. [Test 2: American Odds Conversion](#test-2-american-odds-conversion)
5. [Test 3: De-Vig Calculation](#test-3-de-vig-calculation)
6. [Test 4: Consensus Building](#test-4-consensus-building)
7. [Test 5: Edge Calculation](#test-5-edge-calculation)
8. [Test 6: Player Name Matching](#test-6-player-name-matching)
9. [Test 7: PrizePicks Data Fetch](#test-7-prizepicks-data-fetch)
10. [Test 8: Full Pipeline (Single Player)](#test-8-full-pipeline-single-player)
11. [Test Checklist](#test-checklist)
12. [Do NOT](#do-not)
13. [Running Tests](#running-tests)

---

## Testing Philosophy

Before building the full pipeline, verify each piece works independently:

```
┌─────────────────────────────────────────────────────────────┐
│                    TESTING ORDER                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. API Connection      → Can I get data from The-Odds-API?│
│  2. Odds Conversion     → Is my math right?                │
│  3. De-Vig Calculation  → Does power method work?          │
│  4. Consensus Building  → Does weighting work?             │
│  5. Edge Calculation    → Do I get expected edges?         │
│  6. Player Matching     → Can I link PP to sportsbooks?    │
│  7. PrizePicks Fetch    → Can I fetch live PP data?        │
│  8. Full Pipeline       → Does everything work together?   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Rule:** Don't move to the next test until the current one passes.

---

## Test Setup

### Directory Structure

All test files live inside `abritage/` — completely isolated from the rest of the repo.

```
abritage/
├── requirements.txt              # scipy, requests, rapidfuzz, pytest
├── .env                          # ODDS_API_KEY=your_key (gitignored)
├── venv/                         # Virtual environment (gitignored)
│
├── src/
│   ├── __init__.py
│   ├── devig.py                  # Math functions (Tests 2-5)
│   ├── player_matcher.py         # Name matching (Test 6)
│   ├── prizepicks_client.py      # PrizePicks fetcher (Test 7)
│   ├── odds_api_client.py        # Odds API wrapper (Test 1)
│   ├── ev_scanner.py             # Full pipeline (Test 8)
│   ├── db.py                     # SQLite setup
│   └── config.py                 # Constants
│
├── tests/
│   ├── __init__.py
│   ├── test_devig.py             # Tests 2, 3, 4, 5 (pure math — free)
│   ├── test_player_matcher.py    # Test 6 (name matching — free)
│   ├── test_odds_api.py          # Test 1 (API connection — costs credits)
│   ├── test_prizepicks.py        # Test 7 (PrizePicks fetch — free but needs residential IP)
│   └── test_full_pipeline.py     # Test 8 (end-to-end — costs credits)
│
└── scan.py                       # CLI entry point
```

### One-Time Setup

```bash
cd abritage
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### `requirements.txt`

```
requests>=2.28.0
scipy>=1.9.0
rapidfuzz>=3.0.0
pytest>=7.0.0
```

### Environment Variables

| Variable | Used By | How to Get | Costs Credits? |
|----------|---------|------------|----------------|
| `ODDS_API_KEY` | Tests 1, 8 | Sign up at https://the-odds-api.com | Yes |

Create `abritage/.env`:
```
ODDS_API_KEY=your_api_key_here
```

### How to Run Tests

```bash
cd abritage
source venv/bin/activate

# Run all FREE tests (math + matching — no API calls, no credits)
python -m pytest tests/test_devig.py tests/test_player_matcher.py -v

# Run API tests (costs ~11 credits — run sparingly)
ODDS_API_KEY=your_key python -m pytest tests/test_odds_api.py -v

# Run PrizePicks fetch test (free but needs residential IP)
python -m pytest tests/test_prizepicks.py -v

# Run everything
ODDS_API_KEY=your_key python -m pytest tests/ -v
```

---

## Test 1: The-Odds-API Connection

### Goal
Verify you can connect to The-Odds-API and receive valid data.

### File: `tests/test_odds_api.py`

```python
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
            pytest.skip("No NBA events found — likely off-season")


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
```

### Pass Criteria

- [ ] Status code is 200
- [ ] Bookmakers appear in response
- [ ] Outcomes have name, description, price, and point fields
- [ ] `x-requests-remaining` header is tracked

---

## Test 2: American Odds Conversion

### Goal
Verify odds-to-probability conversion using known values.

### File: `tests/test_devig.py` (Part 1)

```python
"""
Tests for src/devig.py — pure math, no API calls, no credits consumed.
Run freely: python -m pytest tests/test_devig.py -v
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest
from devig import american_to_probability, devig_power, build_consensus, calculate_edge


class TestAmericanToProbability:
    """Test 2: American odds → implied probability conversion."""

    @pytest.mark.parametrize("odds, expected", [
        (-100, 0.5000),      # Even odds = 50%
        (-110, 0.5238),      # Standard juice
        (-150, 0.6000),      # Favorite
        (-200, 0.6667),      # Heavy favorite
        (+100, 0.5000),      # Even odds (positive)
        (+110, 0.4762),      # Slight underdog
        (+150, 0.4000),      # Underdog
        (+200, 0.3333),      # Big underdog
        (-145, 0.5918),      # From LeBron example (FanDuel over)
        (+125, 0.4444),      # From LeBron example (FanDuel under)
    ])
    def test_conversion(self, odds, expected):
        result = american_to_probability(odds)
        assert abs(result - expected) < 0.001, (
            f"american_to_probability({odds:+d}) = {result:.4f}, expected {expected:.4f}"
        )

    def test_negative_odds_returns_above_50(self):
        """Negative odds (favorites) should always return > 0.5."""
        for odds in [-110, -150, -200, -300, -500]:
            prob = american_to_probability(odds)
            assert prob > 0.5, f"Odds {odds} should give prob > 0.5, got {prob}"

    def test_positive_odds_returns_below_50(self):
        """Positive odds (underdogs) should always return < 0.5."""
        for odds in [110, 150, 200, 300, 500]:
            prob = american_to_probability(odds)
            assert prob < 0.5, f"Odds +{odds} should give prob < 0.5, got {prob}"

    def test_even_odds_both_sides(self):
        """Both -100 and +100 should return exactly 0.5."""
        assert american_to_probability(-100) == 0.5
        assert american_to_probability(100) == 0.5
```

### Pass Criteria

- [ ] All 10 parametrized cases pass
- [ ] Negative odds → > 50%, Positive odds → < 50%
- [ ] Even odds = exactly 50%

---

## Test 3: De-Vig Calculation

### Goal
Verify the power method removes vig correctly and fair probs always sum to 1.0.

### File: `tests/test_devig.py` (Part 2 — same file, continued)

```python
class TestDevigPower:
    """Test 3: Power method de-vig."""

    @pytest.mark.parametrize("over_odds, under_odds, exp_over, exp_under", [
        (-110, -110, 0.5000, 0.5000),    # Standard -110/-110 = 50/50
        (-145, +125, 0.5724, 0.4276),    # LeBron FanDuel example
        (-140, +120, 0.5641, 0.4359),    # LeBron DraftKings example
        (-200, +170, 0.6344, 0.3656),    # Heavy favorite
        (-120, +100, 0.5349, 0.4651),    # Slight favorite
    ])
    def test_devig_values(self, over_odds, under_odds, exp_over, exp_under):
        fair_over, fair_under = devig_power(over_odds, under_odds)

        assert abs(fair_over - exp_over) < 0.01, (
            f"Fair over for ({over_odds:+d}/{under_odds:+d}): "
            f"got {fair_over:.4f}, expected {exp_over:.4f}"
        )
        assert abs(fair_under - exp_under) < 0.01, (
            f"Fair under for ({over_odds:+d}/{under_odds:+d}): "
            f"got {fair_under:.4f}, expected {exp_under:.4f}"
        )

    @pytest.mark.parametrize("over_odds, under_odds", [
        (-110, -110),
        (-145, +125),
        (-140, +120),
        (-200, +170),
        (-120, +100),
        (-130, +110),
        (-160, +140),
        (-180, +155),
    ])
    def test_fair_probs_sum_to_one(self, over_odds, under_odds):
        """Critical property: fair_over + fair_under must equal 1.0."""
        fair_over, fair_under = devig_power(over_odds, under_odds)
        total = fair_over + fair_under

        assert abs(total - 1.0) < 0.0001, (
            f"Fair probs for ({over_odds:+d}/{under_odds:+d}) "
            f"sum to {total:.6f}, expected 1.000000"
        )

    def test_devig_removes_vig(self):
        """Implied probs sum to > 1 (vig), fair probs sum to exactly 1."""
        ip_over = american_to_probability(-145)
        ip_under = american_to_probability(125)
        implied_total = ip_over + ip_under
        assert implied_total > 1.0, f"Implied total should be > 1, got {implied_total}"

        fair_over, fair_under = devig_power(-145, 125)
        fair_total = fair_over + fair_under
        assert abs(fair_total - 1.0) < 0.0001, f"Fair total should be 1.0, got {fair_total}"

    def test_devig_preserves_direction(self):
        """The favorite should still be the favorite after de-vig."""
        fair_over, fair_under = devig_power(-145, 125)
        assert fair_over > fair_under, "Over was favorite but de-vig flipped it"

    def test_symmetric_odds_give_50_50(self):
        """Symmetric odds like -110/-110 should de-vig to exactly 50/50."""
        fair_over, fair_under = devig_power(-110, -110)
        assert abs(fair_over - 0.5) < 0.0001
        assert abs(fair_under - 0.5) < 0.0001
```

### Pass Criteria

- [ ] 5 value test cases pass (within 0.01)
- [ ] 8 sum-to-one cases pass (within 0.0001)
- [ ] Vig removed: implied > 1.0, fair = 1.0
- [ ] Direction preserved, symmetric = 50/50

---

## Test 4: Consensus Building

### Goal
Verify weighted average across sportsbooks works correctly.

### File: `tests/test_devig.py` (Part 3 — same file, continued)

```python
class TestBuildConsensus:
    """Test 4: Weighted consensus from multiple sportsbooks."""

    def test_single_book(self):
        """Single book consensus should equal that book's probability."""
        data = [{"book": "fanduel", "fair_over": 0.5724}]
        result = build_consensus(data)
        assert abs(result - 0.5724) < 0.0001

    def test_two_books_weighted(self):
        """FanDuel (weight 100) + DraftKings (weight 60)."""
        data = [
            {"book": "fanduel", "fair_over": 0.5724},
            {"book": "draftkings", "fair_over": 0.5641},
        ]
        result = build_consensus(data)
        # Manual: (100*0.5724 + 60*0.5641) / 160 = 0.5693
        assert abs(result - 0.5693) < 0.001

    def test_three_books_weighted(self):
        """FanDuel (100) + DraftKings (60) + BetMGM (40)."""
        data = [
            {"book": "fanduel", "fair_over": 0.5724},
            {"book": "draftkings", "fair_over": 0.5641},
            {"book": "betmgm", "fair_over": 0.5750},
        ]
        result = build_consensus(data)
        # Manual: (100*0.5724 + 60*0.5641 + 40*0.5750) / 200 = 0.5704
        assert abs(result - 0.5704) < 0.001

    def test_all_same_value(self):
        """If all books agree, consensus equals that value regardless of weights."""
        data = [
            {"book": "fanduel", "fair_over": 0.55},
            {"book": "draftkings", "fair_over": 0.55},
            {"book": "betmgm", "fair_over": 0.55},
        ]
        result = build_consensus(data)
        assert abs(result - 0.55) < 0.0001

    def test_unknown_book_gets_default_weight(self):
        """Unknown sportsbook should get default weight of 20."""
        data = [
            {"book": "fanduel", "fair_over": 0.60},
            {"book": "unknown_book", "fair_over": 0.50},
        ]
        result = build_consensus(data)
        # Manual: (100*0.60 + 20*0.50) / 120 = 0.5833
        assert abs(result - 0.5833) < 0.001

    def test_heavier_weight_pulls_consensus(self):
        """Higher-weighted book should pull consensus toward its value."""
        data = [
            {"book": "fanduel", "fair_over": 0.60},      # weight 100
            {"book": "draftkings", "fair_over": 0.50},    # weight 60
        ]
        result = build_consensus(data)
        assert result > 0.55, f"Consensus {result:.4f} should be pulled toward 0.60"
```

### Pass Criteria

- [ ] Single book = its own probability
- [ ] Multi-book weighted averages match manual calculations
- [ ] Unknown books get default weight of 20
- [ ] Higher-weighted books pull consensus their direction

---

## Test 5: Edge Calculation

### Goal
Verify edge = fair_prob - breakeven_threshold.

### File: `tests/test_devig.py` (Part 4 — same file, continued)

```python
class TestCalculateEdge:
    """Test 5: Edge = fair_prob - breakeven threshold."""

    @pytest.mark.parametrize("fair_prob, entry_type, expected_edge", [
        (0.5724, "6-pick-flex", 0.0304),   # LeBron example: +3.04%
        (0.5500, "6-pick-flex", 0.0080),   # Small edge
        (0.5800, "6-pick-flex", 0.0380),   # Good edge
        (0.6000, "6-pick-flex", 0.0580),   # Excellent edge
        (0.5400, "6-pick-flex", -0.0020),  # Negative edge → skip
        (0.5800, "2-pick-power", 0.0030),  # Same prob, harder entry type
        (0.5800, "5-pick-flex", 0.0380),   # 5-pick same threshold as 6-pick
    ])
    def test_edge_values(self, fair_prob, entry_type, expected_edge):
        edge = calculate_edge(fair_prob, entry_type)
        assert abs(edge - expected_edge) < 0.0001, (
            f"Edge for {fair_prob:.2%} ({entry_type}): "
            f"got {edge:+.4f}, expected {expected_edge:+.4f}"
        )

    def test_negative_edge_is_negative(self):
        edge = calculate_edge(0.50, "6-pick-flex")
        assert edge < 0, f"Edge should be negative for 50%, got {edge}"

    def test_6pick_and_5pick_same_threshold(self):
        edge_5 = calculate_edge(0.58, "5-pick-flex")
        edge_6 = calculate_edge(0.58, "6-pick-flex")
        assert edge_5 == edge_6

    def test_2pick_harder_than_6pick(self):
        edge_2 = calculate_edge(0.58, "2-pick-power")
        edge_6 = calculate_edge(0.58, "6-pick-flex")
        assert edge_2 < edge_6

    def test_invalid_entry_type_raises(self):
        with pytest.raises((ValueError, KeyError)):
            calculate_edge(0.58, "invalid-type")

    def test_default_entry_type(self):
        edge_default = calculate_edge(0.58)
        edge_explicit = calculate_edge(0.58, "6-pick-flex")
        assert edge_default == edge_explicit
```

### Pass Criteria

- [ ] 7 parametrized edge values correct
- [ ] Negative edges detected
- [ ] 5-pick = 6-pick threshold, 2-pick is harder
- [ ] Invalid entry type raises error
- [ ] Default is 6-pick-flex

---

## Test 6: Player Name Matching

### Goal
Verify name matching handles real-world variations.

### File: `tests/test_player_matcher.py`

```python
"""
Tests for src/player_matcher.py — name normalization and matching.
No API calls, no credits consumed. Run freely.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest
from player_matcher import normalize_name, match_player


class TestNormalizeName:
    """Test name normalization rules."""

    @pytest.mark.parametrize("input_name, expected", [
        ("LeBron James", "lebron james"),
        ("STEPHEN CURRY", "stephen curry"),
        ("P.J. Washington", "pj washington"),
        ("O.G. Anunoby", "og anunoby"),
        ("C.J. McCollum", "cj mccollum"),
        ("T.J. McConnell", "tj mcconnell"),
        ("Shai Gilgeous-Alexander", "shai gilgeous alexander"),
        ("Karl-Anthony Towns", "karl anthony towns"),
        ("De'Aaron Fox", "de'aaron fox"),
        ("Jaren Jackson Jr.", "jaren jackson"),
        ("Gary Trent Jr.", "gary trent"),
        ("Wendell Carter Jr.", "wendell carter"),
        ("Kelly Oubre Jr.", "kelly oubre"),
        ("P.J. Washington Jr.", "pj washington"),
        ("  LeBron   James  ", "lebron james"),
    ])
    def test_normalize(self, input_name, expected):
        result = normalize_name(input_name)
        assert result == expected, (
            f"normalize_name('{input_name}') = '{result}', expected '{expected}'"
        )


class TestMatchPlayer:
    """Test the full matching pipeline: exact → normalized → override → fuzzy."""

    def test_exact_match(self):
        result = match_player(
            "LeBron James",
            ["LeBron James", "Stephen Curry", "Kevin Durant"],
            overrides={},
        )
        assert result == "LeBron James"

    def test_normalized_match_hyphen(self):
        result = match_player(
            "Shai Gilgeous-Alexander",
            ["Shai Gilgeous Alexander", "Stephen Curry"],
            overrides={},
        )
        assert result == "Shai Gilgeous Alexander"

    def test_normalized_match_period(self):
        result = match_player(
            "P.J. Washington",
            ["PJ Washington", "Stephen Curry"],
            overrides={},
        )
        assert result == "PJ Washington"

    def test_normalized_match_suffix(self):
        result = match_player(
            "Jaren Jackson Jr.",
            ["Jaren Jackson", "Stephen Curry"],
            overrides={},
        )
        assert result == "Jaren Jackson"

    def test_override_match(self):
        result = match_player(
            "Nickname Player",
            ["Real Name Player", "Other Person"],
            overrides={"Nickname Player": "Real Name Player"},
        )
        assert result == "Real Name Player"

    def test_no_match_returns_none(self):
        result = match_player(
            "Nonexistent Player",
            ["LeBron James", "Stephen Curry"],
            overrides={},
        )
        assert result is None

    def test_case_insensitive_match(self):
        result = match_player(
            "lebron james",
            ["LeBron James", "Stephen Curry"],
            overrides={},
        )
        assert result == "LeBron James"

    def test_fuzzy_match_close_name(self):
        """Fuzzy should match very similar names (> 85% similarity)."""
        result = match_player(
            "Lebron James",
            ["LeBron James"],
            overrides={},
        )
        assert result == "LeBron James"
```

### Pass Criteria

- [ ] 15 normalization cases pass
- [ ] Exact, normalized, override, and fuzzy tiers work
- [ ] Non-matches return None

---

## Test 7: PrizePicks Data Fetch

### Goal
Verify you can fetch live PrizePicks projections and parse them correctly.

**Note:** This test must run from your **local machine** (residential IP). PrizePicks blocks cloud provider IPs.

### File: `tests/test_prizepicks.py`

```python
"""
Tests for src/prizepicks_client.py — live PrizePicks data fetch.
No API key needed. No credits consumed. But MUST run from residential IP.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest
import requests


class TestPrizePicksApiAccess:
    """Test 7.1: Verify PrizePicks API is reachable."""

    def test_api_returns_200(self):
        """PrizePicks projections endpoint should return 200."""
        url = "https://api.prizepicks.com/projections"
        params = {"league_id": "7", "single_stat": "true", "per_page": "10"}

        response = requests.get(url, params=params, timeout=15)

        if response.status_code == 403:
            pytest.skip(
                "PrizePicks returned 403 — you're likely on a cloud IP. "
                "Run this test from your local machine."
            )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}"
        )

    def test_response_has_data_and_included(self):
        """Response should have 'data' and 'included' arrays (JSON:API format)."""
        url = "https://api.prizepicks.com/projections"
        params = {"league_id": "7", "single_stat": "true", "per_page": "10"}

        response = requests.get(url, params=params, timeout=15)
        if response.status_code == 403:
            pytest.skip("Blocked — run from local machine")

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
        response = requests.get(url, params=params, timeout=15)

        if response.status_code == 403:
            pytest.skip("Blocked — run from local machine")
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

    def test_line_score_is_numeric(self):
        """line_score should be parseable as a float."""
        json_data = self._fetch_sample()
        projections = json_data.get("data", [])

        if not projections:
            pytest.skip("No projections available")

        for proj in projections[:5]:
            line = proj["attributes"]["line_score"]
            try:
                float(line)
            except (ValueError, TypeError):
                pytest.fail(f"line_score '{line}' is not numeric")
```

### Pass Criteria

- [ ] API returns 200 (from residential IP)
- [ ] Response has `data` and `included` arrays
- [ ] Projections have `line_score`, `stat_type`, `start_time`
- [ ] Each projection links to a player with `display_name`
- [ ] `line_score` values are numeric

---

## Test 8: Full Pipeline (Single Player)

### Goal
Run the entire pipeline end-to-end for one player.

### File: `tests/test_full_pipeline.py`

```python
"""
Full end-to-end pipeline test.
test_pipeline_with_mock_data: FREE — uses hardcoded data, no API calls.
test_pipeline_with_live_api: COSTS ~11 credits — uses real API.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import os
import pytest
import requests

from devig import american_to_probability, devig_power, build_consensus, calculate_edge
from player_matcher import normalize_name

API_KEY = os.environ.get("ODDS_API_KEY")


class TestFullPipeline:
    """Test 8: End-to-end pipeline."""

    def test_pipeline_with_mock_data(self):
        """Run the full math pipeline with hardcoded sportsbook data.
        This test is FREE — no API calls, no credits.
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
            pytest.skip("No NBA events — likely off-season")

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
```

### Pass Criteria

- [ ] Mock pipeline produces ~+2.7% edge (free test)
- [ ] Live pipeline runs without errors (if events available)
- [ ] De-vig produces valid probabilities
- [ ] Consensus is in reasonable range (30–85%)

---

## Test Checklist

```
┌─────────────────────────────────────────────────────────────┐
│                    TEST CHECKLIST                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [ ] Test 1: The-Odds-API Connection                        │
│      [ ] API key returns 200                                │
│      [ ] NBA events returned with correct fields            │
│      [ ] Player props have name/line/odds                   │
│      Credit cost: ~11                                       │
│                                                             │
│  [ ] Test 2: American Odds Conversion                       │
│      [ ] All 10 parametrized cases pass                     │
│      [ ] Favorites > 50%, underdogs < 50%                   │
│      Credit cost: 0                                         │
│                                                             │
│  [ ] Test 3: De-Vig Calculation                             │
│      [ ] 5 value cases pass                                 │
│      [ ] 8 sum-to-one cases pass                            │
│      [ ] Direction preserved, symmetric = 50/50             │
│      Credit cost: 0                                         │
│                                                             │
│  [ ] Test 4: Consensus Building                             │
│      [ ] Single, two, three book cases pass                 │
│      [ ] Unknown book gets default weight                   │
│      Credit cost: 0                                         │
│                                                             │
│  [ ] Test 5: Edge Calculation                               │
│      [ ] 7 parametrized edge values correct                 │
│      [ ] Negative edges detected                            │
│      [ ] Default entry type works                           │
│      Credit cost: 0                                         │
│                                                             │
│  [ ] Test 6: Player Name Matching                           │
│      [ ] 15 normalization cases pass                        │
│      [ ] Exact, normalized, override, fuzzy all work        │
│      Credit cost: 0                                         │
│                                                             │
│  [ ] Test 7: PrizePicks Data Fetch                          │
│      [ ] API returns 200 (from local machine)               │
│      [ ] Response has data + included arrays                │
│      [ ] Projections have line_score, stat_type, player     │
│      Credit cost: 0                                         │
│                                                             │
│  [ ] Test 8: Full Pipeline                                  │
│      [ ] Mock data → ~+2.7% edge (free)                     │
│      [ ] Live API → reasonable consensus (costs ~11)        │
│      Credit cost: 0-11                                      │
│                                                             │
│  TOTAL CREDIT COST: ~11-22 (out of 500/month)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Do NOT

- **Do NOT connect to Firestore, Flask, or any part of the main Lambda Rim project.** This is standalone.
- **Do NOT run Tests 1 and 8 (live API) repeatedly.** They cost credits. Run once to verify, then rely on free tests.
- **Do NOT run PrizePicks tests (Test 7) from a cloud VM.** PrizePicks blocks cloud IPs. Use your local machine.
- **Do NOT put your API key in test files.** Use `ODDS_API_KEY` environment variable.
- **Do NOT commit `.env` or `ev_results.db` to git.** Add to `.gitignore`.
- **Do NOT install dependencies globally.** Use `abritage/venv/`.
- **Do NOT use `unittest`.** Use `pytest` — supports parametrize and is cleaner.

---

## Running Tests

### Quick Reference

```bash
cd abritage
source venv/bin/activate

# FREE tests — run anytime, as often as you want
python -m pytest tests/test_devig.py tests/test_player_matcher.py -v

# PrizePicks fetch test (free but needs residential IP)
python -m pytest tests/test_prizepicks.py -v

# Specific test class
python -m pytest tests/test_devig.py::TestDevigPower -v

# Specific test
python -m pytest tests/test_devig.py::TestDevigPower::test_symmetric_odds_give_50_50 -v

# API tests (costs credits)
ODDS_API_KEY=your_key python -m pytest tests/test_odds_api.py -v

# Full pipeline (costs credits)
ODDS_API_KEY=your_key python -m pytest tests/test_full_pipeline.py -v

# Everything
ODDS_API_KEY=your_key python -m pytest tests/ -v
```

### Expected Test Counts

| Test File | Tests | Credits | Run When |
|-----------|-------|---------|----------|
| `test_devig.py` | ~30 | 0 | Every code change |
| `test_player_matcher.py` | ~10 | 0 | Every code change |
| `test_prizepicks.py` | ~4 | 0 | Once during setup (local IP only) |
| `test_odds_api.py` | ~3 | ~11 | Once during setup |
| `test_full_pipeline.py` | ~2 | 0-11 | Once before first real scan |
| **Total** | **~49** | **~11-22** | |

---

## Next Steps After All Tests Pass

Once all tests pass, you have a working proof of concept. Run it for real:

1. **Run daily scans** — `python scan.py --league NBA` before games
2. **Track results** — log picks, check if they hit after games
3. **Evaluate the strategy** — after 50+ tracked picks:
   - Hit rate above 54.2%? Strategy works.
   - Average edge above 2%? Strategy is profitable.
   - Neither? Adjust or scrap.
4. **If it works** — then integrate into the main Lambda Rim project (Flask, Firestore, frontend)

---

*Lambda Rim Testing Guide — Verify the strategy works before building anything else.*
