"""
Tests for src/player_matcher.py -- name normalization and matching.
No API calls, no credits consumed. Run freely.
"""
import pytest

from src.player_matcher import normalize_name, match_player


class TestNormalizeName:
    """Test name normalization rules."""

    @pytest.mark.parametrize("input_name, expected", [
        ("LeBron James", "lebron james"),
        ("STEPHEN CURRY", "stephen curry"),
        ("P.J. Washington", "pj washington"),
        ("O.G. Anunoby", "og anunoby"),
        ("C.J. McCollum", "cj mccollum"),
        ("T.J. McConnell", "tj mcconnell"),
        ("Shai Gilgeous-Alexander", "shai gilgeous alexander"),
        ("Karl-Anthony Towns", "karl anthony towns"),
        ("De'Aaron Fox", "de'aaron fox"),
        ("Jaren Jackson Jr.", "jaren jackson"),
        ("Gary Trent Jr.", "gary trent"),
        ("Wendell Carter Jr.", "wendell carter"),
        ("Kelly Oubre Jr.", "kelly oubre"),
        ("P.J. Washington Jr.", "pj washington"),
        ("  LeBron   James  ", "lebron james"),
    ])
    def test_normalize(self, input_name, expected):
        result = normalize_name(input_name)
        assert result == expected, (
            f"normalize_name('{input_name}') = '{result}', expected '{expected}'"
        )


class TestMatchPlayer:
    """Test the full matching pipeline: exact -> normalized -> override -> fuzzy."""

    def test_exact_match(self):
        result = match_player(
            "LeBron James",
            ["LeBron James", "Stephen Curry", "Kevin Durant"],
            overrides={},
        )
        assert result == "LeBron James"

    def test_normalized_match_hyphen(self):
        result = match_player(
            "Shai Gilgeous-Alexander",
            ["Shai Gilgeous Alexander", "Stephen Curry"],
            overrides={},
        )
        assert result == "Shai Gilgeous Alexander"

    def test_normalized_match_period(self):
        result = match_player(
            "P.J. Washington",
            ["PJ Washington", "Stephen Curry"],
            overrides={},
        )
        assert result == "PJ Washington"

    def test_normalized_match_suffix(self):
        result = match_player(
            "Jaren Jackson Jr.",
            ["Jaren Jackson", "Stephen Curry"],
            overrides={},
        )
        assert result == "Jaren Jackson"

    def test_override_match(self):
        result = match_player(
            "Nickname Player",
            ["Real Name Player", "Other Person"],
            overrides={"Nickname Player": "Real Name Player"},
        )
        assert result == "Real Name Player"

    def test_no_match_returns_none(self):
        result = match_player(
            "Nonexistent Player",
            ["LeBron James", "Stephen Curry"],
            overrides={},
        )
        assert result is None

    def test_case_insensitive_match(self):
        result = match_player(
            "lebron james",
            ["LeBron James", "Stephen Curry"],
            overrides={},
        )
        assert result == "LeBron James"

    def test_fuzzy_match_close_name(self):
        """Fuzzy should match very similar names (> 85% similarity)."""
        result = match_player(
            "Lebron James",
            ["LeBron James"],
            overrides={},
        )
        assert result == "LeBron James"
