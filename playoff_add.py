#!/usr/bin/env python3
import firebase_admin
from firebase_admin import firestore
from nba_api.stats.endpoints import PlayerGameLog
from nba_api.stats.static import teams
import time
from typing import Optional
from nba_api.stats.endpoints import TeamGameLog

_player_gamelog_df_cache = {}     # player_id  -> full pd.DataFrame
_team_gamelog_df_cache   = {}     # team_id    -> full pd.DataFrame

def init_firestore():
    """
    Initialize the Firestore client.
    Locally: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON.
    In Cloud Run/Functions: no extra setup needed.
    """
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()

def _safe_div(num: float, den: float) -> Optional[float]:
    """Return num/den or None if denominator is zero (avoids -1 magic numbers)."""
    return num / den if den else None

def _slice_before_game(df, game_id):
    """
    Return a sub-DF containing only rows BEFORE the supplied Game_ID.
    Assumes df is in chronological order (earliest first).
    """
    # index of the current game (will raise if not in DF – good sanity check)
    idx_curr = df.index[df["Game_ID"] == game_id][0]
    return df.iloc[:idx_curr]              # everything *before* that row

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

def fetch_team_stats_for_usage(team_id, season, game_id):
    if team_id in _team_gamelog_df_cache:
        df = _team_gamelog_df_cache[team_id]
    else:
        df = TeamGameLog(team_id=team_id, season=season, season_type_all_star='Playoffs').get_data_frames()[0][::-1].reset_index(drop=True)
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


# Get team logo URL
def get_team_logo_url(team_id):
    return f"https://cdn.nba.com/logos/nba/{team_id}/global/L/logo.svg"


def add_data_metric():
    db = init_firestore()
    concluded = (
        db.collection("processedPlayers")
          .document("players")
          .collection("concluded")
    )
    j = 1

    for doc_snap in concluded.stream():

        # Uncomment the next two lines if you only want to add it when missing:
        data = doc_snap.to_dict() or {}

        playerId = data['playerId']
        teamId = data['playerTeamId']
        gameId = data['gameId']


        playoff_num_games = 0


        # Playoff Game First
        playoff_games = []
        playoff_minutes_avg = 0
        playoff_underCount = 0
        playoff_points_home_avg = 0
        playoff_home_games = 0
        playoff_points_away_avg = 0
        playoff_minutes_home_avg = 0
        playoff_minutes_away_avg = 0
        playoff_away_games = 0
        playoff_curr_score = ""
        
        playoff_totals = dict(
            fga=0, fgm=0,
            pa3=0, pm3=0,
            fta=0, ftm=0,
            tov=0, points=0
        )

        if data['gameType'] == "Playoffs":

            if playerId in _player_gamelog_df_cache:
                games_df = _player_gamelog_df_cache[playerId]

            else:
                pgl = PlayerGameLog(
                    player_id=playerId,
                    season='2024-25',
                    season_type_all_star='Playoffs'
                )
                games_df = pgl.get_data_frames()[0]
                _player_gamelog_df_cache[playerId] = games_df
            
            # most recent game is first row
            game = 1
            round_playoff_game = 0
            series_score = "0-0"
            type_playoff_game = ['Conference First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals']

            
            for i in range(len(games_df)):
                
                curr = games_df.iloc[len(games_df) - 1 - i]
                # check if curr is the upcomming game

                if data['gameId'] == curr['Game_ID']:
                    break
                else:
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

                    if int(curr['PTS']) <= data['threshold']:
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

                    # Advanced Metrics
                    fga  = int(curr.get("FGA", 0))
                    fgm  = int(curr.get("FGM", 0))
                    pa3  = int(curr.get("FG3A", 0))
                    pm3  = int(curr.get("FG3M", 0))
                    fta  = int(curr.get("FTA", 0))
                    ftm  = int(curr.get("FTM", 0))
                    tov  = int(curr.get("TOV", 0))
                    pts  = int(curr.get("PTS", 0))

                    playoff_totals["fga"]  += fga
                    playoff_totals["fgm"]  += fgm
                    playoff_totals["pa3"]  += pa3
                    playoff_totals["pm3"]  += pm3
                    playoff_totals["fta"]  += fta
                    playoff_totals["ftm"]  += ftm
                    playoff_totals["tov"]  += tov
                    playoff_totals["points"]  += pts

                
            playoff_num_games = len(playoff_games)
            playoff_points_avg = (playoff_points_home_avg+playoff_points_away_avg) / playoff_num_games if playoff_num_games > 0 else None
            playoff_minutes_avg = playoff_minutes_avg / playoff_num_games if playoff_num_games > 0 else None
            playoff_points_home_avg = playoff_points_home_avg / playoff_home_games if playoff_home_games > 0 else None
            playoff_points_away_avg = playoff_points_away_avg / playoff_away_games if playoff_away_games > 0 else None
            playoff_minutes_home_avg = playoff_minutes_home_avg / playoff_home_games if playoff_home_games > 0 else None
            playoff_minutes_away_avg = playoff_minutes_away_avg / playoff_away_games if playoff_away_games > 0 else None



            playoff_FGA   = playoff_totals["fga"]
            playoff_FTA   = playoff_totals["fta"]
            # ── advanced rates ──────────────────────────────────────────────────────────
            playoff_efg          = _safe_div(playoff_totals["fgm"] + 0.5 * playoff_totals["pm3"], playoff_FGA)
            playoff_shot_dist_3p = _safe_div(playoff_totals["pa3"], playoff_FGA)
            playoff_ft_rate      = _safe_div(playoff_FTA, playoff_FGA)
            # optional: True Shooting % (not returned in tuple to avoid breaking order)
            playoff_ts_pct       = _safe_div(playoff_totals["points"], 2 * (playoff_FGA + 0.44 * playoff_FTA))

            # ── per-game averages ───────────────────────────────────────────────────────
            per_game = lambda x: _safe_div(x, playoff_num_games)



            if playoff_games:
                last_game = playoff_games[-1]             # most-recent playoff game on record


                if last_game['game_number'] == 7:
                    # Series finished → reset score and advance round IF another exists
                    playoff_curr_score = "0-0"
                    next_round_idx = round_playoff_game + 1
                    playoff_round = (
                        type_playoff_game[next_round_idx]
                        if next_round_idx < len(type_playoff_game)
                        else type_playoff_game[-1]      # stay on “NBA Finals” if we’re already there
                    )
                    playoff_game_number = 1
                else:
                    # Series still in progress
                    playoff_curr_score = last_game['series_score']
                    playoff_round = type_playoff_game[round_playoff_game]
                    playoff_game_number = last_game['game_number'] + 1
            else:
                # No playoff data yet
                playoff_curr_score = "0-0"
                playoff_round = type_playoff_game[round_playoff_game]
                playoff_game_number = 1



            playoff_team_fga, playoff_team_fta, playoff_team_tov = fetch_team_stats_for_usage(teamId, "2024-25", gameId)
            if any(value is None for value in [playoff_team_fga, playoff_team_fta, playoff_team_tov]):
                print(data['name'], data['team'], data['matchup'], data['gameDate'], data['playoff_round'], data['playoff_curr_series_score'], "Game:", data['playoff_curr_game_num'])


            doc_snap.reference.update({

                "playoff_games": playoff_games[::-1],
                #"playoff_round": playoff_round,
                #"playoff_curr_series_score": playoff_curr_score,
                #"playoff_curr_game_num": playoff_game_number, 

                #"playoff_num_games": playoff_num_games,
                #"playoff_underCount": playoff_underCount,

                #"playoff_points_avg": playoff_points_avg,
                #"playoff_points_home_avg": playoff_points_home_avg,
                #"playoff_points_away_avg": playoff_points_away_avg,

                #"playoff_minutes_avg": playoff_minutes_avg,
                #"playoff_minutes_home_avg": playoff_minutes_home_avg,
                #"playoff_minutes_away_avg": playoff_minutes_away_avg,

                #"playoff_avg_fga": per_game(playoff_totals["fga"]),
                #"playoff_avg_fgm": per_game(playoff_totals["fgm"]),
                #"playoff_avg_3pa": per_game(playoff_totals["pa3"]),
                #"playoff_avg_3pm": per_game(playoff_totals["pm3"]),
                #"playoff_avg_fta": per_game(playoff_totals["fta"]),
                #"playoff_avg_ftm": per_game(playoff_totals["ftm"]),
                #"playoff_avg_tov": per_game(playoff_totals["tov"]),
                #"playoff_shot_dist_3pt": playoff_shot_dist_3p,
                #"playoff_ft_rate": playoff_ft_rate,
                #"playoff_efg": playoff_efg,
                #"playoff_ts_pct": playoff_ts_pct,

                #"playoff_team_fga": playoff_team_fga,
                #"playoff_team_fta": playoff_team_fta,
                #"playoff_team_tov": playoff_team_tov
            })

            print(f"{j}: ✅  {doc_snap.id!r}: Added 'playoff variables'")

        j+=1
    else:
        print(f"{j}: ❌  {doc_snap.id!r}: Failed to add 'playoff variables'")



if __name__ == "__main__":
    add_data_metric()