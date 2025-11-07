import functions_framework
import firebase_admin
from firebase_admin import firestore
import requests
import re
from collections import defaultdict

# ---------- CONFIG ----------

LEAGUES = {
    "NBA":    {"league_id": "7"},
    "NFL":    {"league_id": "9"},
    "SOCCER": {"league_id": "82"},
    "NHL":    {"league_id": "8"},
    "CFB":    {"league_id": "15"},
    "CBB":    {"league_id": "20"},
}

PRIZEPICKS_URL = "https://api.prizepicks.com/projections"

# ---------- FIREBASE INIT ----------

firebase_admin.initialize_app()
db = firestore.client()


# ---------- HELPERS ----------

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


def fetch_prizepicks_data(league_id: str):
    """Fetch PrizePicks data for a given league_id."""
    params = {
        "league_id": league_id,
        "single_stat": "true",
        "in_game": "true",
        "state_code": "CA",
        "game_mode": "prizepools",
    }
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
    }

    try:
        resp = requests.get(PRIZEPICKS_URL, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
        if "application/json" in resp.headers.get("content-type", ""):
            return resp.json()
        print("Non-JSON response")
        return None
    except Exception as e:
        print(f"Error fetching data for league_id={league_id}: {str(e)}")
        return None


# ---------- CORE PER-LEAGUE PIPELINE ----------

def process_league(league_name: str, league_id: str):
    """
    Fetch, process, and upload data for one league.
    league_name: e.g. "NBA"
    league_id:   e.g. "7"
    """
    import time
    start_time = time.time()

    print(f"\n==============================")
    print(f"🏈🎯 Processing league {league_name} (league_id={league_id})")
    print(f"==============================")

    sanitized_categories_seen = set()
    raw_categories_seen = set()

    # Fetch
    payload = fetch_prizepicks_data(league_id)
    if not payload:
        print(f"❌ Failed to fetch data for {league_name}. Skipping.")
        return

    projection_count = len(payload.get("data", []))
    print(f"✅ Fetched {projection_count} projections")

    # Process
    print("\n🔄 Processing projections...")
    players = build_player_lookup(payload.get("included", []))

    organized_data = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    player_meta = defaultdict(dict)

    for obj in payload.get("data", []):
        attrs = obj.get("attributes", {}) or {}
        rels = obj.get("relationships", {}) or {}

        cat_label = attrs.get("stat_type") or "Unknown"
        category = sanitize_category(cat_label)

        raw_categories_seen.add(cat_label)
        sanitized_categories_seen.add(category)

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
        player_meta[game_date][player_key] = player_name

        record = {
            "bet_type": bet_type,
            "odds_type": odds_type,
            "projection_type": projection_type,
        }

        organized_data[game_date][player_key][category].append((line_score, record))

    # Upload
    print("\n☁️  Uploading to Firestore...")
    base_ref = (
        db.collection("preproccessed_data")
          .document("prizepicks")
          .collection("leagues")
          .document(league_name)
    )

    total_uploaded = 0
    total_game_dates = len(organized_data)
    print(f"📊 Found {total_game_dates} unique game date(s) to process for {league_name}")

    for game_date, players_dict in organized_data.items():
        print(f"   Processing game_date: {game_date}")
        print(f"   {game_date} has {len(players_dict)} players before upload")
        date_ref = base_ref.collection(game_date)

        batch = db.batch()
        batch_count = 0

        for player_key, categories_dict in players_dict.items():
            player_name = player_meta.get(game_date, {}).get(player_key, player_key)
            player_doc_ref = date_ref.document(player_key)
            batch.set(
                player_doc_ref,
                {
                    "player_name": player_name,
                    "league": league_name,
                    "game_date": game_date,
                },
                merge=True,
            )
            batch_count += 1

            for category, records in categories_dict.items():
                dedup_records = {}
                for line_score, record in records:
                    line_score_str = str(line_score)
                    dedup_records[line_score_str] = record

                category_ref = player_doc_ref.collection(category)
                for line_score_str, record in dedup_records.items():
                    doc_ref = category_ref.document(line_score_str)
                    batch.set(doc_ref, record)
                    total_uploaded += 1
                    batch_count += 1

                    if batch_count >= 500:
                        batch.commit()
                        batch = db.batch()
                        batch_count = 0

        if batch_count > 0:
            batch.commit()

        records_for_date = sum(
            len(records)
            for players_by_cat in players_dict.values()
            for records in players_by_cat.values()
        )
        print(f"   ✅ Completed {game_date}: {records_for_date} records")

    elapsed_time = time.time() - start_time
    print(f"\n✅ {league_name}: Uploaded {total_uploaded} documents in {elapsed_time:.2f}s")


# ---------- CLOUD FUNCTION ENTRYPOINT ----------

@functions_framework.cloud_event
def fetch_and_upload_all_prizepicks(event):
    import time

    overall_start = time.time()

    # Turn dict into list so we know how many total leagues we have
    league_items = list(LEAGUES.items())
    total = len(league_items)

    for idx, (league_name, cfg) in enumerate(league_items, start=1):
        process_league(league_name, cfg["league_id"])

        # After every league, pause 10s (except after the last batch)
        print(f"⏸️  Finished {league_name}, sleeping 30s to avoid rate limits...")
        time.sleep(30)

    overall_elapsed = time.time() - overall_start
    print(f"\n⏱️ Finished all leagues in {overall_elapsed:.2f}s")
