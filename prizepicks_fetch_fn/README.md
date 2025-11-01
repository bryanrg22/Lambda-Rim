# PrizePicks Daily Fetch Cloud Function

Automated Cloud Function that fetches live PrizePicks NBA betting data and uploads it to Firestore daily at 12:05 AM Pacific Time.

## Overview

This Cloud Function:
1. ✅ Fetches live PrizePicks data from their public API
2. ✅ Processes and organizes data by game date, player, category, and line score
3. ✅ Uploads to Firestore with batched writes (optimized for speed)
4. ✅ Runs automatically via Cloud Scheduler

## Firestore Structure

```
/preproccessed_data/prizepicks/{game_date}/{player_name}/{category}/{line_score}
```

**Document fields:**
- `bet_type`: "More/Less" or "More-only"
- `odds_type`: "standard", "goblin", "demon", etc.
- `projection_type`: "Single Stat", "Combo", etc.

**Document ID:** The `line_score` value (e.g., "25.5")

## Configuration

**Runtime:** Python 3.11  
**Region:** us-west2  
**Trigger:** Pub/Sub topic `prizepicks-fetch-daily`  
**Schedule:** Daily at 12:05 AM Pacific Time (America/Los_Angeles)  
**Function Name:** `prizepicks_fetch`  
**Entry Point:** `fetch_and_upload_prizepicks`

## Quick Start

### Deploy (Already Complete)

```bash
cd prizepicks_fetch_fn

gcloud functions deploy prizepicks_fetch \
  --gen2 \
  --region us-west2 \
  --runtime python311 \
  --source . \
  --entry-point fetch_and_upload_prizepicks \
  --trigger-topic prizepicks-fetch-daily
```

### Test Manually

```bash
# Publish test message
gcloud pubsub topics publish prizepicks-fetch-daily --message='{"manual": true}'

# View logs
gcloud functions logs read prizepicks_fetch --gen2 --region us-west2 --limit 50
```

## Monitoring

### View Logs

```bash
# Recent logs
gcloud functions logs read prizepicks_fetch --gen2 --region us-west2 --limit 50

# Real-time logs
gcloud functions logs tail prizepicks_fetch --gen2 --region us-west2
```

### Check Status

```bash
# List functions
gcloud functions list --gen2 --region us-west2

# View function details
gcloud functions describe prizepicks_fetch --gen2 --region us-west2

# Check scheduler job
gcloud scheduler jobs describe prizepicks-fetch-daily --location us-west2
```

### Monitor in Console

- **Cloud Functions:** [Console](https://console.cloud.google.com/functions?project=prizepicksproject-15337)
- **Cloud Scheduler:** [Console](https://console.cloud.google.com/cloudscheduler?project=prizepicksproject-15337)
- **Firestore:** [Console](https://console.firebase.google.com/project/prizepicksproject-15337/firestore)
- **Logs:** [Cloud Logging](https://console.cloud.google.com/logs?project=prizepicksproject-15337)

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
├── main.py                 # Cloud Function entry point
├── requirements.txt        # Python dependencies
├── README.md              # This file
└── DEPLOYMENT.md          # Deployment guide & how to create new functions
```

### Key Functions

- `fetch_and_upload_prizepicks(event)`: Main entry point (Cloud Function)
- `fetch_prizepicks_data()`: Fetches data from PrizePicks API
- `sanitize_category(label)`: Cleans category names for Firestore
- `bet_type_from_odds(odds_type)`: Converts odds type to bet type
- `extract_game_date(start_time)`: Extracts date from ISO timestamp
- `build_player_lookup(included_list)`: Maps player IDs to names
- `sanitize_firestore_path_component(value)`: Makes IDs Firestore-safe

## Related Cloud Functions

Your project has two automated Cloud Functions:

1. **`prizepicks_fetch`** (this function)
   - Runs: Daily at 12:05 AM PT
   - Purpose: Fetch & upload PrizePicks betting lines

2. **`update_injury_report`** (injury_report_fn)
   - Runs: Hourly
   - Purpose: Update NBA injury reports

## Troubleshooting

### Function Fails to Deploy

```bash
# Check for syntax errors
python3 prizepicks_fetch_fn/main.py

# Validate requirements.txt
pip install -r prizepicks_fetch_fn/requirements.txt
```

### Function Times Out

**Default timeout:** 60 seconds  
**Increase if needed:**

```bash
gcloud functions deploy prizepicks_fetch \
  --gen2 \
  --region us-west2 \
  --timeout 540s \
  --source . \
  --entry-point fetch_and_upload_prizepicks \
  --trigger-topic prizepicks-fetch-daily
```

### No Data Uploaded

Check logs for:
- API fetch failures (network issues)
- Empty data returned (no games scheduled)
- Firestore permission errors

**View logs:**
```bash
gcloud functions logs read prizepicks_fetch --gen2 --region us-west2 --limit 100
```

### Scheduler Job Not Running

```bash
# Check job is enabled
gcloud scheduler jobs describe prizepicks-fetch-daily \
  --location us-west2 \
  --format="value(state)"

# Enable if disabled
gcloud scheduler jobs resume prizepicks-fetch-daily --location us-west2
```

## Security

- ✅ Cloud Function requires Pub/Sub trigger (no public HTTP access)
- ✅ No external authentication tokens needed
- ✅ Firestore permissions inherited from service account
- ✅ Read-only external API (PrizePicks public endpoint)

## Cost Estimate

**Daily execution:**
- Function execution: ~$0.000004 (essentially free)
- Firestore writes: ~7,000 writes × $0.18 per million = $0.001
- Network egress: Minimal (API response)

**Monthly cost:** < $1.00

**Free Tier:** 2 million invocations/month free

## Deployment Guide

For detailed deployment instructions and how to create NEW Cloud Functions, see:
📖 **[DEPLOYMENT.md](./DEPLOYMENT.md)**

## Support

For issues or questions:
- Check Cloud Function logs
- Verify Firestore structure matches expected schema
- Confirm Cloud Scheduler job is enabled
- Review API response for data issues
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for troubleshooting

