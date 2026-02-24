"""
Tests for src/devig.py -- pure math, no API calls, no credits consumed.
Run freely: python -m pytest tests/test_devig.py -v
"""
import pytest

from src.devig import american_to_probability, devig_power, build_consensus, calculate_edge


class TestAmericanToProbability:
    """Test 2: American odds -> implied probability conversion."""

    @pytest.mark.parametrize("odds, expected", [
        (-100, 0.5000),
        (-110, 0.5238),
        (-150, 0.6000),
        (-200, 0.6667),
        (+100, 0.5000),
        (+110, 0.4762),
        (+150, 0.4000),
        (+200, 0.3333),
        (-145, 0.5918),
        (+125, 0.4444),
    ])
    def test_conversion(self, odds, expected):
        result = american_to_probability(odds)
        assert abs(result - expected) < 0.001, (
            f"american_to_probability({odds:+d}) = {result:.4f}, expected {expected:.4f}"
        )

    def test_negative_odds_returns_above_50(self):
        """Negative odds (favorites) should always return > 0.5."""
        for odds in [-110, -150, -200, -300, -500]:
            prob = american_to_probability(odds)
            assert prob > 0.5, f"Odds {odds} should give prob > 0.5, got {prob}"

    def test_positive_odds_returns_below_50(self):
        """Positive odds (underdogs) should always return < 0.5."""
        for odds in [110, 150, 200, 300, 500]:
            prob = american_to_probability(odds)
            assert prob < 0.5, f"Odds +{odds} should give prob < 0.5, got {prob}"

    def test_even_odds_both_sides(self):
        """Both -100 and +100 should return exactly 0.5."""
        assert american_to_probability(-100) == 0.5
        assert american_to_probability(100) == 0.5


class TestDevigPower:
    """Test 3: Power method de-vig."""

    @pytest.mark.parametrize("over_odds, under_odds, exp_over, exp_under", [
        (-110, -110, 0.5000, 0.5000),
        (-145, +125, 0.5724, 0.4276),
        (-140, +120, 0.5641, 0.4359),
        (-200, +170, 0.6508, 0.3492),
        (-120, +100, 0.5232, 0.4768),
    ])
    def test_devig_values(self, over_odds, under_odds, exp_over, exp_under):
        fair_over, fair_under = devig_power(over_odds, under_odds)

        assert abs(fair_over - exp_over) < 0.01, (
            f"Fair over for ({over_odds:+d}/{under_odds:+d}): "
            f"got {fair_over:.4f}, expected {exp_over:.4f}"
        )
        assert abs(fair_under - exp_under) < 0.01, (
            f"Fair under for ({over_odds:+d}/{under_odds:+d}): "
            f"got {fair_under:.4f}, expected {exp_under:.4f}"
        )

    @pytest.mark.parametrize("over_odds, under_odds", [
        (-110, -110),
        (-145, +125),
        (-140, +120),
        (-200, +170),
        (-120, +100),
        (-130, +110),
        (-160, +140),
        (-180, +155),
    ])
    def test_fair_probs_sum_to_one(self, over_odds, under_odds):
        """Critical property: fair_over + fair_under must equal 1.0."""
        fair_over, fair_under = devig_power(over_odds, under_odds)
        total = fair_over + fair_under

        assert abs(total - 1.0) < 0.0001, (
            f"Fair probs for ({over_odds:+d}/{under_odds:+d}) "
            f"sum to {total:.6f}, expected 1.000000"
        )

    def test_devig_removes_vig(self):
        """Implied probs sum to > 1 (vig), fair probs sum to exactly 1."""
        ip_over = american_to_probability(-145)
        ip_under = american_to_probability(125)
        implied_total = ip_over + ip_under
        assert implied_total > 1.0, f"Implied total should be > 1, got {implied_total}"

        fair_over, fair_under = devig_power(-145, 125)
        fair_total = fair_over + fair_under
        assert abs(fair_total - 1.0) < 0.0001, f"Fair total should be 1.0, got {fair_total}"

    def test_devig_preserves_direction(self):
        """The favorite should still be the favorite after de-vig."""
        fair_over, fair_under = devig_power(-145, 125)
        assert fair_over > fair_under, "Over was favorite but de-vig flipped it"

    def test_symmetric_odds_give_50_50(self):
        """Symmetric odds like -110/-110 should de-vig to exactly 50/50."""
        fair_over, fair_under = devig_power(-110, -110)
        assert abs(fair_over - 0.5) < 0.0001
        assert abs(fair_under - 0.5) < 0.0001


class TestBuildConsensus:
    """Test 4: Weighted consensus from multiple sportsbooks."""

    def test_single_book(self):
        """Single book consensus should equal that book's probability."""
        data = [{"book": "fanduel", "fair_over": 0.5724}]
        result = build_consensus(data)
        assert abs(result - 0.5724) < 0.0001

    def test_two_books_weighted(self):
        """FanDuel (weight 100) + DraftKings (weight 60)."""
        data = [
            {"book": "fanduel", "fair_over": 0.5724},
            {"book": "draftkings", "fair_over": 0.5641},
        ]
        result = build_consensus(data)
        # Manual: (100*0.5724 + 60*0.5641) / 160 = 0.5693
        assert abs(result - 0.5693) < 0.001

    def test_three_books_weighted(self):
        """FanDuel (100) + DraftKings (60) + BetMGM (40)."""
        data = [
            {"book": "fanduel", "fair_over": 0.5724},
            {"book": "draftkings", "fair_over": 0.5641},
            {"book": "betmgm", "fair_over": 0.5750},
        ]
        result = build_consensus(data)
        # Manual: (100*0.5724 + 60*0.5641 + 40*0.5750) / 200 = 0.5704
        assert abs(result - 0.5704) < 0.001

    def test_all_same_value(self):
        """If all books agree, consensus equals that value regardless of weights."""
        data = [
            {"book": "fanduel", "fair_over": 0.55},
            {"book": "draftkings", "fair_over": 0.55},
            {"book": "betmgm", "fair_over": 0.55},
        ]
        result = build_consensus(data)
        assert abs(result - 0.55) < 0.0001

    def test_unknown_book_gets_default_weight(self):
        """Unknown sportsbook should get default weight of 20."""
        data = [
            {"book": "fanduel", "fair_over": 0.60},
            {"book": "unknown_book", "fair_over": 0.50},
        ]
        result = build_consensus(data)
        # Manual: (100*0.60 + 20*0.50) / 120 = 0.5833
        assert abs(result - 0.5833) < 0.001

    def test_heavier_weight_pulls_consensus(self):
        """Higher-weighted book should pull consensus toward its value."""
        data = [
            {"book": "fanduel", "fair_over": 0.60},
            {"book": "draftkings", "fair_over": 0.50},
        ]
        result = build_consensus(data)
        assert result > 0.55, f"Consensus {result:.4f} should be pulled toward 0.60"


class TestCalculateEdge:
    """Test 5: Edge = fair_prob - breakeven threshold."""

    @pytest.mark.parametrize("fair_prob, entry_type, expected_edge", [
        (0.5724, "6-pick-flex", 0.0304),
        (0.5500, "6-pick-flex", 0.0080),
        (0.5800, "6-pick-flex", 0.0380),
        (0.6000, "6-pick-flex", 0.0580),
        (0.5400, "6-pick-flex", -0.0020),
        (0.5800, "2-pick-power", 0.0030),
        (0.5800, "5-pick-flex", 0.0380),
    ])
    def test_edge_values(self, fair_prob, entry_type, expected_edge):
        edge = calculate_edge(fair_prob, entry_type)
        assert abs(edge - expected_edge) < 0.0001, (
            f"Edge for {fair_prob:.2%} ({entry_type}): "
            f"got {edge:+.4f}, expected {expected_edge:+.4f}"
        )

    def test_negative_edge_is_negative(self):
        edge = calculate_edge(0.50, "6-pick-flex")
        assert edge < 0, f"Edge should be negative for 50%, got {edge}"

    def test_6pick_and_5pick_same_threshold(self):
        edge_5 = calculate_edge(0.58, "5-pick-flex")
        edge_6 = calculate_edge(0.58, "6-pick-flex")
        assert edge_5 == edge_6

    def test_2pick_harder_than_6pick(self):
        edge_2 = calculate_edge(0.58, "2-pick-power")
        edge_6 = calculate_edge(0.58, "6-pick-flex")
        assert edge_2 < edge_6

    def test_invalid_entry_type_raises(self):
        with pytest.raises((ValueError, KeyError)):
            calculate_edge(0.58, "invalid-type")

    def test_default_entry_type(self):
        edge_default = calculate_edge(0.58)
        edge_explicit = calculate_edge(0.58, "6-pick-flex")
        assert edge_default == edge_explicit
