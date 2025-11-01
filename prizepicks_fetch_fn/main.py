import functions_framework
import firebase_admin
from firebase_admin import firestore
import requests
import re
from collections import defaultdict

# Initialize Firebase Admin
firebase_admin.initialize_app()
db = firestore.client()


def sanitize_category(label: str) -> str:
    """Create a filesystem-friendly name from category label."""
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


def fetch_prizepicks_data():
    """Fetch PrizePicks data from the API."""
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
            print("Non-JSON response")
            return None
    except Exception as e:
        print(f"Error fetching data: {str(e)}")
        return None


@functions_framework.cloud_event
def fetch_and_upload_prizepicks(event):
    """
    Cloud Function triggered by Pub/Sub (via Cloud Scheduler).
    Fetches PrizePicks data and uploads to Firestore.
    """
    
    import time
    start_time = time.time()
    
    # Fetch data
    print("\n📡 Fetching data from PrizePicks API...")
    payload = fetch_prizepicks_data()
    if not payload:
        print("❌ Failed to fetch data. Exiting.")
        return
    
    projection_count = len(payload.get('data', []))
    print(f"✅ Fetched {projection_count} projections")
    
    # Process data
    print("\n🔄 Processing projections...")
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
    
    # Upload to Firestore
    print("\n☁️  Uploading to Firestore...")
    base_ref = db.collection("preproccessed_data").document("prizepicks")
    total_uploaded = 0
    total_game_dates = len(organized_data)
    
    print(f"📊 Found {total_game_dates} unique game date(s) to process")
    
    for game_date, players_dict in organized_data.items():
        print(f"   Processing game_date: {game_date}")
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
        
        # Log completion for this game date
        records_for_date = sum(len(records) for players in players_dict.values() for records in players.values())
        print(f"   ✅ Completed {game_date}: {records_for_date} records")
    
    elapsed_time = time.time() - start_time
    print(f"\n✅ Successfully uploaded {total_uploaded} documents to Firestore. Time: {elapsed_time:.2f}")