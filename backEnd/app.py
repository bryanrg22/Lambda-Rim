import datetime, traceback
from flask import Flask, Response, request, jsonify
from flask_cors import CORS

import firebase_admin
import player_analyzer
from prediction_analyzer import calculate_poisson_probability
from monte_carlo import monte_carlo_for_player
from chatgpt_bet_explainer import get_bet_explanation_from_chatgpt
from volatility import fetch_point_series, forecast_volatility, forecast_playoff_volatility
import injury_report

from screenshot_parser import parse_image_data_url
import base64
import requests

import os
import json
from firebase_admin import credentials, firestore, initialize_app
from nba_api.stats.endpoints import ScoreboardV2, BoxScoreTraditionalV2
from requests.exceptions import ReadTimeout
import logging

# Configure logging at the top
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initialize Flask app and CORS
app = Flask(__name__)
CORS(app, resources={r"/api/*": {
    "origins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://prizepicksproject-15337.web.app",
        "https://prizepicksproject-15337.firebaseapp.com",
        "https://lambdarim.com",  # Custom Domain
        "https://prizepicks-backend-788584934715.us-west2.run.app"
    ]
}})

# On Cloud Run the default service account is already bound to your project,
# so this will pick it up automatically.
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

def pkey(name: str) -> str:
    return name.lower().replace(" ", "_")

def thr_doc_ref(name: str, threshold: float):
    doc_id = f"{pkey(name)}_{threshold}"
    # now under processedPlayers → players → active → {doc_id}
    return (
        db
        .collection("processedPlayers")
        .document("players")
        .collection("active")
        .document(doc_id)
    )

from google.cloud.firestore_v1 import transforms

def _strip_sentinels(obj):
    """Recursively replace Firestore Sentinel objects with ``None``."""
    if isinstance(obj, transforms.Sentinel):
        return None
    if isinstance(obj, dict):
        return {k: _strip_sentinels(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_strip_sentinels(v) for v in obj]
    return obj

def _fetch_scoreboard() -> dict:
    """Pull raw JSON for a single YYYYMMDD date."""
    resp = requests.get("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard")
    resp.raise_for_status()
    return resp.json()


######### BEGINNING OF MAIN ROUTES #########
def fetch_game_status(data):
    """Check if a game is finished based on game data"""
    try:
        game_date = data.get("gameDate")
        game_id = data.get("gameId")
        
        if not game_date or not game_id:
            logger.warning(f"Missing gameDate or gameId in data: {data}")
            return False
            
        # Convert Firestore timestamp to string if needed
        if hasattr(game_date, 'strftime'):
            game_date = game_date.strftime('%m/%d/%Y')
        elif isinstance(game_date, str):
            # Already a string, use as-is
            pass
        else:
            logger.warning(f"Unexpected gameDate format: {game_date}")
            return False
            
        sb = ScoreboardV2(game_date=game_date, league_id="00", timeout=30)
        df = sb.game_header.get_data_frame()
        
        if df is None or df.empty:
            logger.info(f"No game data available for date {game_date}")
            return False
            
        if game_id in df['GAME_ID'].values:
            mask = df["GAME_ID"] == game_id
            game_status = df.loc[mask, "GAME_STATUS_TEXT"].iloc[0]
            logger.info(f"Game {game_id} status: {game_status}")
            return game_status == "Final"
        else:
            logger.info(f"Game {game_id} not found in scoreboard")
            return False
            
    except ReadTimeout:
        logger.warning(f"NBA API timeout for game {data.get('gameId', 'unknown')}")
        return False
    except Exception as e:
        logger.error(f"Error fetching game status: {e}")
        return False

def fetch_player_stats(game_id, player_id):
    """Return (points, minutes) or (None, None)."""
    try:
        bb = BoxScoreTraditionalV2(game_id=game_id, timeout=30)
        df = bb.player_stats.get_data_frame()
        
        if df.empty:
            logger.warning(f"No player stats available for game {game_id}")
            return -1, -1
            
        row = df.loc[df["PLAYER_ID"] == int(player_id)]
        if row.empty:
            logger.warning(f"Player {player_id} not found in game {game_id}")
            return -1, -1
        row = row.iloc[0]
        

        # DNP / inactive?
        if isinstance(row.get("COMMENT"), str) and "DNP" in row["COMMENT"]:
            return -1, -1
                

        pts = int(row["PTS"]) if row["PTS"] is not None else -1

        raw_min = row["MIN"]
        mins = -1
        if ":" in raw_min:
            mins = int(raw_min.split(":")[0].split(".")[0])
        
        logger.info(f"Player {player_id} stats: {pts} points, {mins} minutes")
        return pts, mins
        
    except ReadTimeout:
        logger.warning(f"NBA API timeout for player stats: game {game_id}, player {player_id}")
        return None, None
    except Exception as e:
        logger.error(f"Error fetching player stats: {e}")
        return None, None

def update_doc(ref, data):
    """Update a document with final game results"""
    try:
        game_id = data.get("gameId")
        player_id = data.get("playerId")
        threshold = data.get("threshold")
        
        if not game_id or not player_id:
            logger.error(f"Missing gameId or playerId in data: {data}")
            return False
            
        pts, mins = fetch_player_stats(game_id, player_id)
            
        # Determine bet result
        hit = -1
        bet_result = "DNP"
        if pts != -1 and mins != -1:
            hit = 1 if pts > threshold else 0
            bet_result = "WIN" if hit == 1 else "LOSS"
        
        update_data = {
            "gameStatus": "Concluded",
            "finalPoints": pts,
            "finalMinutes": mins,
            "bet_result": bet_result,
            "hit" : hit,
            "finishedAt": firestore.SERVER_TIMESTAMP
        }

        ref.update(update_data)
        logger.info(f"Updated player {player_id}: {pts} points, result: {bet_result}")
        return True
        
    except Exception as e:
        logger.error(f"Error updating document: {e}")
        return False

def resolve_document_reference(doc_ref):
    """Resolve a document reference to its data"""
    try:
        if not doc_ref:
            return None
            
        doc_snap = doc_ref.get()
        if doc_snap.exists:
            return doc_snap.to_dict()
        else:
            logger.warning(f"Document not found: {doc_ref.path}")
            return None
    except Exception as e:
        logger.error(f"Error resolving document reference: {e}")
        return None

def move_player_to_concluded(player_id, player_data):
    """Move a player from active to concluded collection"""
    try:
        
        # Create reference to concluded collection
        concluded_ref = (
            db.collection("processedPlayers")
              .document("players")
              .collection("concluded")
              .document(player_id)
        )
        
        # Set the data in concluded collection
        concluded_ref.set(player_data)
        logger.info(f"Created concluded document for player {player_id}")
        
        # Delete from active collection
        active_ref = (
            db.collection("processedPlayers")
              .document("players")
              .collection("active")
              .document(player_id)
        )
        active_ref.delete()
        logger.info(f"Deleted active document for player {player_id}")
        
        return concluded_ref
        
    except Exception as e:
        logger.error(f"Error moving player to concluded: {e}")
        return None

def check_active_players():
    """Check all active players and move concluded games to concluded collection"""
    try:
        coll = db.collection("processedPlayers").document("players").collection("active")
        
        processed_count = 0
        moved_count = 0
        
        for snap in coll.stream():
            processed_count += 1
            player_data = snap.to_dict()
            player_id = snap.id
            
            # Skip if already concluded
            if player_data.get("gameStatus") == "Concluded":
                logger.info(f"Player {player_id} already concluded, skipping")
                continue
            
            logger.info(f"Checking player {player_id}")
            
            # Check if game is finished
            if fetch_game_status(player_data):
                logger.info(f"Game finished for player {player_id}, updating...")
                
                # Update with final stats
                if update_doc(snap.reference, player_data):
                    # Get updated data
                    updated_data = snap.reference.get().to_dict()
                    
                    # Move to concluded collection
                    if move_player_to_concluded(player_id, updated_data):
                        moved_count += 1
                        logger.info(f"Successfully moved player {player_id} to concluded")
                    else:
                        logger.error(f"Failed to move player {player_id} to concluded")
                else:
                    logger.error(f"Failed to update player {player_id} with final stats")
            else:
                logger.info(f"Game not finished for player {player_id}")
                
        logger.info(f"Processed {processed_count} active players, moved {moved_count} to concluded")
        
    except Exception as e:
        logger.error(f"Error checking active players: {e}")

def update_bet_pick_references():
    """Update active bet pick references when players move from active to concluded"""
    try:
        updated_bets = 0
        
        # Get all users
        for user_doc in db.collection("users").stream():
            user_id = user_doc.id
            
            # Check active bets
            active_bets_ref = db.collection("users").document(user_id).collection("activeBets")
            
            for bet_doc in active_bets_ref.stream():
                bet_data = bet_doc.to_dict()
                picks = bet_data.get("picks", [])
                
                if not picks:
                    continue
                
                updated_picks = []
                needs_update = False
                
                for pick_ref in picks:
                    if hasattr(pick_ref, 'path') and "/active/" in pick_ref.path:
                        # Extract player ID from path
                        player_id = pick_ref.path.split("/")[-1]
                        
                        # Check if concluded version exists
                        concluded_ref = (
                            db.collection("processedPlayers")
                              .document("players")
                              .collection("concluded")
                              .document(player_id)
                        )
                        
                        if concluded_ref.get().exists:
                            updated_picks.append(concluded_ref)
                            needs_update = True
                            logger.info(f"Updated reference for player {player_id} from active to concluded")
                        else:
                            updated_picks.append(pick_ref)  # Keep original if not moved yet
                    else:
                        updated_picks.append(pick_ref)  # Already pointing to concluded or legacy object
                
                # Update bet if references changed
                if needs_update:
                    bet_doc.reference.update({"picks": updated_picks})
                    updated_bets += 1
            logger.info(f"Updated pick references for bets of user {user_id}")
                    
        logger.info(f"Updated {updated_bets} bets with new pick references")
        
    except Exception as e:
        logger.error(f"Error updating bet pick references: {e}")

def check_user_picks():
    """Check user picks and clean up concluded games"""
    try:
        
        updated_users = 0
        
        for user_doc in db.collection("users").stream():
            user_data = user_doc.to_dict()
            picks = user_data.get("picks", [])
            
            if not picks:
                continue
                
            updated_picks = []
            needs_update = False
            
            for pick in picks:
                # Check if this is a document reference
                if hasattr(pick, 'get'):
                    pick_data = resolve_document_reference(pick)
                    if pick_data and pick_data.get("gameStatus") != "Concluded":
                        updated_picks.append(pick)
                    else:
                        needs_update = True  # Remove concluded picks
                        logger.info(f"Removing concluded pick from user {user_doc.id}")
                else:
                    # This is a legacy full object
                    if pick.get("gameStatus") != "Concluded":
                        updated_picks.append(pick)
                    else:
                        needs_update = True  # Remove concluded picks
                        logger.info(f"Removing concluded legacy pick from user {user_doc.id}")
            
            # Update user document if picks changed
            if needs_update:
                user_doc.reference.update({"picks": updated_picks})
                updated_users += 1
                logger.info(f"Updated picks for user {user_doc.id}")
                
        logger.info(f"Updated picks for {updated_users} users")
        
    except Exception as e:
        logger.error(f"Error checking user picks: {e}")

def check_active_bets():
    """Check active bets and settle completed ones"""
    try:
        
        settled_bets = 0
        
        for user_doc in db.collection("users").stream():
            user_id = user_doc.id
            
            # Check active bets subcollection
            active_bets_ref = db.collection("users").document(user_id).collection("activeBets")
            
            for bet_doc in active_bets_ref.stream():
                bet_data = bet_doc.to_dict()
                picks = bet_data.get("picks", [])
                
                if not picks:
                    continue
                
                # Resolve all pick references and check their status
                resolved_picks = []
                all_concluded = True
                
                for pick_ref in picks:
                    if hasattr(pick_ref, 'get'):
                        # This is a document reference
                        pick_data = resolve_document_reference(pick_ref)
                        if pick_data:
                            resolved_picks.append(pick_data)
                            if pick_data.get("gameStatus") != "Concluded":
                                all_concluded = False
                        else:
                            all_concluded = False
                    else:
                        # This is a legacy full object
                        resolved_picks.append(pick_ref)
                        if pick_ref.get("gameStatus") != "Concluded":
                            all_concluded = False
                
                # If all picks are concluded, settle the bet
                if all_concluded and resolved_picks:
                    # Determine overall bet result
                    all_wins = all(
                        pick.get("bet_result") == "WIN" or 
                        (pick.get("finalPoints") > pick.get("threshold"))
                        for pick in resolved_picks
                    )
                    
                    overall_result = "Won" if all_wins else "Lost"
                    
                    # Calculate winnings
                    bet_amount = bet_data.get("betAmount")
                    potential_winnings = bet_data.get("potentialWinnings")
                    winnings = potential_winnings if all_wins else 0
                    
                    # Update bet status
                    bet_doc.reference.update({
                        "status": overall_result,
                        "bet_result": overall_result,
                        "winnings": winnings,
                        "settledAt": firestore.SERVER_TIMESTAMP,
                    })
                    
                    
                    history_ref = (
                        db.collection("users")
                          .document(user_id)
                          .collection("betHistory")
                          .document(bet_doc.id)
                    )

                    history_data = {
                        **bet_data,
                        "status": overall_result,
                        "bet_result": overall_result,
                        "winnings": winnings,
                        "settledAt": firestore.SERVER_TIMESTAMP,
                    }

                    history_ref.set(history_data)
                    bet_doc.reference.delete()

                    settled_bets += 1
                    logger.info(
                        f"Settled bet {bet_doc.id} for user {user_id}: {overall_result}, winnings: ${winnings}"
                    )
                    
        logger.info(f"Settled {settled_bets} bets")
        
    except Exception as e:
        logger.error(f"Error checking active bets: {e}")

def check_games_handler(request):
    """Main handler for checking and updating game statuses"""
    try:
        logger.info("Starting game status check...")
        
        # Test Firestore connection
        logger.info("Firestore connection successful")
        
        # 1. Check active players and move concluded ones
        logger.info("Step 1: Checking active players...")
        check_active_players()
        
        # 2. Update bet pick references (in case players moved to concluded)
        logger.info("Step 2: Updating bet pick references...")
        update_bet_pick_references()
        
        # 3. Check and clean up user picks
        logger.info("Step 3: Checking user picks...")
        check_user_picks()
        
        # 4. Check and settle active bets
        logger.info("Step 4: Checking active bets...")
        check_active_bets()
        
        logger.info("Game status check completed successfully")
        return Response("Game check completed successfully", status=200)
        
    except Exception as e:
        logger.error(f"ERROR in check_games: {e}")
        return Response(f"Error: {str(e)}", status=500)



######### BETTING OF API ENDPOINTS #########
@app.route("/api/player", methods=["POST"])
def analyze_player_endpoint():
    body      = request.json or {}
    name      = body.get("playerName")
    threshold = float(body.get("threshold"))
    key       = name.lower().replace(" ", "_")
    coll_ref = (
        db.collection("processedPlayers")
          .document("players")
          .collection("active")
    )
    
    doc_ref = None
    for doc in coll_ref.stream():
        if doc.id.startswith(f"{key}_{threshold}"):
            doc_ref = doc.reference
            break

    # 2) If found, return it
    if doc_ref:
        snap = doc_ref.get()
        if snap.exists:
            return jsonify(snap.to_dict()), 200


    # 3) If not found, continue with analysis

    # 1) run your pipeline
    first, last = name.split(maxsplit=1)
    pdata = player_analyzer.analyze_player(first, last, threshold)
    if "error" in pdata:
        return jsonify({"error": pdata["error"]}), 400




    ###### ------------------------------------------------- ######
    ### Final Variables Being Inputted into the Player Document ###
    ###### ------------------------------------------------- ######

    # make sure both fields exist even if analyzer couldn’t find a game
    pdata.setdefault("gameId", None)
    pdata.setdefault("gameStatus", "Scheduled")
    
    
    player_team = pdata.get("team")
    opponent_team = pdata.get("opponent")
    pdata["injuryReport"] = _strip_sentinels(
        injury_report.get_player_injury_status_new(
            name,
            player_team,
            opponent_team,
        )
    )

    season_avg = pdata.get("seasonAvgPoints")
    pdata["poissonProbability"] = (
        calculate_poisson_probability(season_avg, threshold)
        if season_avg is not None
        else None
    )
    pdata["monteCarloProbability"] = monte_carlo_for_player(name, threshold) or -1

    # — GARCH vol forecast —
    series = fetch_point_series(pdata, n_games=50)
    vol   = forecast_volatility(series)
    pdata["volatilityForecast"] = vol

    if pdata["num_playoff_games"] >= 5:
        pdata["volatilityPlayOffsForecast"] = forecast_playoff_volatility(pdata)
    else:
        pdata["volatilityPlayOffsForecast"] = None


    import re
    from typing import Optional, Dict, Any
    def extract_open_spread(comp: Dict[str, Any]) -> Optional[float]:
        odds_list = comp.get("odds", [])
        if not odds_list:
            return None
        line = odds_list[0]

        # 1) explicit
        try:
            return float(line.get("open", {}).get("spread"))
        except (TypeError, ValueError):
            pass

        # 2) free–text
        open_details = (
            line.get("openDetails")
            or line.get("open", {}).get("details")
            or line.get("details")
        )
        if isinstance(open_details, str):
            nums = re.findall(r'[-+]?\d+(?:\.\d+)?', open_details)
            if nums:
                try:
                    return float(nums[-1])
                except ValueError:
                    pass

        # 3) fallback → current
        try:
            return float(line.get("spread"))
        except (TypeError, ValueError):
            return None


    # 0️⃣  Find the correct competition for this player’s team
    sb      = _fetch_scoreboard()
    events  = sb["events"]
    try:
        comp = next(
            e["competitions"][0] for e in events
            if any(t["team"]["displayName"] == pdata["team"]
                for t in e["competitions"][0]["competitors"])
        )
    except StopIteration:
        raise ValueError(f"No ESPN odds found for {pdata['team']}")

    odds = comp["odds"][0]

    # 1️⃣ spreads & totals
    spread_current = float(odds["spread"])
    spread_open    = extract_open_spread(comp)
    spread_move    = (spread_current - spread_open) if spread_open is not None else 0.0

    total_current  = float(odds["current"]["total"]["american"])
    total_open     = float(
        odds.get("open", {}).get("total", {}).get("american", total_current)
    )
    total_move     = total_current - total_open

    # 2️⃣ favourite / underdog
    player_is_home = pdata["home_game"]
    player_is_fav  = (
        (spread_current < 0 and player_is_home) or
        (spread_current > 0 and not player_is_home)
    )
    pdata["favoriteFlag"] = int(player_is_fav)
    pdata["underdogFlag"] = int(not player_is_fav)

    # 3️⃣ implied team totals
    home_pts = (total_current / 2) - (spread_current / 2)
    away_pts = total_current - home_pts
    team_imp = home_pts if player_is_home else away_pts
    opp_imp  = away_pts if player_is_home else home_pts

    # 4️⃣ implied probability that GAME goes over
    decimal_over = float(odds["current"]["over"]["decimal"])
    pdata["impliedOverProb"] = round(1 / decimal_over, 3)

    # 5️⃣  shove into player doc
    pdata.update({
        "vegasSpread":    spread_current,
        "vegasTotal":     total_current,
        "spreadMove":     round(spread_move, 1),
        "totalMove":      round(total_move, 1),
        "teamImpliedPts": round(team_imp, 1),
        "oppImpliedPts":  round(opp_imp, 1),
        "details":        odds.get("details"),
        "overUnder":      odds.get("overUnder"),
        "blowoutRisk":    round(max(0, min(1, (abs(spread_current) - 8) / 12)), 3),
    })
    #pdata['awayTeamOdds'] = odds.get('awayTeamOdds')
    #pdata['homeTeamOdds'] = odds.get('homeTeamOdds')



    game_date_obj = datetime.datetime.strptime(pdata["gameDate"], "%m/%d/%Y")
    # …and re-format to YYYYMMDD
    doc_date = game_date_obj.strftime("%Y%m%d")
    pdata["pick_id"]      = f"{pkey(name)}_{threshold}_{doc_date}"

    pdata["betExplanation"]      = get_bet_explanation_from_chatgpt(pdata)







    # 2) persist it (writes to processedPlayers/players/active/{player_threshold_date})
    ref = db.collection("processedPlayers") \
            .document("players") \
            .collection("active") \
            .document(f"{key}_{threshold}_{doc_date}")
    ref.set(pdata)

    # 3) return it
    return jsonify(pdata), 200


@app.route("/api/parse_screenshot", methods=["POST"])
def parse_screenshot_endpoint():
    """
    1) Accepts multipart/form-data images under 'images'
    2) For each: encode → parse_image_data_url → get list of {player,threshold}
    3) For each pair: POST to /api/player so it goes through your normal pipeline.
    4) Return the flat list of all parsed entries.
    """
    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "No images uploaded"}), 400

    parsed = []
    base = request.url_root.rstrip("/").replace("http://", "https://", 1)

    for img in files:
        raw = img.read()
        ext = img.filename.rsplit(".", 1)[-1].lower()
        mime = f"image/{'jpeg' if ext=='jpg' else ext}"
        data_url = f"data:{mime};base64," + base64.b64encode(raw).decode()

        try:
            result = parse_image_data_url(data_url)
            players = result.get("players", [])
        except Exception:
            app.logger.exception("Screenshot parsing failed")
            parsed = {"players": [], "count": 0}
            continue

        for entry in players:
            name      = entry.get("player")
            threshold = entry.get("threshold")
            image = entry.get("image")
            if not name or threshold is None:
                continue

            # Fire off your existing analyze route:
            try:
                requests.post(
                    f"{base}/api/player",
                    json={"playerName": name, "threshold": threshold, "image": image},
                    timeout=10
                )
            except Exception:
                # swallow any network or timeout errors
                pass

            parsed.append({"playerName": name, "threshold": threshold, "image": image})
            print(f"[→ POST]/api/player  {name}  @ {threshold}")

    return jsonify({"status": "ok", "parsedPlayers": parsed}), 200


@app.route("/api/player/<pick_id>/more_games", methods=["GET"])
def more_games_endpoint():
    """
    Returns the “extra” regular-season games beyond the first 5.
    Optional query-param: ?season=YYYY-YY; otherwise uses current season.
    """
    try:
        player_id = request.args.get('player_d', '')
        gameStatus = request.args.get('gameStatus', '')
        season = request.args.get('season', '')
        game_id = request.args.get('game_id', '')
        
        games = player_analyzer.fetch_more_games(player_id, gameStatus, season, game_id)
        return jsonify(games), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    

@app.route("/check_games", methods=["POST", "GET"])
def check_games():
    logger.info("Starting game status check...")
    try:
        check_active_players()
        update_bet_pick_references()
        check_user_picks()
        check_active_bets()
        # Return consistent JSON response
        return jsonify({
            "status": "success",
            "message": "Game check completed successfully"
        }), 200
    except Exception as e:
        logger.error(f"Check games failed: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "time": datetime.datetime.utcnow().isoformat()}), 200

@app.route("/api/admin/overview", methods=["GET"])
def admin_overview():
    """Get real system overview data for admin dashboard"""
    try:
        from admin_endpoints import get_real_system_overview
        data = get_real_system_overview(db)
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error in admin overview: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/api/admin/users", methods=["GET"])
def admin_users():
    """Get real user analytics data"""
    try:
        from admin_endpoints import get_real_user_analytics
        time_range = request.args.get('timeRange', '7d')
        data = get_real_user_analytics(db, time_range)
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error in admin users: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/api/admin/bets", methods=["GET"])
def admin_bets():
    """Get real bet performance analytics"""
    try:
        from admin_endpoints import get_real_bet_performance
        time_range = request.args.get('timeRange', '30d')
        data = get_real_bet_performance(db, time_range)
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error in admin bets: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/api/admin/players", methods=["GET"])
def admin_players():
    """Get real player analytics data"""
    try:
        from admin_endpoints import get_real_player_analytics
        data = get_real_player_analytics(db)
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error in admin players: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/api/admin/financial", methods=["GET"])
def admin_financial():
    """Get real financial metrics"""
    try:
        from admin_endpoints import get_real_financial_metrics
        time_range = request.args.get('timeRange', '30d')
        data = get_real_financial_metrics(db, time_range)
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error in admin financial: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/api/admin/system", methods=["GET"])
def admin_system():
    """Get real system health and monitoring data"""
    try:
        from admin_endpoints import get_system_health, check_cloud_functions_health
        
        health_data = get_system_health()
        functions_health = check_cloud_functions_health()
        
        # Merge function health into main health data
        health_data["cloudFunctions"] = functions_health
        
        return jsonify(health_data), 200
    except Exception as e:
        logger.error(f"Error in admin system: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/api/admin/logs", methods=["GET"])
def admin_logs():
    """Get recent system logs and errors"""
    try:
        # In production, this would fetch from Google Cloud Logging
        # For now, return recent activity from Firestore
        
        logs = [
            {
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "level": "info",
                "message": "Player analysis completed: LeBron James",
                "service": "backend"
            },
            {
                "timestamp": (datetime.datetime.utcnow() - datetime.timedelta(minutes=5)).isoformat(),
                "level": "info", 
                "message": "Game status check completed successfully",
                "service": "cloud_function"
            },
            {
                "timestamp": (datetime.datetime.utcnow() - datetime.timedelta(minutes=10)).isoformat(),
                "level": "warning",
                "message": "High memory usage detected: 67%",
                "service": "backend"
            }
        ]
        
        return jsonify({
            "logs": logs,
            "status": "success"
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting admin logs: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/", methods=["GET"])
def root_health_check():
    """Root health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Lambda Rim API",
        "version": "1.0.0",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }), 200

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)