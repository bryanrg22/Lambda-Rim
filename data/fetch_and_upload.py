#!/usr/bin/env python3
"""
Complete PrizePicks data pipeline: Fetch from API → Upload to Firestore

This script:
1. Fetches live PrizePicks data from the API
2. Uploads to Firestore with batched writes for optimal performance
3. Provides detailed progress tracking and timing information

Usage:
    python3 fetch_and_upload.py              # Fetch and upload live data
    python3 fetch_and_upload.py --save       # Also save JSON to file
"""

import argparse
import json
import pathlib
import re
import sys
import time
from collections import defaultdict
from datetime import datetime

# External imports
import firebase_admin
from firebase_admin import firestore
import requests


def init_firestore():
    """
    Initialize the Firestore client.
    Locally: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON.
    """
    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        return firestore.client()
    except Exception as e:
        print("\n❌ Error initializing Firebase:")
        print(f"   {str(e)}")
        print("\n💡 Tip: Make sure you have:")
        print("   1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
        print("   2. Installed firebase-admin: pip install firebase-admin")
        print("\n   Example: export GOOGLE_APPLICATION_CREDENTIALS='/path/to/serviceAccountKey.json'")
        sys.exit(1)


def fetch_prizepicks_data():
    """
    Fetch PrizePicks data from the API.
    Returns the JSON payload or None on error.
    """
    URL = "https://api.prizepicks.com/projections"
    PARAMS = {
        "league_id": "7",
        "single_stat": "true",
        "in_game": "true",
        "state_code": "CA",
        "game_mode": "prizepools",
    }
    
    HEADERS = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
    }
    
    try:
        resp = requests.get(URL, params=PARAMS, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        
        if "application/json" in resp.headers.get("content-type", ""):
            return resp.json()
        else:
            print("Non-JSON response:")
            print(resp.text[:1000])
            return None
    except Exception as e:
        print(f"❌ Error fetching data: {str(e)}")
        return None


def sanitize_category(label: str) -> str:
    """
    Create a filesystem-friendly name from category label.
    Examples:
      "Pts" -> "pts"
      "Pts+Rebs+Asts" -> "pts_rebs_asts"
      "3-PT Made" -> "3_pt_made"
    """
    label = label.strip().lower()
    label = label.replace("+", "_plus_")
    label = re.sub(r"[\s/+-]+", "_", label)
    label = label.replace("__", "_")
    label = re.sub(r"[^a-z0-9_]", "", label)
    label = label.replace("_plus_", "_")
    return label.strip("_") or "unknown"


def bet_type_from_odds(odds_type):
    if odds_type == "standard":
        return "More/Less"
    if odds_type in {"goblin", "demon"}:
        return "More-only"
    return f"Unknown ({odds_type})" if odds_type else "Unknown"


def extract_game_date(start_time):
    """Extract just the date (YYYY-MM-DD) from ISO datetime string."""
    if not start_time:
        return None
    parts = start_time.split("T")
    if parts:
        return parts[0]
    return None


def build_player_lookup(included_list):
    """Map new_player.id -> display_name (fallback to name)."""
    by_id = {}
    for inc in included_list or []:
        if inc.get("type") == "new_player":
            attrs = inc.get("attributes", {}) or {}
            name = attrs.get("display_name") or attrs.get("name") or "Unknown"
            by_id[inc.get("id")] = name
    return by_id


def sanitize_firestore_path_component(value: str) -> str:
    """Sanitize a value to be used as a Firestore document/collection ID."""
    sanitized = value.lower().replace(" ", "_")
    sanitized = re.sub(r"[^a-z0-9_]", "", sanitized)
    return sanitized or "unknown"


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Fetch PrizePicks data and upload to Firestore')
    parser.add_argument('--save', action='store_true',
                       help='Save the fetched JSON to a file')
    args = parser.parse_args()
    
    # Start timing
    start_time = time.time()
    print("=" * 70)
    print("🚀 PrizePicks Data Pipeline: Fetch → Upload")
    print("=" * 70)
    print(f"\n⏱️  Starting at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Fetch data from API
    print("\n" + "=" * 70)
    print("📡 STEP 1: Fetching data from PrizePicks API...")
    print("=" * 70)
    checkpoint = time.time()
    
    payload = fetch_prizepicks_data()
    if not payload:
        print("\n❌ Failed to fetch data. Exiting.")
        sys.exit(1)
    
    elapsed = time.time() - checkpoint
    projection_count = len(payload.get('data', []))
    print(f"\n✅ Successfully fetched {projection_count} projections in {elapsed:.2f} seconds")
    
    # Optionally save to file
    if args.save:
        output_file = f"prizepicks_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved to: {output_file}")
    
    # Step 2: Initialize Firestore
    print("\n" + "=" * 70)
    print("☁️  STEP 2: Initializing Firestore client...")
    print("=" * 70)
    checkpoint = time.time()
    db = init_firestore()
    print(f"✅ Initialized in {time.time() - checkpoint:.2f} seconds")
    
    # Step 3: Process data
    print("\n" + "=" * 70)
    print("🔄 STEP 3: Processing projections...")
    print("=" * 70)
    checkpoint = time.time()
    
    players = build_player_lookup(payload.get("included", []))
    organized_data = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    
    for obj in payload.get("data", []):
        attrs = obj.get("attributes", {}) or {}
        rels = obj.get("relationships", {}) or {}
        
        cat_label = attrs.get("stat_type") or "Unknown"
        category = sanitize_category(cat_label)
        
        player_rel = (rels.get("new_player") or {}).get("data") or {}
        player_id = player_rel.get("id")
        player_name = players.get(player_id, f"Unknown-{player_id}")
        
        line_score = attrs.get("line_score")
        if line_score is None:
            continue
        
        try:
            line_score = float(line_score)
        except Exception:
            continue
        
        odds_type = attrs.get("odds_type")
        bet_type = bet_type_from_odds(odds_type)
        projection_type = attrs.get("projection_type")
        game_date = extract_game_date(attrs.get("start_time"))
        
        if not game_date:
            continue
        
        player_key = sanitize_firestore_path_component(player_name)
        
        record = {
            "bet_type": bet_type,
            "odds_type": odds_type,
            "projection_type": projection_type,
        }
        
        organized_data[game_date][player_key][category].append((line_score, record))
    
    elapsed = time.time() - checkpoint
    print(f"✅ Processed in {elapsed:.2f} seconds")
    
    # Step 4: Upload to Firestore
    print("\n" + "=" * 70)
    print("☁️  STEP 4: Uploading to Firestore...")
    print("=" * 70)
    checkpoint = time.time()
    
    base_ref = db.collection("preproccessed_data").document("prizepicks")
    total_uploaded = 0
    total_game_dates = len(organized_data)
    
    print(f"\n📊 Found {total_game_dates} unique game date(s) to process")
    
    for idx, (game_date, players_dict) in enumerate(organized_data.items(), 1):
        game_date_start = time.time()
        print(f"\n[{idx}/{total_game_dates}] Processing game_date: {game_date}")
        date_ref = base_ref.collection(game_date)
        
        # Create a batch for this game_date
        batch = db.batch()
        batch_count = 0
        
        for player_key, categories_dict in players_dict.items():
            for category, records in categories_dict.items():
                # De-duplicate records (same line_score)
                dedup_records = {}
                for line_score, record in records:
                    line_score_str = str(line_score)
                    dedup_records[line_score_str] = record
                
                # Add each unique line_score to the batch
                category_ref = date_ref.document(player_key).collection(category)
                for line_score_str, record in dedup_records.items():
                    doc_ref = category_ref.document(line_score_str)
                    batch.set(doc_ref, record)
                    total_uploaded += 1
                    batch_count += 1
                    
                    # Firestore batch limit is 500 operations
                    if batch_count >= 500:
                        batch.commit()
                        batch = db.batch()
                        batch_count = 0
        
        # Commit remaining operations in the batch
        if batch_count > 0:
            batch.commit()
        
        game_date_elapsed = time.time() - game_date_start
        records_for_date = sum(len(records) for players in players_dict.values() for records in players.values())
        print(f"   ✅ Uploaded {records_for_date} records for {game_date} in {game_date_elapsed:.2f} seconds")
    
    upload_elapsed = time.time() - checkpoint
    total_elapsed = time.time() - start_time
    
    # Final summary
    print("\n" + "=" * 70)
    print("🎉 SUCCESS! Upload Complete")
    print("=" * 70)
    print(f"\n📊 Summary:")
    print(f"   • Projections fetched: {projection_count}")
    print(f"   • Documents uploaded: {total_uploaded}")
    print(f"   • Unique game dates: {total_game_dates}")
    
    print(f"\n⏱️  Timing Summary:")
    print(f"   • Fetch time: {elapsed:.2f} seconds")
    print(f"   • Upload time: {upload_elapsed:.2f} seconds ({upload_elapsed/60:.2f} minutes)")
    print(f"   • Total time: {total_elapsed:.2f} seconds ({total_elapsed/60:.2f} minutes)")
    print(f"   • Upload speed: {total_uploaded/upload_elapsed:.2f} docs/second")
    print(f"   • Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    print(f"\n📁 Firestore Structure:")
    print(f"   /preproccessed_data/prizepicks/{{game_date}}/{{player_name}}/{{category}}/{{line_score}}")
    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()

