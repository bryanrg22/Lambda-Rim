import math
import json
import os
from openai import OpenAI

from math import factorial, exp
# If you have scipy, you could do "from scipy.stats import poisson"
# but here we implement Poisson manually.

#############################
# Existing Helper Functions (unchanged)
#############################

def calculate_poisson_probability(avg_points, threshold):
    """
    Calculate the probability of scoring at least 'threshold' points,
    assuming the player's scoring follows a Poisson distribution with mean 'avg_points'.
    """
    threshold_int = math.ceil(threshold)
    
    cumulative = sum(
        (avg_points**i * math.exp(-avg_points)) / math.factorial(i)
        for i in range(threshold_int)
    )
    probability = 1 - cumulative
    return probability




from injury_report import get_player_injury_status_new as check_injury_status

#############################
# Existing (to be modified): get_opponent_defensive_rank
#############################
def get_opponent_defensive_rank(opponent_team):
    """
    Retrieve the opponent's defensive rank.
    This method currently returns None if we have no real data.
    """
    return None

#############################
# Existing (to be modified): get_advanced_data
#############################
def get_advanced_data(player_name):
    """
    Retrieve advanced metrics such as usage rate, shooting metrics, and betting context.
    Return None or partial data if not available, with no dummy placeholders.
    """
    return {
        "usage_rate": None,
        "TS%": None,
        "eFG%": None,
        "betting_context": {
            "vegas_spread": None,
            "moneyline": None,
            "total_points": None
        },
        "psych_factors": "No real data source implemented yet."
    }

#############################
# Existing: aggregate_prediction_data
# CHANGED to reference check_injury_status from the real function
#############################
def aggregate_prediction_data(player_data, threshold):
    threshold = float(threshold)
    
    team_info = {
        "team": player_data["team"],
        "opponent": player_data["opponent"],
        "home_away": "Home" if player_data.get("matchup", "").find("vs.") != -1 else "Away"
    }
    
    season_averages = {
        "PPG": player_data.get("seasonAvgPoints") or 0,
        "MPG": None,
        "FG%": None,
        "3P%": None
    }
    
    recent_games = player_data.get("last5Games", [])
    
    matchup_specific = {
        "PPG_vs_opponent": player_data.get("seasonAvgVsOpponent") or player_data.get("careerAvgVsOpponent") or 0
    }
    
    advanced_data = get_advanced_data(player_data["name"])
    
    # ### CHANGED: call the real function
    injury_status = check_injury_status(
        player_data["name"],
        player_data.get("team"),
        player_data.get("opponent"),
    )
    
    opp_def_rank = get_opponent_defensive_rank(player_data["opponent"])
    
    season_avg = player_data.get("seasonAvgPoints") or 0
    poisson_prob = calculate_poisson_probability(season_avg, threshold)
    
    aggregated_data = {
        "team_info": team_info,
        "season_averages": season_averages,
        "recent_games": recent_games,
        "matchup_specific": matchup_specific,
        "advanced_data": advanced_data,
        "injury_status": injury_status,
        "opponent_defensive_rank": opp_def_rank,
        "poisson_probability": poisson_prob,
        "score_threshold": threshold
    }
    
    return aggregated_data

def get_player_prediction(player_data, threshold):
    """Deprecated – we no longer make a second GPT call."""
    return {}

#############################
# NEW SECTIONS: 
#    compute_expected_points, 
#    poisson_pmf, 
#    predict_player_points_poisson
#############################
def compute_expected_points(player_id, opponent_id, game_date):
    from player_analyzer import analyze_player_performance
    from game_results import get_opponent_stats  # If you have a real implementation that returns stats
    
    season_stats = analyze_player_performance(player_id, "2025")
    
    usage_rate = season_stats.get("usage_rate", 0)
    efg = season_stats.get("efg", 0)
    avg_minutes = season_stats.get("avg_minutes", 0)

    try:
        opp_def_rating, opp_off_rating, opp_pace = get_opponent_stats(opponent_id, "2025")
    except Exception as e:
        opp_def_rating, opp_off_rating, opp_pace = 0, 0, 100
    
    net_rating_diff = opp_off_rating - opp_def_rating
    blowout_factor = 0.9 if abs(net_rating_diff) > 10 else 1.0

    # This function doesn't exist in your code, so you must implement it or handle differently:
    is_home_game = check_if_home_game(player_id, game_date)  # Pseudo-code
    home_away_factor = 1.05 if is_home_game else 1.0 if is_home_game is not None else 1.0

    league_avg_pace = 100.0
    pace_factor = opp_pace / league_avg_pace if opp_pace else 1.0

    base_points = usage_rate * efg * pace_factor * (avg_minutes * blowout_factor) * 2.0
    expected_points = base_points * home_away_factor

    return expected_points

def poisson_pmf(k, lam):
    return (math.exp(-lam) * (lam ** k)) / math.factorial(k)

def predict_player_points_poisson(player_id, opponent_id, game_date, threshold):
    lam = compute_expected_points(player_id, opponent_id, game_date)
    if lam <= 0:
        return {
            "player_id": player_id,
            "opponent_id": opponent_id,
            "game_date": game_date,
            "lambda_est": lam,
            "threshold": threshold,
            "p_over_threshold": 0.0
        }

    threshold_int = math.ceil(threshold)
    p_le_threshold = sum(poisson_pmf(k, lam) for k in range(threshold_int + 1))
    p_over_threshold = 1.0 - p_le_threshold

    return {
        "player_id": player_id,
        "opponent_id": opponent_id,
        "game_date": game_date,
        "lambda_est": lam,
        "threshold": threshold_int,
        "p_over_threshold": p_over_threshold
    }
