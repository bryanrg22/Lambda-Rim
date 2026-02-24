"""CLI entry point for the +EV detection scanner.

Usage:
    python scan.py --league NBA
    python scan.py --league NBA --min-edge 3
    python scan.py --league NBA --export csv
"""
import argparse
import csv
import os
import sys

from src.config import PRIZEPICKS_LEAGUE_IDS, EDGE_MINIMUM
from src.db import init_db
from src.ev_scanner import scan_for_ev


def main():
    parser = argparse.ArgumentParser(description="Lambda Rim +EV Scanner")
    parser.add_argument(
        "--league",
        required=True,
        choices=list(PRIZEPICKS_LEAGUE_IDS.keys()),
        help="League to scan (e.g., NBA, NFL, NHL)",
    )
    parser.add_argument(
        "--min-edge",
        type=float,
        default=EDGE_MINIMUM * 100,
        help="Minimum edge percentage to display (default: 2.0)",
    )
    parser.add_argument(
        "--export",
        choices=["csv"],
        help="Export results to CSV",
    )
    args = parser.parse_args()

    # Load API key
    api_key = os.environ.get("ODDS_API_KEY")
    if not api_key:
        # Try loading from .env via config import
        from src.config import _load_env
        _load_env()
        api_key = os.environ.get("ODDS_API_KEY")

    if not api_key:
        print("Error: ODDS_API_KEY not set.")
        print("Set it via environment variable or in abritage/.env")
        sys.exit(1)

    # Initialize database
    conn = init_db()

    # Run scanner
    min_edge = args.min_edge / 100.0  # Convert percentage to decimal
    opportunities = scan_for_ev(args.league, conn, api_key, min_edge=min_edge)

    # Display results
    print_results(opportunities, args.league, min_edge)

    # Export if requested
    if args.export == "csv" and opportunities:
        export_csv(opportunities, args.league)

    conn.close()


def print_results(opportunities: list[dict], league: str, min_edge: float):
    """Pretty-print +EV opportunities to terminal."""
    print()
    print("=" * 66)
    print(f"{'':>20}+EV OPPORTUNITIES ({league})")
    print("=" * 66)

    if not opportunities:
        print()
        print(f"  No opportunities found with edge >= {min_edge:.1%}")
        print("  This is valid data -- edges don't appear every day.")
        print()
        print("=" * 66)
        return

    for i, opp in enumerate(opportunities, 1):
        side = opp["recommended_side"].capitalize()
        edge = opp["edge_percentage"]
        quality = opp.get("quality", "")

        print()
        print(f"  {i}. {opp['player_name']} -- {opp['stat_type']} {side} {opp['prizepicks_line']}")
        print(f"     Fair Prob: {opp['fair_prob_over']:.2%} over / {opp['fair_prob_under']:.2%} under")
        print(f"     Edge: {edge:+.2%}  |  Quality: {quality}")

        import json
        books = json.loads(opp["books_used"]) if isinstance(opp["books_used"], str) else opp["books_used"]
        print(f"     Books: {', '.join(books)} ({opp['num_books']} books)")

    print()
    print("-" * 66)
    print(f"  Total props scanned  |  +EV found: {len(opportunities)}")
    print(f"  Results saved to ev_results.db")
    print("=" * 66)
    print()


def export_csv(opportunities: list[dict], league: str):
    """Export opportunities to a CSV file."""
    filename = f"ev_results_{league.lower()}.csv"
    fieldnames = [
        "player_name", "stat_type", "recommended_side", "prizepicks_line",
        "fair_prob_over", "fair_prob_under", "edge_percentage", "num_books",
        "books_used", "quality", "game_time",
    ]

    with open(filename, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(opportunities)

    print(f"Exported {len(opportunities)} opportunities to {filename}")


if __name__ == "__main__":
    main()
