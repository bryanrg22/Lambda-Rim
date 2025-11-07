# PrizePicks Daily Fetch (Local Cron Job)

Automated local script that fetches live PrizePicks betting data (NBA, NFL, Soccer, NHL, CFB, CBB) and uploads it to Firestore daily via a cron job running on your local machine.

## Overview

This script:
1. ✅ Fetches live PrizePicks data from their public API (multi-league support)
2. ✅ Processes and organizes data by game date, player, category, and line score
3. ✅ Uploads to Firestore with batched writes (optimized for speed)
4. ✅ Runs automatically via local cron job

## Why Local Cron Instead of Cloud Function?

**The Problem:** PrizePicks uses bot protection (Cloudflare-style firewall) that blocks requests from cloud provider IP ranges (GCP, AWS, Azure, etc.). When running as a Google Cloud Function, requests from Google data-center IPs were being blocked with 4xx errors, even though the exact same code worked perfectly when run locally.

**The Solution:** Running the script locally via cron ensures requests come from your residential IP address, which PrizePicks accepts. This is why we switched from GCP Cloud Functions to a local cron job.

**Note:** This same issue would likely occur with AWS Lambda, Vercel, or any other cloud function service, as they all use cloud provider IP ranges that are flagged by PrizePicks' bot protection.

## Firestore Structure

```
preproccessed_data/          (collection)
  prizepicks                 (document)
    leagues/                 (collection)
      {LEAGUE}/              (document)  e.g. "NBA", "NFL", "NHL", "CFB", "CBB", "SOCCER"
        {game_date}/         (collection) e.g. "2025-11-07"
          {player_key}/      (document)   e.g. "lebron_james"
            fields:
              player_name : "LeBron James"
              league      : "NBA"
              game_date   : "2025-11-07"
            {category}/    (subcollection) e.g. "points", "assists", "fantasy_score"
              {line_score}/ (document)      e.g. "26.5"
                fields:
                  bet_type        : "More/Less" or "More-only"
                  odds_type       : "standard" / "goblin" / "demon" / ...
                  projection_type : API's projection_type value
```

**Document IDs:**
- `{LEAGUE}`: League name (e.g., "NBA", "NFL", "NHL", "CFB", "CBB", "SOCCER")
- `{game_date}`: Date in YYYY-MM-DD format (e.g., "2025-11-07")
- `{player_key}`: Sanitized player name (e.g., "lebron_james")
- `{category}`: Sanitized category name (e.g., "points", "assists")
- `{line_score}`: The line score value (e.g., "26.5")

## Configuration

**Runtime:** Python 3.11+  
**Location:** Local machine (Mac/Linux)  
**Schedule:** Daily via cron (configurable, default: 12:05 AM Pacific Time)  
**Entry Point:** `local_runner.py` → `fetch_and_upload_all_prizepicks()`

**Supported Leagues:**
- NBA (league_id: 7)
- NFL (league_id: 9)
- Soccer (league_id: 82)
- NHL (league_id: 8)
- CFB (league_id: 15)
- CBB (league_id: 20)

## Quick Start

### Setup

1. **Install dependencies:**
```bash
cd prizepicks_fetch_fn
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Set up Firebase credentials:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/firebase-service-account.json"
```

3. **Test manually:**
```bash
python local_runner.py
```

### Setup Cron Job

1. **Make the shell script executable:**
```bash
chmod +x run_prizepicks.sh
```

2. **Edit your crontab:**
```bash
crontab -e
```

3. **Add the cron job (runs daily at 12:05 AM Pacific Time):**
```bash
# PrizePicks daily fetch - runs at 12:05 AM PT (8:05 AM UTC)
5 8 * * * /Users/bryanramirez-gonzalez/Documents/GitHub/Lambda-Rim/prizepicks_fetch_fn/run_prizepicks.sh >> /tmp/prizepicks_cron.log 2>&1
```

**Note:** Adjust the path in `run_prizepicks.sh` to match your project location, and update the cron schedule as needed.

### Verify Cron Job

```bash
# Check if cron job is scheduled
crontab -l

# View recent logs
tail -f /tmp/prizepicks_cron.log
```

## Monitoring

### View Logs

```bash
# View cron execution logs
tail -f /tmp/prizepicks_cron.log

# Or check the log file location you specified in crontab
cat /tmp/prizepicks_cron.log
```

### Check Cron Status

```bash
# List all cron jobs
crontab -l

# Check if cron daemon is running (macOS)
sudo launchctl list | grep cron

# Check if cron daemon is running (Linux)
systemctl status cron
```

### Monitor Firestore

- **Firestore Console:** [Console](https://console.firebase.google.com/project/prizepicksproject-15337/firestore)
- Check the `preproccessed_data/prizepicks/` collection to verify data is being uploaded

## Performance

**Typical run time:** 3-5 minutes for ~3,000-7,000 projections

**Optimization:** Uses Firestore batch writes (500 operations per batch)
- **Without batching:** ~12 minutes for 7,000 records
- **With batching:** ~3 minutes for 7,000 records
- **~4x speed improvement**

**Cost:** Each execution costs ~$0.000004 (essentially free for daily runs)

## API Parameters

The PrizePicks API is called with:

```python
URL = "https://api.prizepicks.com/projections"
PARAMS = {
    "league_id": "7",          # NBA
    "single_stat": "true",     # Includes both single stat and combo
    "in_game": "true",         # Today's games only
    "state_code": "CA",        # California
    "game_mode": "prizepools"  # PrizePools mode
}
```

## Code Structure

```
prizepicks_fetch_fn/
├── main.py                 # Core fetch & upload logic
├── local_runner.py         # Local execution entry point
├── run_prizepicks.sh       # Shell script for cron job
├── requirements.txt        # Python dependencies
├── README.md              # This file
└── DEPLOYMENT.md          # (Legacy) Previous Cloud Function deployment guide
```

### Key Functions

- `fetch_and_upload_all_prizepicks(event)`: Main entry point (processes all leagues)
- `fetch_prizepicks_data(league_id)`: Fetches data from PrizePicks API for a specific league
- `sanitize_category(label)`: Cleans category names for Firestore
- `bet_type_from_odds(odds_type)`: Converts odds type to bet type
- `extract_game_date(start_time)`: Extracts date from ISO timestamp
- `build_player_lookup(included_list)`: Maps player IDs to names
- `sanitize_firestore_path_component(value)`: Makes IDs Firestore-safe

## Related Automated Jobs

Your project has automated jobs running in different environments:

1. **`prizepicks_fetch`** (this script - **Local Cron**)
   - Runs: Daily at 12:05 AM PT (via local cron)
   - Purpose: Fetch & upload PrizePicks betting lines (multi-league)
   - **Why local?** PrizePicks blocks cloud provider IPs (see "Why Local Cron" section above)

2. **`update_injury_report`** (injury_report_fn - **Cloud Function**)
   - Runs: Hourly (via Cloud Scheduler)
   - Purpose: Update NBA injury reports
   - **Why cloud?** Injury report scraping works fine from cloud IPs

## Troubleshooting

### Script Fails to Run

```bash
# Check for syntax errors
python3 local_runner.py

# Validate requirements.txt
pip install -r requirements.txt

# Check Firebase credentials
echo $GOOGLE_APPLICATION_CREDENTIALS
```

### No Data Uploaded

Check logs for:
- API fetch failures (network issues, IP blocking)
- Empty data returned (no games scheduled)
- Firestore permission errors
- Missing Firebase credentials

**View logs:**
```bash
tail -f /tmp/prizepicks_cron.log
```

**Common issues:**
- **4xx errors from PrizePicks:** If you see blocked/access denied errors, ensure you're running from a residential IP (not a VPN or cloud server)
- **Firebase auth errors:** Verify `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- **Python path issues:** Ensure your virtual environment is activated in the cron script

### Cron Job Not Running

```bash
# Check if cron job is scheduled
crontab -l

# Verify cron daemon is running (macOS)
sudo launchctl list | grep cron

# Verify cron daemon is running (Linux)
systemctl status cron

# Test the script manually first
cd /path/to/prizepicks_fetch_fn
source venv/bin/activate
python local_runner.py
```

### IP Blocking Issues

If you're still getting blocked:
- Ensure you're running from a residential IP (not a VPN)
- Check your IP: `curl ifconfig.me`
- PrizePicks may have rate limiting - if running multiple times, add delays between requests

## Security

- ✅ Local execution (no public endpoints)
- ✅ No external authentication tokens needed
- ✅ Firestore permissions via service account JSON
- ✅ Read-only external API (PrizePicks public endpoint)
- ⚠️ **Keep service account JSON secure** - never commit to git (should be in `.gitignore`)

## Cost Estimate

**Daily execution:**
- Local execution: $0 (runs on your machine)
- Firestore writes: ~7,000 writes × $0.18 per million = $0.001
- Network: Minimal (API response)

**Monthly cost:** < $1.00 (just Firestore writes)

**Note:** No cloud function costs since this runs locally

## Migration from Cloud Function

This script was previously deployed as a Google Cloud Function but was migrated to a local cron job due to PrizePicks blocking cloud provider IPs. The core logic remains the same - only the execution environment changed.

For historical reference on the previous Cloud Function deployment, see:
📖 **[DEPLOYMENT.md](./DEPLOYMENT.md)** (legacy documentation)

## Support

For issues or questions:
- Check cron execution logs (`/tmp/prizepicks_cron.log` or your specified log file)
- Verify Firestore structure matches expected schema
- Confirm cron job is scheduled and running
- Review API response for data issues or IP blocking
- Test manually first: `python local_runner.py`
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for legacy Cloud Function troubleshooting (reference only)

