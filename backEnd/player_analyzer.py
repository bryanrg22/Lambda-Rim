import requests
import datetime
import pytz
import time
import pandas as pd
from nba_api.stats.endpoints import leaguestandings
from nba_api.stats.static import teams, players
from nba_api.stats.endpoints import ScoreboardV2 as Scoreboard
from nba_api.stats.endpoints import playercareerstats, playergamelog
from nba_api.stats.endpoints import PlayerGameLog
from typing import Dict, Tuple, Union, Optional



############################################################################
### HELPER FUNCTIONS (Moved to top so they are in scope)
############################################################################

# Get the player's NBA.com headshot URL
def get_player_image_url(player_id):
    return f"https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{player_id}.png"

def player_image_loading(player_name):
    nba_found = players.find_players_by_full_name(player_name)
    if not nba_found:
        return {"error": f"No matching NBA Stats player found for {player_name}"}
    nba_player_id = nba_found[0]["id"]
    return get_player_image_url(nba_player_id)

# Get team logo URL
def get_team_logo_url(team_id):
    return f"https://cdn.nba.com/logos/nba/{team_id}/global/L/logo.svg"

# Get Game Type from Game ID
def deduce_game_type(game_id):
    prefix = game_id[:3]
    return {
      '001': 'Preseason',
      '002': 'Regular Season',
      '003': 'All-Star',
      '004': 'Playoffs',
      '005': 'Play-In',
      '006': 'NBA Cup'
    }.get(prefix, 'Unknown')


def get_team_full_name_from_abbr(abbr):
        all_teams = teams.get_teams()
        for t in all_teams:
            if t["abbreviation"] == abbr:
                return t["full_name"]
        return abbr


def get_team_id_from_abbr(abbr):
    all_teams = teams.get_teams()
    for t in all_teams:
        if t["abbreviation"] == abbr:
            return t["id"]
    return None


def get_current_season():
    now = datetime.datetime.now()
    if now.month >= 10:
        season_start = now.year
        season_end = now.year + 1
    else:
        season_start = now.year - 1
        season_end = now.year
    return f"{season_start}-{str(season_end)[-2:]}"


def _slice_before_game(df, game_id):
    """
    Return a sub-DF containing only rows BEFORE the supplied Game_ID.
    Assumes df is in chronological order (earliest first).
    """
    # index of the current game (will raise if not in DF – good sanity check)
    idx_curr = df.index[df["Game_ID"] == game_id][0]
    return df.iloc[:idx_curr]              # everything *before* that row


def fetch_more_games(player_id, gameStatus, season, game_id, gameType):
    """
    Fetch more games for a player, up to max_games
    """

    more_regular_games = []
    pgl = PlayerGameLog(
            player_id=player_id,                 
            season=season,
            season_type_all_star='Regular Season'
        )
    df = pgl.get_data_frames()[0]

    if gameStatus == "Concluded" and gameType != "Playoffs":
        df = _slice_before_game(df, game_id)


    for i in range(5, len(df)):
        curr = df.iloc[i]
        matchup = curr['MATCHUP']            
        if ' vs. ' in matchup:
            location = 'Home'
            opp_abbr = matchup.split(' vs. ')[1]
        elif ' @ ' in matchup:
            location = 'Away'
            opp_abbr = matchup.split(' @ ')[1]
        else:
            location = 'Unknown'
            opp_abbr = None
        # lookup full name & logo
        opp_full = get_team_full_name_from_abbr(opp_abbr) if opp_abbr else None
        opp_id   = get_team_id_from_abbr(opp_abbr)        if opp_abbr else None
        opp_logo = get_team_logo_url(opp_id)              if opp_id   else None
        # minutes (takes only the minute portion if it's "MM:SS")
        raw_min = curr.get('MIN', '')
        if isinstance(raw_min, str) and ':' in raw_min:
            minutes = int(raw_min.split(':')[0])
        else:
            minutes = int(raw_min) if raw_min else 0
        
        more_regular_games.append({
            "date":             curr['GAME_DATE'],
            "points":           int(curr['PTS']),
            "opponent":         opp_abbr,
            "opponentFullName": opp_full,
            "opponentLogo":     opp_logo,
            "location":         location,
            "minutes":          minutes,
            "gameType":         "Regular Season"
        })

    return more_regular_games
    

def fetch_all_opponent_games(player_id, opponent_abbr):
    """
    Fetch all Regular Season games for `player_id` this season
    against the team with abbreviation `opponent_abbr`.
    Returns a list of dicts with keys:
      date, points, opponent, opponentFullName, opponentLogo,
      location, minutes, gameType
    """
    # 1) pull full regular-season game log
    season_str = get_current_season()
    pgl = PlayerGameLog(
        player_id=player_id,
        season=season_str,
        season_type_all_star='Regular Season'
    )
    df = pgl.get_data_frames()[0]
    if df.empty:
        return []

    games = []
    for _, row in df.iterrows():
        # only keep games vs. this opponent
        matchup = row.get('MATCHUP', '')
        if opponent_abbr not in matchup:
            continue

        # determine home/away and raw abbr
        if ' vs. ' in matchup:
            location = 'Home'
            opp = matchup.split(' vs. ')[1]
        elif ' @ ' in matchup:
            location = 'Away'
            opp = matchup.split(' @ ')[1]
        else:
            location = 'Unknown'
            opp = None

        # minutes parsing
        raw_min = row.get('MIN', '')
        if isinstance(raw_min, str) and ':' in raw_min:
            minutes = int(raw_min.split(':')[0])
        else:
            minutes = int(raw_min) if raw_min else 0

        # lookup full name & logo
        opp_full = get_team_full_name_from_abbr(opp) if opp else None
        opp_id   = get_team_id_from_abbr(opp)        if opp else None
        opp_logo = get_team_logo_url(opp_id)         if opp_id else None


        games.append({
            "gameId":           row['Game_ID'],
            "date":             row['GAME_DATE'],
            "points":           int(row['PTS']),
            "opponent":         opp,
            "opponentFullName": opp_full,
            "opponentLogo":     opp_logo,
            "location":         location,
            "minutes":          minutes,
            "gameType":         "Regular Season"
        })

    return games
   

def fetch_player_game_logs(nba_player_id, season_str):
    """
    Fetches advanced game logs for the specified NBA player (by official nba_api ID).
    Returns per-game stats including FGM, FGA, 3PA, 3PM, etc.
    """
    try:
        gamelog_df = playergamelog.PlayerGameLog(player_id=nba_player_id, season=season_str).get_data_frames()[0]
    except Exception as e:
        print(f"[fetch_player_game_logs] Error fetching logs for {nba_player_id}, season {season_str}: {e}")
        return []
    if gamelog_df.empty:
        return []
    game_dicts = []
    for idx, row in gamelog_df.iterrows():
        fgm = row.get("FGM", 0)
        fga = row.get("FGA", 0)
        fg3m = row.get("FG3M", 0)
        fg3a = row.get("FG3A", 0)
        ftm = row.get("FTM", 0)
        fta = row.get("FTA", 0)
        tov = row.get("TOV", 0)
        pts = row.get("PTS", 0)
        minutes = row.get("MIN", 0)
        matchup_str = row.get("MATCHUP", "")
        if "vs." in matchup_str:
            home_away_flag = 1
        elif "@" in matchup_str:
            home_away_flag = 0
        else:
            home_away_flag = None
        team_possessions = None  # Not provided in standard boxscores
        game_dicts.append({
            "points": pts,
            "fgm": fgm,
            "fga": fga,
            "3pm": fg3m,
            "3pa": fg3a,
            "ftm": ftm,
            "fta": fta,
            "turnovers": tov,
            "minutes": minutes,
            "home_away_flag": home_away_flag,
            "team_possessions": team_possessions
        })
    return game_dicts


def _safe_div(num: float, den: float) -> Optional[float]:
    """Return num/den or None if denominator is zero (avoids -1 magic numbers)."""
    return num / den if den else None


def analyze_player_performance(
    nba_player_id: int,
    season_str: str,
) -> Union[
    Tuple[float, float, float, float, float, float, float, float, float, float, float],
    Dict[str, float],
]:
    """
    Advanced box-score aggregator.

    Returns **either**
      • the same 11-value tuple you used before         (default – backward-compatible)
      • a self-documenting dict if `return_dict=True`

    Tuple fields (same order):  
        avg_fga, avg_fgm, avg_3pa, avg_3pm,
        avg_fta, avg_ftm, avg_tov,
        shot_dist_3pt, ft_rate, efg, usage_rate
    """

    logs = fetch_player_game_logs(nba_player_id, season_str)
    if not logs:
        print(f"[analyze_player_performance] No logs for ID={nba_player_id}, season={season_str}")
        return {}

    # ── accumulate raw totals ───────────────────────────────────────────────────
    totals = dict(
        fga=0, fgm=0,
        pa3=0, pm3=0,
        fta=0, ftm=0,
        tov=0, poss=0,
        points=0,
    )

    for g in logs:

        fga  = g.get("fga", 0)
        fgm  = g.get("fgm", 0)
        pa3  = g.get("3pa", 0)
        pm3  = g.get("3pm", 0)
        fta  = g.get("fta", 0)
        ftm  = g.get("ftm", 0)
        tov  = g.get("turnovers", 0)
        poss = g.get("team_possessions") or 0
        points  = g.get("points", 0)

        totals["fga"]  += fga
        totals["fgm"]  += fgm
        totals["pa3"]  += pa3
        totals["pm3"]  += pm3
        totals["fta"]  += fta
        totals["ftm"]  += ftm
        totals["tov"]  += tov
        totals['points'] += points

    G     = len(logs)
    FGA   = totals["fga"]
    FTA   = totals["fta"]

    # ── advanced rates ──────────────────────────────────────────────────────────
    efg          = _safe_div(totals["fgm"] + 0.5 * totals["pm3"], FGA)
    shot_dist_3p = _safe_div(totals["pa3"], FGA)
    ft_rate      = _safe_div(FTA, FGA)
    # optional: True Shooting % (not returned in tuple to avoid breaking order)
    ts_pct       = _safe_div(totals["points"], 2 * (FGA + 0.44 * FTA))

    # ── per-game averages ───────────────────────────────────────────────────────
    per_game = lambda x: _safe_div(x, G)

    results_dict = {
        "avg_fga": per_game(totals["fga"]),
        "avg_fgm": per_game(totals["fgm"]),
        "avg_3pa": per_game(totals["pa3"]),
        "avg_3pm": per_game(totals["pm3"]),
        "avg_fta": per_game(totals["fta"]),
        "avg_ftm": per_game(totals["ftm"]),
        "avg_tov": per_game(totals["tov"]),

        "shot_dist_3pt": shot_dist_3p,
        "ft_rate": ft_rate,
        "efg": efg,
        # extras you might want later
        "ts_pct": ts_pct,
    }

    return results_dict
 

def analyze_player(first_name, last_name, threshold=None):
    """
    1) Use balldontlie just for the player's name confirmation.
    2) Then obtain the official NBA ID via players.find_players_by_full_name.
    3) Retrieve logs and team info from nba_api.
    4) Return a data object with original fields (name, photoUrl, teamLogo, opponentLogo, etc.)
       plus advanced metrics and career season stats.
    """
    # (A) Use balldontlie to check for player's existence (but ignore its ID)
    url = "https://api.balldontlie.io/v1/players"
    headers = {"Authorization": "03f64803-21d9-40e4-ab9f-5d69ca82c8dc"}
    params = {"first_name": first_name, "last_name": last_name}
    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        return {"error": f"API Error from balldontlie: {response.status_code}"}
    bd_players = response.json().get("data", [])
    if not bd_players:
        return {"error": f"No players found in balldontlie for {first_name} {last_name}"}
    bdl_player = bd_players[0]
    
    # (B) Get the official NBA ID using nba_api
    full_name = f"{bdl_player['first_name']} {bdl_player['last_name']}"
    nba_found = players.find_players_by_full_name(full_name)
    if not nba_found:
        return {"error": f"No matching NBA Stats player found for {full_name}"}
    nba_player_id = nba_found[0]["id"]
    
    ##################################################################
    # (C) Retrieve team info and game schedule as before.
    ##################################################################
    player_name = full_name
    player_position = bdl_player.get("position", "N/A")
    player_team = bdl_player["team"]["full_name"] if bdl_player.get("team") else "Unknown Team"
    player_team_conference = bdl_player["team"].get("conference", "Unknown")
    standings = leaguestandings.LeagueStandings().get_data_frames()[0]
    standings["TeamID"] = standings["TeamID"].astype(int)
    player_team_standings = teams.find_teams_by_full_name(player_team)[0]
    player_team_id = player_team_standings["id"]
    player_team_standings = standings[standings["TeamID"] == player_team_id]
    player_team_logo = get_team_logo_url(player_team_id)
    player_team_playoffRank = int(player_team_standings["PlayoffRank"].values[0])
    
    # Find upcoming game (using Scoreboard)
    max_search_days = 14
    eastern = pytz.timezone('America/New_York')
    today_eastern = datetime.datetime.now(eastern).date()
    search_date = today_eastern
    game_date_str = None
    game_date_est = None
    opponent_team_name = None
    opponent_team_conference = None
    opponent_team_playoffRank = None
    opponent_team_logo = None
    home = None
    next_game_id = None
    home_game = True
    for _ in range(max_search_days):
        game_date_str = search_date.strftime("%m/%d/%Y")
        try:
            scoreboard = Scoreboard(game_date=game_date_str, league_id='00')
            game_df = scoreboard.game_header.get_data_frame()
        except Exception:
            search_date += datetime.timedelta(days=1)
            continue
        if not game_df.empty:
            if player_team_id in game_df['HOME_TEAM_ID'].values:
                home_index = int(game_df.index[game_df['HOME_TEAM_ID'] == player_team_id][0])
                opponent_team_id = game_df.at[home_index, 'VISITOR_TEAM_ID']
                game_date_est = game_df.at[home_index, 'GAME_STATUS_TEXT']
                home = True
                next_game_id = game_df.at[home_index, 'GAME_ID']
                next_game_type = deduce_game_type(next_game_id) if next_game_id else None
                break
            elif player_team_id in game_df['VISITOR_TEAM_ID'].values:
                home_game = False
                away_index = int(game_df.index[game_df['VISITOR_TEAM_ID'] == player_team_id][0])
                opponent_team_id = game_df.at[away_index, 'HOME_TEAM_ID']
                game_date_est = game_df.at[away_index, 'GAME_STATUS_TEXT']
                home = False
                next_game_id = game_df.at[away_index, 'GAME_ID']
                next_game_type = deduce_game_type(next_game_id) if next_game_id else None
                break
        search_date += datetime.timedelta(days=1)
    all_teams = teams.get_teams()
    opponent_team = next((t for t in all_teams if t["id"] == opponent_team_id), None)
    opponent_team_name = opponent_team["full_name"] if opponent_team else "Unknown Opponent"
    opponent_team_logo = get_team_logo_url(opponent_team_id) if opponent_team else "/placeholder.svg?height=40&width=40"
    matchup = f"{opponent_team_name} at {player_team}" if home else f"{player_team} at {opponent_team_name}"
    opponent_team_standings = standings[standings["TeamID"] == opponent_team_id] if opponent_team_id else None
    if opponent_team_standings is not None and not opponent_team_standings.empty:
        opponent_team_conference = opponent_team_standings["Conference"].values[0]
        opponent_team_playoffRank = int(opponent_team_standings["PlayoffRank"].values[0])
    
    # Get player image URL from official NBA ID
    player_image_url = get_player_image_url(nba_player_id)

    current_season_str = get_current_season()


    # Career stats from playercareerstats
    try:
        career_df = playercareerstats.PlayerCareerStats(player_id=nba_player_id).get_data_frames()[0]
    except Exception:
        career_df = None

    # Current season stats
    try:
        season_log = playergamelog.PlayerGameLog(player_id=nba_player_id, season=current_season_str).get_data_frames()[0]
    except Exception:
        season_log = pd.DataFrame()
    if not season_log.empty:
        season_avg_points = float(season_log['PTS'].mean())
    else:
        season_avg_points = None

    # Stats vs opponent
    opponent_abbr = opponent_team.get("abbreviation") if opponent_team else None
    if opponent_abbr is None:
        career_avg_points_vs_opponent = None
        season_avg_points_vs_opponent = None
    else:
        if not season_log.empty:
            season_games_vs_opponent = season_log[season_log["MATCHUP"].str.contains(opponent_abbr)]
            if not season_games_vs_opponent.empty:
                season_avg_points_vs_opponent = float(season_games_vs_opponent["PTS"].mean())
            else:
                season_avg_points_vs_opponent = None
        else:
            season_avg_points_vs_opponent = None
        career_points_list = []
        career_games_list = []
        if career_df is not None and not career_df.empty:
            seasons = career_df["SEASON_ID"].unique()
            for season in seasons:
                try:
                    season_game_log = playergamelog.PlayerGameLog(player_id=nba_player_id, season=season).get_data_frames()[0]
                except Exception:
                    continue
                if season_game_log.empty:
                    continue
                games_vs_opponent = season_game_log[season_game_log["MATCHUP"].str.contains(opponent_abbr)]
                if not games_vs_opponent.empty:
                    total_points = games_vs_opponent["PTS"].sum()
                    games_played = games_vs_opponent.shape[0]
                    career_points_list.append(total_points)
                    career_games_list.append(games_played)
                time.sleep(0.5)
            if career_games_list:
                career_avg_points_vs_opponent = float(sum(career_points_list) / sum(career_games_list))
            else:
                career_avg_points_vs_opponent = None
        else:
            career_avg_points_vs_opponent = None

    # Check if Playoff Game First
    num_playoff_games = 0
    playoff_games = []
    playoff_avg = 0
    playoff_minutes_avg = 0
    playoff_underCount = 0
    playoff_points_home_avg = 0
    playoff_home_games = 0
    playoff_points_away_avg = 0
    playoff_minutes_home_avg = 0
    playoff_minutes_away_avg = 0
    playoff_away_games = 0
    playoff_curr_score = ""

    if next_game_type == "Playoffs":
        pgl = PlayerGameLog(
            player_id=nba_player_id,                 
            season=get_current_season(),
            season_type_all_star='Playoffs'
        )
        games_df = pgl.get_data_frames()[0]  # most recent game is first row
        num_playoff_games = len(games_df)
        game = 1
        round_playoff_game = 0
        series_score = "0-0"
        type_playoff_game = ['Conference First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals']

        # Get all playoff games data

        # Pull series metadata 
        #cps = commonplayoffseries.CommonPlayoffSeries(
        #    league_id='00',
        #    season=season,
        #    series_id=''        
        #)
        #series_df = cps.get_data_frames()[0][['GAME_ID', 'SERIES_ID', 'GAME_NUM']]
        
        for i in range(num_playoff_games):
            curr = games_df.iloc[num_playoff_games - 1 - i]

            matchup = curr['MATCHUP']            
            if ' vs. ' in matchup:
                location = 'Home'
                opp_abbr = matchup.split(' vs. ')[1]
                playoff_home_games += 1
            elif ' @ ' in matchup:
                location = 'Away'
                opp_abbr = matchup.split(' @ ')[1]
                playoff_away_games += 1

            else:
                location = 'Unknown'
                opp_abbr = None

            # lookup full name & logo
            opp_full = get_team_full_name_from_abbr(opp_abbr) if opp_abbr else None
            opp_id   = get_team_id_from_abbr(opp_abbr)        if opp_abbr else None
            opp_logo = get_team_logo_url(opp_id)              if opp_id   else None

            # minutes (takes only the minute portion if it's "MM:SS")
            raw_min = curr.get('MIN', '')
            if isinstance(raw_min, str) and ':' in raw_min:
                minutes = int(raw_min.split(':')[0])
            else:
                minutes = int(raw_min) if raw_min else 0

            playoff_minutes_avg += minutes

            if int(curr['PTS']) <= threshold:
                playoff_underCount += 1

            if location == 'Home':
                playoff_points_home_avg += int(curr['PTS'])
                playoff_minutes_home_avg += minutes
            elif location == 'Away':
                playoff_points_away_avg += int(curr['PTS'])
                playoff_minutes_away_avg += minutes
            
            if game > 7 or (playoff_games and opp_abbr != playoff_games[-1]['opponent']):
                game = 1
                round_playoff_game += 1
                series_score = "0-0"
            if  curr['WL'] == 'W':
                series_score = f"{int(series_score.split('-')[0]) + 1}-{series_score.split('-')[1]}"
            else:
                series_score = f"{series_score.split('-')[0]}-{int(series_score.split('-')[1]) + 1}"

            playoff_games.append({
                "gameId":           curr['Game_ID'],
                "date":             curr['GAME_DATE'],
                "points":           int(curr['PTS']),
                "opponent":         opp_abbr,
                "opponentFullName": opp_full,
                "opponentLogo":     opp_logo,
                "location":         location,
                "minutes":          minutes,
                "game_number":      game,
                "round":            type_playoff_game[round_playoff_game],
                "series_score": series_score,
                "result":         curr['WL'],
                "gameType":         "Playoffs"
            })
            game += 1
        
        
        playoff_avg = games_df['PTS'].sum() / len(games_df)
        playoff_minutes_avg /= num_playoff_games if num_playoff_games > 0 else 0
        playoff_points_home_avg /= playoff_home_games if playoff_home_games > 0 else 0
        playoff_points_away_avg /= playoff_away_games if playoff_away_games > 0 else 0
        playoff_minutes_home_avg /= playoff_home_games if playoff_home_games > 0 else 0
        playoff_minutes_away_avg /= playoff_away_games if playoff_away_games > 0 else 0
    
    if playoff_games:
        last_game = playoff_games[-1]           # most-recent playoff game on record

        if last_game['game_number'] == 7:
            # Series finished → reset score and advance round IF another exists
            playoff_curr_score = "0-0"
            next_round_idx = round_playoff_game + 1
            playoff_round = (
                type_playoff_game[next_round_idx]
                if next_round_idx < len(type_playoff_game)
                else type_playoff_game[-1]      # stay on “NBA Finals” if we’re already there
            )
        else:
            # Series still in progress
            playoff_curr_score = last_game['series_score']
            playoff_round = type_playoff_game[round_playoff_game]
    else:
        # No playoff data yet
        playoff_curr_score = "0-0"
        playoff_round = type_playoff_game[round_playoff_game]



    # Get the last 5 games
    last_5_regular_games = []
    last_5_regular_games_avg = 0
    underCount = 0
    num_season_count = 5
    average_mins = 0

    # Check for (if remaining) Regular Season Game
    pgl = PlayerGameLog(
            player_id=nba_player_id,                 
            season=get_current_season(),
            season_type_all_star='Regular Season'
        )
    games_df = pgl.get_data_frames()[0]
    
    for i in range(5):
        curr = games_df.iloc[i]
        matchup = curr['MATCHUP']            
        if ' vs. ' in matchup:
            location = 'Home'
            opp_abbr = matchup.split(' vs. ')[1]
        elif ' @ ' in matchup:
            location = 'Away'
            opp_abbr = matchup.split(' @ ')[1]
        else:
            location = 'Unknown'
            opp_abbr = None
        # lookup full name & logo
        opp_full = get_team_full_name_from_abbr(opp_abbr) if opp_abbr else None
        opp_id   = get_team_id_from_abbr(opp_abbr)        if opp_abbr else None
        opp_logo = get_team_logo_url(opp_id)              if opp_id   else None
        # minutes (takes only the minute portion if it's "MM:SS")
        raw_min = curr.get('MIN', '')
        if isinstance(raw_min, str) and ':' in raw_min:
            minutes = int(raw_min.split(':')[0])
        else:
            minutes = int(raw_min) if raw_min else 0
        last_5_regular_games_avg += int(curr['PTS'])

        if int(curr['PTS']) <= threshold:
                underCount += 1
        
        average_mins += minutes
        
        last_5_regular_games.append({
            "gameId":           curr['Game_ID'],
            "date":             curr['GAME_DATE'],
            "points":           int(curr['PTS']),
            "opponent":         opp_abbr,
            "opponentFullName": opp_full,
            "opponentLogo":     opp_logo,
            "location":         location,
            "minutes":          minutes,
            "gameType":         "Regular Season"
        })
    
    last_5_regular_games_avg /= 5

    home_games = 0
    away_games = 0
    points_home_avg = 0
    points_away_avg = 0
    minutes_home_avg = 0
    minutes_away_avg = 0

    pgl = PlayerGameLog(
            player_id=nba_player_id,                 
            season=get_current_season(),
            season_type_all_star='Regular Season'
        )
    games_df = pgl.get_data_frames()[0]
    for i in range(5, len(games_df)):
        curr = games_df.iloc[i]
        matchup = curr['MATCHUP']            
        if ' vs. ' in matchup:
            location = 'Home'
        elif ' @ ' in matchup:
            location = 'Away'
        
        num_season_count += 1

        # minutes (takes only the minute portion if it's "MM:SS")
        raw_min = curr.get('MIN', '')
        if isinstance(raw_min, str) and ':' in raw_min:
            minutes = int(raw_min.split(':')[0])
        else:
            minutes = int(raw_min) if raw_min else 0

        if location == 'Home':
            if curr['PTS'] is None:
                continue
            else:
                points_home_avg += int(curr['PTS'])
            if minutes is None:
                continue
            else:
                minutes_home_avg += minutes
            home_games += 1
        elif location == 'Away':
            if curr['PTS'] is None:
                continue
            else:
                points_away_avg += int(curr['PTS'])
            if minutes is None:
                continue
            else:
                minutes_away_avg += minutes
            away_games += 1
        

        average_mins += minutes

        if int(curr['PTS']) <= threshold:
            underCount += 1

    
    average_mins /= num_season_count
    playoff_minutes_avg /= num_playoff_games if num_playoff_games > 0 else 0
    points_home_avg /= playoff_home_games if playoff_home_games > 0 else 0
    points_away_avg /= playoff_away_games if playoff_away_games > 0 else 0
    minutes_home_avg /= playoff_home_games if playoff_home_games > 0 else 0
    minutes_away_avg /= playoff_away_games if playoff_away_games > 0 else 0


    player_performace_dict = analyze_player_performance(nba_player_id, current_season_str)
    if not player_performace_dict:
        player_performace_dict['avg_fga'] = None
        player_performace_dict['avg_fgm'] = None
        player_performace_dict['avg_fpa'] = None
        player_performace_dict['avg_3pm'] = None
        player_performace_dict['avg_fta'] = None
        player_performace_dict['avg_ftm'] = None
        player_performace_dict['avg_tov'] = None
        player_performace_dict['shot_dist_3pt'] = None
        player_performace_dict['ft_rate'] = None
        player_performace_dict['efg'] = None
        player_performace_dict['ts_pct'] = None

    # Get Team Data Metrics To Calculate Usage Rate
    from nba_api.stats.endpoints import TeamGameLog
    def fetch_team_stats_for_usage(team_id, season):
        """
        Fetches per‐game averages for every team, then adds an 'AVG_POSS' column.
        """
        gamelog_df = TeamGameLog(team_id=team_id, season=season).get_data_frames()[0]
        return (
            float(gamelog_df['FGA'].mean()),
            float(gamelog_df['FTA'].mean()),
            float(gamelog_df['TOV'].mean())
        )
        

    team_fga, team_fta, team_tov = fetch_team_stats_for_usage(player_team_id, get_current_season())

    # ── importance metrics ───────────────────────────────────────────────────
    alpha = 0.7
    usage_rate = (
        (player_performace_dict['avg_fga'] + 0.475*player_performace_dict['avg_fta'] + player_performace_dict['avg_tov']) * 240
        / (average_mins * (team_fga + 0.475*team_fta + team_tov))
    )


    importance_score = round(alpha * (average_mins / 48) + (1 - alpha) * usage_rate, 2)
    if importance_score >= 0.6:
        importance_role = "Starter"
    elif importance_score >= 0.3:
        importance_role = "Rotation"
    else:
        importance_role = "Bench"

    # If player has no playoff data
    if playoff_games == []:
        num_playoff_games = None
        playoff_games = []
        playoff_avg = None
        playoff_minutes_avg = None
        playoff_underCount = None
        playoff_points_home_avg = None
        playoff_home_games = None
        playoff_points_away_avg = None
        playoff_minutes_away_avg = None
        playoff_minutes_away_avg = None
        playoff_away_games = None

    

    # Build the original player data object with preserved keys
    player_data = {
        "playerId": nba_player_id,
        "name": player_name,
        "position": player_position,
        "photoUrl": player_image_url,


        "gameId": next_game_id,
        "gameDate": game_date_str,
        "gameTime": game_date_est,
        "matchup": matchup,
        "gameType": next_game_type,
        "gameStatus" : "Scheduled",
        "home_game": home_game,


        "team": player_team,
        "teamConference": player_team_conference,
        "teamPlayoffRank": player_team_playoffRank,
        "teamLogo": player_team_logo,


        "opponent": opponent_team_name,
        "opponentConference": opponent_team_conference,
        "opponentPlayoffRank": opponent_team_playoffRank,
        "opponentLogo": opponent_team_logo,
        

        "threshold": threshold,
        "last5RegularGames": last_5_regular_games,
        "num_season_games" : num_season_count,
        "seasonAvgPoints": season_avg_points,
        "points_home_avg": playoff_points_home_avg,
        "points_away_avg": playoff_points_away_avg,
        "average_mins": average_mins,
        "importanceScore": importance_score,
        "importanceRole": importance_role,
        "minutes_home_avg": minutes_home_avg,
        "minutes_away_avg": minutes_away_avg,
        "seasonAvgVsOpponent": season_avg_points_vs_opponent,
        "careerAvgVsOpponent": career_avg_points_vs_opponent,
        "last5RegularGamesAvg": last_5_regular_games_avg,
        "season_games_agst_opp" : fetch_all_opponent_games(nba_player_id, opponent_abbr),
        "underCount" : underCount,

        # Advanced metrics
        "avg_fga": player_performace_dict['avg_fga'],
        "avg_fgm": player_performace_dict['avg_fgm'],
        "avg_3pa": player_performace_dict['avg_3pa'],
        "avg_3pm": player_performace_dict['avg_3pm'],
        "avg_fta": player_performace_dict['avg_fta'],
        "avg_ftm": player_performace_dict['avg_ftm'],
        "avg_tov": player_performace_dict['avg_tov'],
        "shot_dist_3pt": player_performace_dict['shot_dist_3pt'],
        "ft_rate": player_performace_dict['ft_rate'],
        "efg": player_performace_dict['efg'],
        "ts_pct": player_performace_dict['ts_pct'],
        "usage_rate": usage_rate,
        

        # Playoff data
        "playoff_games":     playoff_games[::-1],
        "num_playoff_games": num_playoff_games,
        "playoff_curr_score": playoff_curr_score,
        "playoff_round": playoff_round,
        "playoffAvg":       playoff_avg,
        "playoff_points_home_avg": playoff_points_home_avg,
        "playoff_points_away_avg": playoff_points_away_avg,
        "playoff_minutes_avg" : playoff_minutes_avg,
        "playoff_minutes_home_avg": playoff_minutes_home_avg,
        "playoff_minutes_away_avg": playoff_minutes_away_avg,
        "playoff_underCount" : playoff_underCount
    }    


    return player_data

if __name__ == "__main__":
    player_info = analyze_player("aaron", "nesmith", threshold=20)
    print(player_info)