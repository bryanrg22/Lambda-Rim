from nba_api.stats.endpoints import TeamGameLog
from nba_api.stats.endpoints import playergamelog
from typing import Optional
import firebase_admin
from firebase_admin import firestore


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

def fetch_team_stats_for_usage(team_id, season, game_id, gameType):
    if team_id in _team_gamelog_df_cache:
        df = _team_gamelog_df_cache[team_id]
    else:
        df = TeamGameLog(team_id=team_id, season=season).get_data_frames()[0][::-1].reset_index(drop=True)
        _team_gamelog_df_cache[team_id] = df

    if df.empty:
        return None, None, None
    
    if gameType != "Playoffs":
        df = _slice_before_game(df, game_id)

    return (
        df["FGA"].mean(),
        df["FTA"].mean(),
        df["TOV"].mean(),
    )

def calculate_importance_metrics(fga, fta, tov, mins, team_fga, team_fta, team_tov):
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

    return usage_rate, importance_score, importance_role


def main():
    # STEP 1: INITIALIZE FIREBASE
    db = init_firestore()
    concluded = (
        db.collection("processedPlayers")
          .document("players")
          .collection("concluded")
    )
    j = 1

    docs = list(concluded.stream())


    for doc_snap in docs:
 
        data = doc_snap.to_dict() or {}
        
        # STEP 2: GET PLAYER ID AND TEAM ID
        pick_id = data["pick_id"]
        player_id = data['playerId']
        player_team_id = data['playerTeamId']
        game_id = data['gameId']
        threshold = data['threshold']
        playoff_num_games = data['playoff_num_games']


        # STEP 3: GET ESSENTIAL DATA METRICS
        underCount = 0
        average_mins = 0
        home_games = 0
        away_games = 0
        points_home_avg = 0
        points_away_avg = 0
        minutes_home_avg = 0
        minutes_away_avg = 0
        num_season_count = 0

        totals = dict(
            fga=0, fgm=0,
            pa3=0, pm3=0,
            fta=0, ftm=0,
            tov=0, poss=0,
            points=0,
        )

        # Check for (if remaining) Regular Season Game
        if player_id in _player_gamelog_df_cache:
            games_df = _player_gamelog_df_cache[player_id]
        else:
            games_df = playergamelog.PlayerGameLog(
                    player_id=player_id,
                    season="2024-25",
                    season_type_all_star='Regular Season'
                ).get_data_frames()[0][::-1]   # reverse → chronological
            _player_gamelog_df_cache[player_id] = games_df


        for i in range(len(games_df)):

            curr = games_df.iloc[len(games_df) - 1 - i]
            
            if data['gameId'] == curr['Game_ID']:
                break
            else:
                
                # minutes (takes only the minute portion if it's "MM:SS")
                raw_min = curr['MIN']
                if isinstance(raw_min, str) and ':' in raw_min:
                    minutes = int(raw_min.split(':')[0])
                else:
                    minutes = int(raw_min) if raw_min else 0


                matchup = curr['MATCHUP']
                if ' vs. ' in matchup:
                    if curr['PTS'] is None:
                        continue
                    else:
                        points_home_avg += int(curr['PTS'])
                    if minutes is None:
                        continue
                    else:
                        minutes_home_avg += minutes
                    home_games += 1
                elif ' @ ' in matchup:
                    if curr['PTS'] is None:
                        continue
                    else:
                        points_away_avg += int(curr['PTS'])
                    if minutes is None:
                        continue
                    else:
                        minutes_away_avg += minutes
                    away_games += 1
                
                num_season_count += 1
                average_mins += minutes


                if int(curr['PTS']) <= threshold:
                    underCount += 1

                fga  = int(curr.get("FGA", 0))
                fgm  = int(curr.get("FGM", 0))
                pa3  = int(curr.get("FG3A", 0))
                pm3  = int(curr.get("FG3M", 0))
                fta  = int(curr.get("FTA", 0))
                ftm  = int(curr.get("FTM", 0))
                tov  = int(curr.get("TOV", 0))
                pts  = int(curr.get("PTS", 0))


                totals["fga"]  += fga
                totals["fgm"]  += fgm
                totals["pa3"]  += pa3
                totals["pm3"]  += pm3
                totals["fta"]  += fta
                totals["ftm"]  += ftm
                totals["tov"]  += tov
                totals['points'] += pts


        G     = num_season_count
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


        player_performace_dict = {
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
            "ts_pct": ts_pct,
            "games": G
        }

        
        average_mins /= num_season_count if num_season_count > 0 else 0
        points_home_avg /= home_games if home_games > 0 else 0
        points_away_avg /= away_games if away_games > 0 else 0
        minutes_home_avg /= home_games if home_games > 0 else 0
        minutes_away_avg /= away_games if away_games > 0 else 0

        
        
        # Get Team Data Metrics To Calculate Usage Rate
        team_fga, team_fta, team_tov = fetch_team_stats_for_usage(player_team_id, "2024-25", game_id, data['gameType'])

        if playoff_num_games > 3:
        # ── importance metrics ───────────────────────────────────────────────────
            importance = {'fga': data['playoff_avg_fga'], 'fta': data['playoff_avg_fta'], 'tov': data['playoff_avg_tov'], 'mins': data['playoff_minutes_avg'], 'team_fga': data['playoff_team_fga'], 'team_fta': data['playoff_team_fta'], 'team_tov': data['playoff_team_tov']}
        else:
            importance = {'fga': player_performace_dict['avg_fga'], 'fta': player_performace_dict['avg_fta'], 'tov': player_performace_dict['avg_tov'], 'mins': average_mins, 'team_fga': team_fga, 'team_fta': team_fta, 'team_tov': team_tov}
        
        if any(value is None for value in importance.values()):
            print(f"⚠️ Warning: No team stats found for player {player_id} in game {game_id}.")
            usage_rate = None
            importance_score = None
            importance_role = None
        else:
            usage_rate, importance_score, importance_role = calculate_importance_metrics(importance['fga'], importance['fta'], importance['tov'], importance['mins'], importance['team_fga'], importance['team_fta'], importance['team_tov'])

        
        
        doc_snap.reference.update({
            'average_mins': average_mins,
            'points_home_avg': points_home_avg,
            'points_away_avg': points_away_avg,
            'minutes_home_avg': minutes_home_avg,
            'minutes_away_avg': minutes_away_avg,
            'underCount': underCount,
            'num_season_games': num_season_count,


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
            'team_fga': team_fga,
            'team_fta': team_fta,
            'team_tov': team_tov,


            "usage_rate": usage_rate,
            "importanceScore": importance_score,
            "importanceRole": importance_role
        })


        print(f"{j} ✅ {pick_id}: Injury Report Completed") 
        j += 1

    print(f"✅✅ Added 'Advanced Metrics' fields to all {j-1} players.")


if __name__ == "__main__":
    main()