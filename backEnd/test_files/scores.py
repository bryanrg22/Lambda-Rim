#!/usr/bin/env python3
"""
sync_concluded_stats.py
––––––––––––––––––––––––
Walk every document under
processedPlayers/players/concluded
and make sure finalPoints / finalMinutes
match the official box-score.

• If the NBA API can’t return stats
  (timeout / malformed response) _or_
  the player didn’t enter the game,
  the script writes -1 for both fields.

• Any problem players are printed at
  the end so you can eyeball the list.
"""

import logging
from typing import Tuple, Optional

import firebase_admin
from firebase_admin import firestore
from nba_api.stats.endpoints import BoxScoreTraditionalV2
from requests.exceptions import ReadTimeout

import time
from itertools import islice


# –– Firestore bootstrap –– #
def init_firestore() -> firestore.Client:
    if not firebase_admin._apps:
        # In Cloud Run / Functions the default SA is pre-bound;
        # locally you can export GOOGLE_APPLICATION_CREDENTIALS.
        firebase_admin.initialize_app()
    return firestore.client()

# –– Box-score helper –– #
def fetch_player_stats(game_id: str, player_id: int, pick_id: str, i: int) -> Tuple[Optional[int], Optional[int]]:
    """
    Return (points, minutes) for one player in a finished game.

    • -1 / -1  → played 0 min or DNP
    • None / None → API failure (caller decides what to do)
    """
    try:
        bb = BoxScoreTraditionalV2(game_id=game_id, timeout=15)
        df = bb.player_stats.get_data_frame()

        if df.empty:
            return None, None

        row = df.loc[df["PLAYER_ID"] == int(player_id)]
        if row.empty:
            return None, None
        row = row.iloc[0]

        # DNP / inactive?
        if isinstance(row.get("COMMENT"), str) and "DNP" in row["COMMENT"]:
            return -1, -1

        pts = int(row["PTS"]) if row["PTS"] is not None else -1

        raw_min = row["MIN"]
        mins = -1
        if ":" in raw_min:
            mins = int(raw_min.split(":")[0].split(".")[0])        # keep whole minutes only

        return pts, mins

    except ReadTimeout:
        logging.warning("%i: Timeout – game %s / player %s, pick_id: %s", i, game_id, player_id, pick_id)
        return None, None
    except Exception as exc:
        logging.error("%i: NBA API error – game %s / player %s – %s", i, game_id, player_id, exc)
        return None, None


# –– Worker –– #
def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s | %(message)s")

    db = init_firestore()
    concluded_coll = (
        db.collection("processedPlayers")
          .document("players")
          .collection("concluded")
    )

    # ── 1. Grab everything up front ─────────────────────────────
    logging.info("Fetching concluded players …")
    docs = list(concluded_coll.stream())          # ONE RPC then done
    logging.info("Fetched %d docs", len(docs))

    # ── constants you can tweak ──────────────────────────────────
    BATCH_SIZE     = 15          # throttle every N docs
    PAUSE_SECS     = 10           # normal pause between batches
    TIMEOUT_STREAK = 5           # consecutive timeouts ⇒ long pause
    TIMEOUT_PAUSE  = 30          # length of that long pause
    MAX_RETRIES    = 3           # per-doc retry cap
    # ─────────────────────────────────────────────────────────────

    # (load docs the same way you already do)
    docs = list(concluded_coll.stream())

    problem_ids      = []
    retry_counts     = {}        # pick_id → #attempts
    timeout_streak   = 0         # consecutive timeouts
    retry_buffer     = []        # holds docs that just timed out

    def run_player(snap, idx):
        """Return True if processed (hit/miss written), False if timeout."""
        nonlocal timeout_streak
        doc        = snap.to_dict()
        name       = doc.get("name") or snap.id
        game_id    = doc.get("gameId")
        player_id  = doc.get("playerId")
        threshold  = doc.get("threshold", 0)
        pick_id    = doc.get("pick_id")

        if not game_id or not player_id:
            logging.error("%d: ⛔ Missing IDs for %s – skipped (pick_id %s)",
                        idx, name, pick_id)
            problem_ids.append(pick_id)
            timeout_streak = 0
            return True

        pts, mins = fetch_player_stats(game_id, player_id, pick_id, idx)

        if pts is None or mins is None:            # ← timeout / API failure
            timeout_streak += 1
            retry_counts[pick_id] = retry_counts.get(pick_id, 0) + 1
            if retry_counts[pick_id] < MAX_RETRIES:
                retry_buffer.append(snap)          # try again later
            else:
                problem_ids.append(pick_id)        # give up after 3 tries
            return False

        # success path
        hit = -1 if (pts == -1 and mins == -1) else int(pts > threshold)
        snap.reference.update({"finalPoints": pts, "finalMinutes": mins, "hit": hit})
        logging.info("%d: ✔ %-30s → %3d pts | %2d min  (pick_id %s)",
                    idx, name, pts, mins, pick_id)
        timeout_streak = 0
        return True


    i = 0
    while i < len(docs):
        # ── main pass, up to BATCH_SIZE docs ─────────────────────
        batch_end = min(i + BATCH_SIZE, len(docs))
        while i < batch_end:
            snap = docs[i]
            i += 1
            run_player(snap, i)

        # normal throttle
        if i < len(docs):
            logging.info("⏸  processed %d docs – sleeping %d s …", i, PAUSE_SECS)
            time.sleep(PAUSE_SECS)

        # ── if 5 consecutive timeouts occurred ───────────────────
        if timeout_streak >= TIMEOUT_STREAK:
            logging.warning("⚠️  %d consecutive timeouts – pausing %d s and retrying %d docs",
                            timeout_streak, TIMEOUT_PAUSE, len(retry_buffer))
            time.sleep(TIMEOUT_PAUSE)
            timeout_streak = 0        # reset the streak counter

            # retry the buffered docs right away
            to_retry = retry_buffer.copy()
            retry_buffer.clear()
            for snap in to_retry:
                # idx stays the same so logs keep monotonic numbering
                run_player(snap, i)   # don't advance i




if __name__ == "__main__":
    main()
