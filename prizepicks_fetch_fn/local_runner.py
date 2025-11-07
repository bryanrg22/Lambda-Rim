# local_runner.py
"""
Run the multi-league PrizePicks fetch + Firestore upload logic locally.

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
    python local_runner.py
"""

import main  # the file above

def main_local():
    print("🏃 Running multi-league prizepicks_fetch job locally...")
    # Cloud Function handler expects an event, but doesn't use it.
    main.fetch_and_upload_all_prizepicks(None)

if __name__ == "__main__":
    main_local()
