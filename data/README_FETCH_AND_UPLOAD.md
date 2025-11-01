# Fetch & Upload PrizePicks Data

**All-in-one script** that fetches live PrizePicks data and uploads to Firestore in a single command.

## Prerequisites

1. **Install Python dependencies**:
   ```bash
   cd data
   pip install -r requirements.txt
   ```
   
   Or install individually:
   ```bash
   pip install firebase-admin requests
   ```

2. **Get Firebase Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `prizepicksproject-15337`
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file

3. **Set Environment Variable**:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
   ```

## Usage

### Basic Usage (Fetch & Upload Only)
```bash
python3 fetch_and_upload.py
```

This will:
1. ✅ Fetch live data from PrizePicks API
2. ✅ Process and organize data
3. ✅ Upload to Firestore with batched writes
4. ✅ Display detailed progress and timing

### Save to File (Optional Backup)
```bash
python3 fetch_and_upload.py --save
```

This does everything above PLUS saves the fetched JSON to a timestamped file:
- `prizepicks_2025-10-31_21-45-30.json`

## Output Structure

Each document in Firestore contains:
- `bet_type`: "More/Less" or "More-only"
- `odds_type`: "standard", "goblin", "demon", etc.
- `projection_type`: "Single Stat", "Combo", etc.

The document ID is the `line_score` value.

## Performance

- **Batch Writes**: Uses Firestore batch writes (500 operations per batch)
- **Optimized**: Uploads ~7000 records in **2-3 minutes**
- **No Intermediate Files**: Streams data directly from API to Firestore (unless using `--save`)

## Example Output

```
======================================================================
🚀 PrizePicks Data Pipeline: Fetch → Upload
======================================================================

⏱️  Starting at 2025-10-31 21:45:30

======================================================================
📡 STEP 1: Fetching data from PrizePicks API...
======================================================================

✅ Successfully fetched 6561 projections in 1.23 seconds

======================================================================
☁️  STEP 2: Initializing Firestore client...
======================================================================
✅ Initialized in 0.15 seconds

======================================================================
🔄 STEP 3: Processing projections...
======================================================================
✅ Processed in 0.45 seconds

======================================================================
☁️  STEP 4: Uploading to Firestore...
======================================================================

📊 Found 1 unique game date(s) to process

[1/1] Processing game_date: 2025-10-31
   ✅ Uploaded 6556 records for 2025-10-31 in 127.34 seconds

======================================================================
🎉 SUCCESS! Upload Complete
======================================================================

📊 Summary:
   • Projections fetched: 6561
   • Documents uploaded: 6556
   • Unique game dates: 1

⏱️  Timing Summary:
   • Fetch time: 1.23 seconds
   • Upload time: 127.34 seconds (2.12 minutes)
   • Total time: 129.17 seconds (2.15 minutes)
   • Upload speed: 51.44 docs/second
   • Completed at: 2025-10-31 21:47:39
```

## Troubleshooting

**Error: "Could not automatically determine credentials"**
- Make sure you've set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Verify the path to your service account JSON file is correct

**Error: "Failed to fetch data"**
- Check your internet connection
- Verify the PrizePicks API is accessible
- API might be rate-limiting or temporarily down

**Error: "Permission denied"**
- Check that your service account has Firestore write permissions
- Verify the service account JSON file is from the correct project

## Notes

- The script automatically de-duplicates records with the same (player, line_score, odds_type, category)
- Player names and categories are sanitized to be Firestore-safe (lowercase, underscores)
- Only projections with valid `line_score` and `game_date` are uploaded
- Uses `set()` which replaces existing documents with the same ID (idempotent operation)
- Safe to run multiple times - it will replace existing data with fresh data

## Comparison with Separate Scripts

| Method | Commands | Time | Intermediate Files |
|--------|----------|------|-------------------|
| **Old Way** | `prizepicks_fetch.py` → `upload_to_firestore.py` | ~13 minutes | ✅ prizepicks.json |
| **New Way** | `fetch_and_upload.py` | ~3 minutes | ❌ None (unless `--save`) |

The new unified script is **~4x faster** and **simpler to use**!

