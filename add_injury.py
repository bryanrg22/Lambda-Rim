import requests
import pdfplumber
import tempfile
import re
import logging
from datetime import datetime, timedelta
import pytz

from nba_api.stats.endpoints import commonplayerinfo
from nba_api.stats.static import players


import firebase_admin
from firebase_admin import firestore
from datetime import datetime
import pytz
import logging
import nba_api
from nba_api.stats.endpoints import TeamGameLog
from nba_api.stats.endpoints import playergamelog
from nba_api.stats.static import teams
import requests
from nba_api.stats.library.parameters import SeasonAll

import time

# ----  GLOBAL CACHES  ---------------------------------------------------
_player_info_cache   = {}
_player_gamelog_df_cache = {}     # player_id  -> full pd.DataFrame
_team_gamelog_df_cache   = {}     # team_id    -> full pd.DataFrame

# ----  ONE SHARED HTTP SESSION WITH RETRY / BACK-OFF  -------------------
# -----------------------------------------------------------------------
#  Retry-and-back-off logic for every call nba_api makes
# -----------------------------------------------------------------------
from requests.adapters import HTTPAdapter, Retry
from nba_api.stats.library.http import NBAStatsHTTP

retry = Retry(
    total=6,                 # 6 attempts max
    backoff_factor=1.0,      # 1 s → 2 s → 4 s …
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)

# ---> 1.  Get the *global* session that all nba_api endpoints reuse
session = NBAStatsHTTP().get_session()      # <—  FIX: use get_session()

# ---> 2.  Attach our retry adapter once
session.mount("https://", HTTPAdapter(max_retries=retry))
session.mount("http://",  HTTPAdapter(max_retries=retry))

# ---> 3.  Increase the default request timeout for every endpoint
NBAStatsHTTP.TIMEOUT = 30   # seconds (default is 10)                  # seconds (default is 10)




# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_firestore():
    """
    Initialize the Firestore client.
    Locally: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON.
    In Cloud Run/Functions: no extra setup needed.
    """
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()





############################################
### RETRIEVE DATA FROM NBA INJURY REPORT ###
############################################

## HELPER FUNCTIONS ##

def _team_key(name: str) -> str:
    return name.lower().replace(" ", "_")

def split_camel_case(s: str) -> str:
    # Insert a space between a lowercase letter and an uppercase letter
    return re.sub(r'([a-z])([A-Z])', r'\1 \2', s)

def format_name(s: str) -> str:
    last, first = s.split(',', 1)
    full_name = f"{first.strip()} {last.strip()}"

    if full_name.endswith("Jr.") or full_name.endswith("Sr.") or full_name.endswith("III"):
        # Remove the suffix and add it back later
        full_name = full_name[:-3] + " " + full_name[-3:]
    elif full_name.endswith("II") or full_name.endswith("IV"):
        # Remove the suffix and add it back later
        full_name = full_name[:-2] + " " + full_name[-2:]

    return full_name

## MAIN FUNCTIONS ##

def get_injury_report_url(gameDate, gameTime):
    date_str = f"2025-{gameDate[0:2]}-{gameDate[3:5]}"
    hour_str = f"0{gameTime[0:1]}PM"
    return f"https://ak-static.cms.nba.com/referee/injury/Injury-Report_{date_str}_{hour_str}.pdf"
 

def get_full_injury_report(gameDate, gameTime):
    """
    Get the injury status for a specific player
    Returns a dictionary with status and reason if found, or None if not found
    """

    pdf_url = get_injury_report_url(gameDate, gameTime)

    try:
        resp = requests.get(pdf_url)
        resp.raise_for_status()
    except Exception as e:
        print(f"Error downloading the PDF: {e}")
        return {"error": f"Error downloading injury report: {str(e)}"}

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_pdf:
        tmp_pdf.write(resp.content)
        tmp_pdf.flush()

        try:
            with pdfplumber.open(tmp_pdf.name) as pdf:
                # These x-coordinates are just an example; replace with your measured values.
                x_positions = [23, 119, 199, 260, 420, 575, 660, 820]

                table_settings = {
                    "vertical_strategy": "explicit",
                    "horizontal_strategy": "lines",
                    "explicit_vertical_lines": x_positions,
                    "snap_tolerance": 3,
                    "join_tolerance": 3,
                    "text_x_tolerance": 3,
                    "text_y_tolerance": 3,
                }

                all_rows = []
                for page_index, page in enumerate(pdf.pages, start=1):
                    table = page.extract_table(table_settings) or []
                    for row in table:
                        all_rows.append(row)

        except Exception as parse_err:
            print(f"Error parsing PDF with pdfplumber: {parse_err}")
            return {"error": f"Error parsing injury report: {str(parse_err)}"}

    # Now we have all_rows from all pages
    current_team = ""
    current_game_date = ""
    current_game_time = ""
    players = []
    for row in all_rows:
        if len(row) < 7:
            continue
        game_date, game_time, matchup, team, player, status, reason = row[:7]

        if "t:" in player or "PlayerName" in player:
            continue

        clean_reason = reason.replace("\n", " ").strip() if reason else ""

        if game_date != None:
            current_game_date = game_date

        if game_time != None:
            current_game_time = game_time

        if team and reason == 'NOTYETSUBMITTED':
            players.append( {
                "gameDate": current_game_date,
                "gameTime": current_game_time,
                "team": split_camel_case(team),
                "reason": 'NOT YET SUBMITTED',
            })
        
        elif player:

            if team != None:
                current_team = team
            players.append( {
                "gameDate": current_game_date,
                "gameTime": current_game_time,
                "team": split_camel_case(current_team),
                "player": format_name(player),
                "status": status,
                "reason": clean_reason
            })
        
    return players





############################################
### RETRIEVE PLAYER INFORMATION FROM NBA ###
############################################

## HELPER FUNCTIONS ##

def get_ids_old(full_name):
    hit = players.find_players_by_full_name(full_name)
    if not hit:
        raise ValueError(f"No NBA player called {full_name}")


    player_id = hit[0]["id"]

    # CommonPlayerInfo returns a one-row table with TEAM_ID / TEAM_ABBREVIATION
    info = commonplayerinfo.CommonPlayerInfo(player_id=player_id).get_normalized_dict()
    team_id = info["CommonPlayerInfo"][0]["TEAM_ID"]

    return player_id, team_id

def get_ids(full_name: str):
    if full_name in _player_info_cache:          # ← NEW
        return _player_info_cache[full_name]

    hit = players.find_players_by_full_name(full_name)
    if not hit:
        raise ValueError(f"No NBA player called {full_name}")

    pid = hit[0]["id"]
    info = commonplayerinfo.CommonPlayerInfo(player_id=pid).get_normalized_dict()
    tid = info["CommonPlayerInfo"][0]["TEAM_ID"]

    _player_info_cache[full_name] = (pid, tid)   # ← cache it
    return pid, tid

def get_player_image_url(player_id):
    return f"https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{player_id}.png"

def player_image_loading(player_name):
    nba_found = players.find_players_by_full_name(player_name)
    if not nba_found:
        return {"error": f"No matching NBA Stats player found for {player_name}"}
    nba_player_id = nba_found[0]["id"]
    return get_player_image_url(nba_player_id)

def _slice_before_game(df, game_id):
    """
    Return a sub-DF containing only rows BEFORE the supplied Game_ID.
    Assumes df is in chronological order (earliest first).
    """
    # index of the current game (will raise if not in DF – good sanity check)
    idx_curr = df.index[df["Game_ID"] == game_id][0]
    return df.iloc[:idx_curr]              # everything *before* that row

## MAIN FUNCTIONS ##

def fetch_player_game_stats(player_id, season_str, game_id):
    if player_id in _player_gamelog_df_cache:
        df = _player_gamelog_df_cache[player_id]
    else:
        df = playergamelog.PlayerGameLog(
                player_id=player_id,
                season=SeasonAll.current_season
             ).get_data_frames()[0][::-1]   # reverse → chronological
        _player_gamelog_df_cache[player_id] = df

    if df.empty or game_id not in df["Game_ID"].values:
        return None, None, None, None

    df_past = _slice_before_game(df, game_id)
    if df_past.empty:
        return None, None, None, None

    return (
        df_past["FGA"].mean(),
        df_past["FTA"].mean(),
        df_past["TOV"].mean(),
        df_past["MIN"].mean(),
    )

def fetch_team_stats_for_usage(team_id, season, game_id):
    if team_id in _team_gamelog_df_cache:
        df = _team_gamelog_df_cache[team_id]
    else:
        df = TeamGameLog(team_id=team_id, season=season).get_data_frames()[0][::-1]
        _team_gamelog_df_cache[team_id] = df

    if df.empty or game_id not in df["Game_ID"].values:
        return None, None, None

    df_past = _slice_before_game(df, game_id)
    if df_past.empty:
        return None, None, None

    return (
        df_past["FGA"].mean(),
        df_past["FTA"].mean(),
        df_past["TOV"].mean(),
    )

def get_data_metrics(player_name, game_id):
    player_image_url = player_image_loading(player_name)


    player_id, player_team_id = get_ids(player_name)
    fga, fta, tov, mins = fetch_player_game_stats(player_id, "2024-25", game_id)
    if fga is None or fta is None or tov is None or mins is None:
        return None, None, None, player_image_url
    team_fga, team_fta, team_tov = fetch_team_stats_for_usage(player_team_id, "2024-25", game_id)
    if team_fga is None or team_fta is None or team_tov is None:
        return None, None, None, player_image_url

    alpha = 0.7
    usage_rate = (
        (fga + 0.475*fta + tov) * 240
        / (mins * (team_fga + 0.475*team_fta + team_tov))
    )

    importance_score = round(alpha * (mins / 48) + (1 - alpha) * usage_rate, 2)
    if importance_score >= 0.6:
        importance_role = "Starter"
    elif importance_score >= 0.3:
        importance_role = "Rotation"
    else:
        importance_role = "Bench"
    
    return usage_rate, importance_score, importance_role, player_image_url





#######################################
### STORE DATA IN FIREBASE DATABASE ###
#######################################

## MAIN FUNCTION ##

def update_injury_report(gameDate, gameTime, game_id):
    
    db = init_firestore()

    """
    1. Pull the NBA PDF → structured list via get_full_injury_report().
    2. Group rows by team.
    3. Wipe & rewrite processedPlayers/players/temp_injury_report.
    """
    
    report = get_full_injury_report(gameDate, gameTime)
    if isinstance(report, dict) and report.get("error"):
        # Log & bail if scraper failed
        print(report["error"])
        return

    # ---------- reshape ----------
    teams = {}
    for row in report:
        team = row.get("team")
        if not team:
            continue
        teams.setdefault(team, []).append(
            {k: v for k, v in row.items() if k != "team"}
        )

    coll = (
        db.collection("processedPlayers")
          .document("players")
          .collection("temp_injury_report")
    )

    # ---------- hard‑refresh: delete old, then batch‑write new ----------
    for doc in coll.stream():
        doc.reference.delete()

    batch = db.batch()
    for team, players in teams.items():
        
        for player in players:
            usage_rate = importance_score = importance_role = player_image_url = None
            if player["reason"] != "NOT YET SUBMITTED":
                usage_rate, importance_score, importance_role, player_image_url = get_data_metrics(player["player"], game_id)

            player["usage_rate"]      = usage_rate
            player["importance_score"] = importance_score
            player["importance_role"]  = importance_role
            player["player_image_url"] = player_image_url

        doc_ref = coll.document(_team_key(team))
        batch.set(doc_ref, {
            "team":        team,
            "lastUpdated": firestore.SERVER_TIMESTAMP,
            "players":     players,
        })
    batch.commit()

    #print(f"Wrote injury report for {len(teams)} teams.")





########################################################
### GETTING DATA ALREADY STORED IN FIREBASE DATABASE ###
########################################################

## MAIN FUNCTIONS ##

def get_team_injury_report(team_name, pick_id):
    """
    Get all injured players for a specific team
    
    Args:
        team_name_normalized (str): Normalized team name (e.g., "los_angeles_lakers")
        db: Firestore client (optional)
    
    Returns:
        dict: Team injury report with all injured players
    """
    try:
        db = init_firestore()
        
        # Query the specific team's injury document
        team_doc_ref = (
            db.collection("processedPlayers")
            .document("players")
            .collection("temp_injury_report")
            .document(team_name)
        )
        
        doc_snap = team_doc_ref.get()
        if doc_snap.exists:
            data = doc_snap.to_dict()
        else:
            #print(f"No injury report for {team_name}: pick_id = {pick_id}")
            return {'status': "NO INJURIES", 'reason': "Team not on NBA Injury Report"}
        
        injured_players = {}
        for player in data['players']:
            if player['reason'] == "NOT YET SUBMITTED":
                return {'status': "NOT YET SUBMITTED", 'reason': "Injury report not yet submitted by team"}
            else:
                injured_players[player['player']] = {
                    'status': player['status'],
                    'reason': player['reason'],
                    'usage_rate': player['usage_rate'],
                    'importance_score': player['importance_score'],
                    'importance_role': player['importance_role'],
                    "photoUrl": player['player_image_url'],
                }

        return injured_players
        
    except Exception as e:
        logger.error(f"Error getting team injury report for {team_name}: {e}")
        return {}
    
def get_player_injury_status(player_name, player_team, opponent_team, game_id, pick_id):
    """
    Look up a player's injury status plus both teams' full injury lists.
    """
    if not player_name:
        return {"error": "No player name provided"}

    # ── 1. Firestore client ────────────────────────────────────────────────
    # ── 2. Pull both reports ───────────────────────────────────────────────
    team_key  = player_team.lower().replace(" ", "_").replace(".", "")
    opp_key   = opponent_team.lower().replace(" ", "_").replace(".", "") if opponent_team else None

    team_injuries     = get_team_injury_report(team_key, pick_id)              # may be {}, {'status': 'NOT YET SUBMITTED'}, or {player: {...}}
    opponent_injuries = get_team_injury_report(opp_key, pick_id)

    # ── 3. Decide the player flag ──────────────────────────────────────────
    #
    # Case A – report not filed yet
    if team_injuries.get("status") == "NOT YET SUBMITTED":
        player_injured = {'status': "NOT YET SUBMITTED", 'reason': "Injury report not yet submitted by team"}

    # Case B – report exists and player is listed
    elif player_name in team_injuries:               # keys are player names
        player_injured = {'status': team_injuries[player_name]['status'], 'reason': team_injuries[player_name]['reason']}

    # Case C – report exists and player is NOT listed
    else:
        player_injured = {'status': 'NOT INJURED', 'reason': 'Player not listed in NBA injury report'}

    # ── 4. Uniform response ────────────────────────────────────────────────
    return {
        "player_injured":   player_injured,
        "teamInjuries":     team_injuries,
        "opponentInjuries": opponent_injuries,
        "lastUpdated":      firestore.SERVER_TIMESTAMP,
        "lastChecked":      firestore.SERVER_TIMESTAMP,
        "source":           "NBA Injury Report",
    }




##########################################
### START METHODS TO GET INJURY REPORT ###
##########################################
def main():
    # STEP 1: INITIALIZE FIREBASE
    db = init_firestore()
    concluded = (
        db.collection("processedPlayers")
          .document("players")
          .collection("concluded")
    )
    i = 1

    docs = list(concluded.stream())

    for doc_snap in docs:
        data = doc_snap.to_dict() or {}
        

        # STEP 2: GET PLAYER ID AND TEAM ID
        pick_id = data["pick_id"]
        game_date = data["gameDate"]
        game_time = data["gameTime"]
        player_name = data['name']
        player_team = data['team']
        opponent_team = data['opponent']
        game_id = data['gameId']


        # STEP 3: SCRAPE DATA FOR SPECIFIC PLAYER
        update_injury_report(game_date, game_time, game_id)

        
        # STEP 4: RETRIEVE INJURY REPORT FOR PLAYER
        injuryReport = get_player_injury_status(player_name, player_team, opponent_team, game_id, pick_id)

        
        # STEP 5: STORE INJURY REPORT PLAYER DOCUMENT
        doc_snap.reference.update({
            'injuryReport': injuryReport
        })



        print(f"{i} ✅ {pick_id}: Injury Report Completed")     
        i += 1

    print(f"✅✅ Added 'player_injured' field to all {i-1} players.")



if __name__ == "__main__":
    main()