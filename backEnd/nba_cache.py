"""
NBA API Caching Module
Provides in-memory caching and retry logic for NBA API calls
to prevent rate limiting and improve performance.
"""

# ----  GLOBAL CACHES  ---------------------------------------------------
_player_info_cache   = {}           # player_name -> (player_id, team_id)
_player_gamelog_df_cache = {}       # player_id -> full pd.DataFrame
_team_gamelog_df_cache   = {}       # team_id -> full pd.DataFrame

# ----  ONE SHARED HTTP SESSION WITH RETRY / BACK-OFF  -------------------
from requests.adapters import HTTPAdapter, Retry
from nba_api.stats.library.http import NBAStatsHTTP

retry = Retry(
    total=6,                 # 6 attempts max
    backoff_factor=1.0,      # 1 s → 2 s → 4 s …
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)

# Get the global session that all nba_api endpoints reuse
session = NBAStatsHTTP().get_session()

# Attach retry adapter
session.mount("https://", HTTPAdapter(max_retries=retry))
session.mount("http://", HTTPAdapter(max_retries=retry))

# Increase timeout for every endpoint
NBAStatsHTTP.TIMEOUT = 30

def clear_cache():
    """Clear all caches (useful for testing or memory management)"""
    global _player_info_cache, _player_gamelog_df_cache, _team_gamelog_df_cache
    _player_info_cache.clear()
    _player_gamelog_df_cache.clear()
    _team_gamelog_df_cache.clear()

def get_cache_stats():
    """Return current cache statistics"""
    return {
        "player_info_count": len(_player_info_cache),
        "player_gamelog_count": len(_player_gamelog_df_cache),
        "team_gamelog_count": len(_team_gamelog_df_cache)
    }
