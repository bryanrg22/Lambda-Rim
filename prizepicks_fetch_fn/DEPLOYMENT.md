# Deployment Guide: PrizePicks Daily Fetch Cloud Function

Complete guide to deploy Cloud Functions using the `gcloud` CLI method.

## Prerequisites

✅ GCP Project: `prizepicksproject-15337`  
✅ gcloud CLI installed and authenticated  
✅ Region: `us-west2`

## Current Function Deployment

**Function Name:** `prizepicks_fetch`  
**Region:** `us-west2`  
**Runtime:** Python 3.11  
**Trigger:** Pub/Sub topic `prizepicks-fetch-daily`  
**Schedule:** Daily at 12:05 AM Pacific Time

## Deployment Steps (Already Completed)

### Step 1: Enable Required APIs

```bash
gcloud config set project prizepicksproject-15337
gcloud services enable pubsub.googleapis.com cloudfunctions.googleapis.com cloudscheduler.googleapis.com
```

### Step 2: Create Pub/Sub Topic

```bash
gcloud pubsub topics create prizepicks-fetch-daily
```

### Step 3: Deploy the Cloud Function

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

**What this does:**
- Creates a Gen2 Cloud Function in `us-west2`
- Uses Python 3.11 runtime
- Deploys from current directory (`.`)
- Entry point is the `fetch_and_upload_prizepicks` function in `main.py`
- Triggers when messages are published to `prizepicks-fetch-daily` topic

### Step 4: Create Cloud Scheduler Job

```bash
gcloud scheduler jobs create pubsub prizepicks-fetch-daily \
  --location us-west2 \
  --schedule "5 0 * * *" \
  --time-zone "America/Los_Angeles" \
  --topic prizepicks-fetch-daily \
  --message-body '{}'
```

**Schedule Explanation:**
- `5 0 * * *` = 12:05 AM every day
- Uses Pacific Time zone (America/Los_Angeles)
- Publishes to the `prizepicks-fetch-daily` topic

### Step 5: Test the Function

```bash
# Manual trigger via Pub/Sub
gcloud pubsub topics publish prizepicks-fetch-daily --message='{"manual": true}'

# View logs
gcloud functions logs read prizepicks_fetch --gen2 --region us-west2 --limit 100

# OR trigger via Scheduler
gcloud scheduler jobs run prizepicks-fetch-daily --location us-west2
```

## Creating NEW Cloud Functions (Guide)

Follow this template to create additional Cloud Functions:

### 1. Set Up Your Function Directory

```bash
# Create a new function directory
mkdir my_new_function
cd my_new_function

# Create main.py with your function code
# Must include the entry point function
```

**main.py Template:**

```python
import functions_framework
import firebase_admin
from firebase_admin import firestore

# Initialize Firebase Admin (if needed)
firebase_admin.initialize_app()
db = firestore.client()

@functions_framework.cloud_event
def my_function_name(event):
    """Your Cloud Function entry point."""
    print("Function started")
    
    # Your logic here
    data = event.data.get('data', {})
    
    # Process data...
    
    print("Function completed")
```

### 2. Create requirements.txt

```bash
firebase-functions
firebase-admin
functions-framework
# Add other dependencies as needed
```

### 3. Create .gcloudignore (Important!)

Create `.gcloudignore` to exclude unnecessary files from deployment:

```bash
venv/
__pycache__/
*.pyc
.DS_Store
*.local
.git/
```

This reduces deployment size and speeds up uploads.

### 4. Enable Required APIs

```bash
gcloud config set project prizepicksproject-15337
gcloud services enable pubsub.googleapis.com cloudfunctions.googleapis.com cloudscheduler.googleapis.com
```

### 5. Create Pub/Sub Topic (for scheduled triggers)

```bash
# Choose a descriptive topic name
gcloud pubsub topics create my-function-topic
```

### 6. Deploy the Function

```bash
gcloud functions deploy my_function_name \
  --gen2 \
  --region us-west2 \
  --runtime python311 \
  --source . \
  --entry-point my_function_name \
  --trigger-topic my-function-topic
```

**Parameters:**
- `my_function_name`: Cloud Function name (choose descriptive)
- `--region us-west2`: Always use us-west2
- `--runtime python311`: Python version
- `--source .`: Source directory (current folder)
- `--entry-point my_function_name`: Function name in main.py
- `--trigger-topic my-function-topic`: Pub/Sub topic to trigger on

### 7. Create Scheduler Job (if needed)

```bash
gcloud scheduler jobs create pubsub my-function-daily \
  --location us-west2 \
  --schedule "0 0 * * *" \
  --time-zone "America/Los_Angeles" \
  --topic my-function-topic \
  --message-body '{}'
```

**Schedule Examples:**
- `0 0 * * *` = Midnight daily
- `5 0 * * *` = 12:05 AM daily
- `0 */4 * * *` = Every 4 hours
- `0 0 * * 1` = Monday at midnight

### 8. Test Your Function

```bash
# Publish test message
gcloud pubsub topics publish my-function-topic --message='{"test": true}'

# View logs
gcloud functions logs read my_function_name --gen2 --region us-west2 --limit 50

# Run scheduler manually
gcloud scheduler jobs run my-function-daily --location us-west2
```

## Common Commands

### List All Functions

```bash
gcloud functions list --gen2 --region us-west2
```

### View Function Details

```bash
gcloud functions describe prizepicks_fetch --gen2 --region us-west2
```

### View Logs

```bash
# Recent logs
gcloud functions logs read prizepicks_fetch --gen2 --region us-west2 --limit 50

# Tail logs (real-time)
gcloud functions logs tail prizepicks_fetch --gen2 --region us-west2
```

### List All Scheduler Jobs

```bash
gcloud scheduler jobs list --location us-west2
```

### Update Existing Function

```bash
# After making code changes
cd prizepicks_fetch_fn

gcloud functions deploy prizepicks_fetch \
  --gen2 \
  --region us-west2 \
  --runtime python311 \
  --source . \
  --entry-point fetch_and_upload_prizepicks \
  --trigger-topic prizepicks-fetch-daily
```

### Delete Function

```bash
# Delete function and trigger
gcloud functions delete prizepicks_fetch --gen2 --region us-west2

# Delete scheduler job
gcloud scheduler jobs delete prizepicks-fetch-daily --location us-west2

# Delete Pub/Sub topic (optional)
gcloud pubsub topics delete prizepicks-fetch-daily
```

## Trigger Types

### 1. Pub/Sub Trigger (Current Method)

Best for scheduled or event-driven functions.

```bash
gcloud functions deploy my_function \
  --gen2 \
  --trigger-topic my-topic
```

**Triggers when:** Messages published to the topic

### 2. HTTP Trigger

Best for on-demand API endpoints.

```bash
gcloud functions deploy my_function \
  --gen2 \
  --trigger-http \
  --allow-unauthenticated
```

**Triggers when:** HTTP POST request to function URL

### 3. Cloud Storage Trigger

Best for file processing.

```bash
gcloud functions deploy my_function \
  --gen2 \
  --trigger-bucket my-bucket
```

**Triggers when:** Files uploaded to bucket

## Monitoring & Debugging

### View Function Status

```bash
gcloud functions describe prizepicks_fetch --gen2 --region us-west2 --format="value(state, updateTime)"
```

### Check Recent Executions

```bash
gcloud functions logs read prizepicks_fetch --gen2 --region us-west2 --limit 20
```

### Increase Timeout (if needed)

Functions default to 60 seconds. To increase:

```bash
gcloud functions deploy prizepicks_fetch \
  --gen2 \
  --region us-west2 \
  --timeout 540s \
  --source . \
  --entry-point fetch_and_upload_prizepicks \
  --trigger-topic prizepicks-fetch-daily
```

Maximum: 540 seconds (9 minutes) for HTTP, 60 minutes for background functions.

### Increase Memory (if needed)

```bash
gcloud functions deploy prizepicks_fetch \
  --gen2 \
  --region us-west2 \
  --memory 512MB \
  --source . \
  --entry-point fetch_and_upload_prizepicks \
  --trigger-topic prizepicks-fetch-daily
```

Default: 256MB. Available: 128MB, 256MB, 512MB, 1GB, 2GB, 4GB, 8GB.

## Troubleshooting

### Function Deploy Fails

**Error:** "Module not found"
```bash
# Check requirements.txt
cat requirements.txt

# Verify all dependencies are listed
pip install -r requirements.txt
```

### Function Times Out

**Solution:** Increase timeout
```bash
gcloud functions deploy prizepicks_fetch \
  --gen2 \
  --timeout 540s \
  # ... other parameters
```

### Scheduler Not Triggering

**Check scheduler job status:**
```bash
gcloud scheduler jobs describe prizepicks-fetch-daily --location us-west2
```

**Verify job is enabled:**
```bash
gcloud scheduler jobs list --location us-west2 --filter="state:ENABLED"
```

### No Logs Appearing

**Wait 30-60 seconds** after execution for logs to appear.

**Check correct function name:**
```bash
gcloud functions list --gen2 --region us-west2
```

**View all logs:**
```bash
gcloud logging read "resource.type=cloud_function" --limit 50
```

## Cost Optimization

### Function Configuration

- **Memory:** Use minimum required (256MB default)
- **Timeout:** Set realistic timeout based on execution time
- **Region:** Always use `us-west2` for consistency

### Free Tier (Daily)

- **2 million invocations** free per month
- **400,000 GB-seconds** compute time free
- **200,000 GHz-seconds** compute time free

### Estimated Costs (Beyond Free Tier)

- **Invocations:** $0.40 per million
- **Compute:** $0.0000025 per GB-second
- **Memory:** Included in compute

## Best Practices

1. **Use meaningful function names** - descriptive and consistent
2. **Keep functions focused** - single responsibility
3. **Add logging** - use `print()` for debugging
4. **Handle errors gracefully** - try/except blocks
5. **Test locally** when possible before deploying
6. **Use environment variables** for secrets (not hardcoded)
7. **Batch Firestore writes** for performance (500 operations max)
8. **Set appropriate timeouts** based on expected execution time
9. **Monitor regularly** via Cloud Console or CLI
10. **Version control** your function code

## Current Project Functions

Your project has the following Cloud Functions:

1. **`prizepicks_fetch`** (PrizePicks Daily Fetch)
   - Region: `us-west2`
   - Runtime: Python 3.11
   - Trigger: Pub/Sub (`prizepicks-fetch-daily`)
   - Schedule: Daily 12:05 AM PT
   - Purpose: Fetch & upload PrizePicks betting lines

2. **`update_injury_report`** (via Firebase)
   - Region: `us-west2`
   - Runtime: Python 3.11
   - Trigger: Pub/Sub (hourly)
   - Purpose: Update NBA injury reports

## Need Help?

- **Cloud Functions Docs:** [Official Guide](https://cloud.google.com/functions/docs)
- **Scheduler Docs:** [Cloud Scheduler Guide](https://cloud.google.com/scheduler/docs)
- **Python Runtime:** [Python Functions Guide](https://cloud.google.com/functions/docs/concepts/python-runtime)
- **Function Console:** [Cloud Functions Console](https://console.cloud.google.com/functions?project=prizepicksproject-15337)
- **Logging Console:** [Cloud Logging Console](https://console.cloud.google.com/logs?project=prizepicksproject-15337)
- **GCP Status:** [Status Dashboard](https://status.cloud.google.com/)
