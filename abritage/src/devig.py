from scipy.optimize import brentq

from src.config import SPORTSBOOK_WEIGHTS, DEFAULT_WEIGHT, BREAKEVEN_THRESHOLDS


def american_to_probability(odds: int) -> float:
    """Convert American odds to implied probability.

    Args:
        odds: American odds integer (e.g., -145, +125)

    Returns:
        Implied probability as float between 0 and 1
    """
    if odds < 0:
        return abs(odds) / (abs(odds) + 100)
    else:
        return 100 / (odds + 100)


def devig_power(over_odds: int, under_odds: int) -> tuple[float, float]:
    """Remove vig using the power method.

    Finds exponent k such that IP_over^k + IP_under^k = 1.
    Fair probabilities are then IP_over^k and IP_under^k.

    Args:
        over_odds: American odds for the over (e.g., -145)
        under_odds: American odds for the under (e.g., +125)

    Returns:
        Tuple of (fair_over_probability, fair_under_probability) summing to 1.0
    """
    ip_over = american_to_probability(over_odds)
    ip_under = american_to_probability(under_odds)

    def objective(k):
        return ip_over**k + ip_under**k - 1.0

    k = brentq(objective, 0.5, 2.0)
    return ip_over**k, ip_under**k


def build_consensus(books_data: list[dict]) -> float:
    """Build weighted consensus probability from multiple sportsbooks.

    Args:
        books_data: List of dicts with keys 'book' (str) and 'fair_over' (float)

    Returns:
        Weighted average fair over probability
    """
    total_weight = 0
    weighted_sum = 0

    for book in books_data:
        w = SPORTSBOOK_WEIGHTS.get(book["book"], DEFAULT_WEIGHT)
        weighted_sum += w * book["fair_over"]
        total_weight += w

    return weighted_sum / total_weight


def calculate_edge(fair_prob: float, entry_type: str = "6-pick-flex") -> float:
    """Calculate edge as fair_prob minus break-even threshold.

    Args:
        fair_prob: Consensus fair probability (float, 0-1)
        entry_type: PrizePicks entry type string

    Returns:
        Edge as float (e.g., 0.0294 means +2.94%)
    """
    return fair_prob - BREAKEVEN_THRESHOLDS[entry_type]
