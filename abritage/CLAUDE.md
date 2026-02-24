# Lambda Rim: +EV Detection System — Standalone POC

## What This Is

Standalone proof of concept that compares PrizePicks lines against sportsbook consensus odds to find +EV (positive expected value) betting opportunities. Completely isolated from the main Lambda Rim project (Flask, Firestore, frontend). If it works, we integrate later.

## Tech Stack

- Python 3.9+, virtual environment at `abritage/venv/`
- `scipy` (brentq for de-vig), `requests` (API calls), `rapidfuzz` (name matching), `pytest` (testing)
- SQLite for local storage (`ev_results.db`)
- Two external APIs: PrizePicks (free, no key) and The-Odds-API (free tier, 500 credits/month)

## Key Commands

```bash
# Setup
cd abritage && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# Run free tests (math + matching, no API credits)
python -m pytest tests/test_devig.py tests/test_player_matcher.py -v

# Run API tests (costs ~11 credits — run sparingly)
ODDS_API_KEY=your_key python -m pytest tests/test_odds_api.py -v

# Run full scan
python scan.py --league NBA

# Check SQLite results
sqlite3 ev_results.db "SELECT player_name, stat_type, edge_percentage FROM ev_opportunities ORDER BY edge_percentage DESC LIMIT 10;"
```

## Project Structure

```
abritage/
├── src/
│   ├── devig.py                # Math: odds conversion, de-vig, consensus, edge
│   ├── prizepicks_client.py    # Fetch live PrizePicks projections
│   ├── odds_api_client.py      # Fetch sportsbook odds (The-Odds-API)
│   ├── player_matcher.py       # Name matching (exact → normalized → override → fuzzy)
│   ├── ev_scanner.py           # Main pipeline
│   ├── db.py                   # SQLite setup and queries
│   └── config.py               # Constants (weights, thresholds, sport keys)
├── tests/                      # pytest test files
├── scan.py                     # CLI entry point
└── ev_results.db               # SQLite database (auto-created)
```

## Critical Rules

- ODDS_API_KEY comes from `.env` file or environment variable. Never hardcode it.
- The-Odds-API free tier = 500 credits/month. Each player props call costs ~10 credits. Always cache in SQLite (30 min TTL).
- PrizePicks API blocks cloud IPs. Must run from local machine (residential IP).
- `test_devig.py` and `test_player_matcher.py` cost 0 credits — run freely. `test_odds_api.py` costs ~11 credits — run once.
- Do NOT connect to Firestore, Flask, or any part of the main Lambda Rim backend. This is standalone.

## The Math Pipeline

1. Fetch PrizePicks props (player, stat, line)
2. Fetch sportsbook odds from The-Odds-API
3. Match players across sources (exact → normalized → override → fuzzy at 85% threshold)
4. De-vig using power method: find k where `IP_over^k + IP_under^k = 1` via `scipy.optimize.brentq`
5. Build weighted consensus: FanDuel=100, Pinnacle=80, DraftKings=60, BetMGM=40, Caesars=40
6. Edge = fair_prob - breakeven (54.2% for 5/6-pick flex)
7. Flag if edge > 2%

## PrizePicks API

- Endpoint: `GET https://api.prizepicks.com/projections`
- JSON:API format: projections in `data[]`, players in `included[]`
- League IDs: NBA=7, NFL=9, NHL=8, MLB=2, CBB=20, CFB=15
- Player name is in `included[].attributes.display_name`, line is in `data[].attributes.line_score`

## The-Odds-API

- Docs: https://the-odds-api.com/lp/v4/
- Events: `GET /v4/sports/{sport}/events?apiKey=KEY` (~1 credit)
- Props: `GET /v4/sports/{sport}/events/{id}/odds?apiKey=KEY&regions=us&markets=player_points,...&oddsFormat=american` (~10 credits)
- Batch markets in one call to save credits
- Track `x-requests-remaining` response header
- Sport keys: NBA=`basketball_nba`, NFL=`americanfootball_nfl`, NHL=`icehockey_nhl`
