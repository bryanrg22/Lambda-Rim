#!/usr/bin/env python3
import firebase_admin
from firebase_admin import firestore
import pandas as pd
from arch import arch_model
from nba_api.stats.static import teams

#from nba_api.stats.endpoints import BoxScoreTraditionalV2

def init_firestore():
    """
    Initialize the Firestore client.
    Locally: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON.
    In Cloud Run/Functions: no extra setup needed.
    """
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()



def forecast_volatility(point_series):
    """
    Fit a GARCH(1,1) to the day-to-day returns of points
    and return the 1-step ahead forecasted σ (std. dev).
    """
    # day-to-day diff
    returns = point_series.diff().dropna()
    if len(returns) < 10:
        return 0.0

    # p=1, q=1
    model = arch_model(returns, vol="Garch", p=1, q=1)
    res   = model.fit(disp="off")
    # variance forecast horizon=1
    var_forecast = res.forecast(horizon=1).variance.iloc[-1, 0]
    return float(var_forecast ** 0.5)


def forecast_playoff_volatility(player_data):
    po = player_data.get("playoff_games", [])[:]
    dates = [pd.to_datetime(g["date"]) for g in po]
    pts   = [g["points"] for g in po]
    series = pd.Series(data=pts, index=dates).sort_index()
    return forecast_volatility(series)

_player_info_cache   = {}


def add_data_metric():
    db = init_firestore()
    concluded = (
        db.collection("processedPlayers")
          .document("players")
          .collection("concluded")
    )
    i = 1

    #var = "play"
    #value = None
    for doc_snap in concluded.stream():
        # Uncomment the next two lines if you only want to add it when missing:
        data = doc_snap.to_dict() or {}

        #if data["playoff_num_games"] >= 5:
        #    volatilityPlayOffsForecast = forecast_playoff_volatility(data)
        #    print(f"{data['pick_id']} = {volatilityPlayOffsForecast}")
        #else:
        #    volatilityPlayOffsForecast = None
        #    print(f"{data['pick_id']} = {volatilityPlayOffsForecast} - Less than 5 Games")

        #if volatilityPlayOffsForecast == 0.0:
        #    print(data['playoff_games'])

        #pick_id = data["pick_id"]
        #player_id = data['playerId']
        #player_team = data['team']
        #opponent = data['opponent']



        #if player_team in _player_info_cache:
        #    player_team_id = _player_info_cache[player_team]
        #else:
        #    player_team_id = teams.find_teams_by_full_name(player_team)[0]["id"]
        #    _player_info_cache[player_team] = player_team_id

        #if opponent in _player_info_cache:
        #    opponent_team_id = _player_info_cache[opponent]
        #else:
        #    opponent_team_id = teams.find_teams_by_full_name(opponent)[0]["id"]
        #    _player_info_cache[opponent] = opponent_team_id



        doc_snap.reference.update({
            'season': '2024-25'
        })
        print(f"{i}: ✅  {doc_snap.id!r}: Added 'Variables'")
            
        
        # Set (or overwrite) the 'location' field to "Home"
        #doc_snap.reference.update({
        #    var: value
        #})
        #print(f"{i}: ✅  {doc_snap.id!r}: Added '{var} = {value}'")

        
        #else:
            #print(f"{i}: ❌  {doc_snap.id!r} already has '{var} = {data[var]}'")

        i+=1

if __name__ == "__main__":
    add_data_metric()