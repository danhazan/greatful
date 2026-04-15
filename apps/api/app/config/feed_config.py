"""Feed configuration constants."""

# --- Pagination ---
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 50
CANDIDATE_MULTIPLIER = 3  # fetch page_size * N candidates for spacing diversity
CURSOR_VERSION = 2

# --- Recency ---
RECENCY_WINDOW_SECONDS = 604_800  # 7 days
RECENCY_MAX = 10.0

# --- Engagement ---
ENGAGEMENT_MAX = 5.0
COMBINED_ENGAGEMENT_MAX = 6.0  # cap on engagement_score + diversity + recent_engagement
WEIGHT_COMMENTS = 3
WEIGHT_SHARES = 4
WEIGHT_REACTIONS = 2

# --- Diversity bonus (rewards posts with varied emoji reactions) ---
DIVERSITY_BONUS_PER_TYPE = 0.3   # score added per unique emoji type
DIVERSITY_BONUS_MAX_TYPES = 3    # cap: bonus never exceeds MAX_TYPES * PER_TYPE

# --- Recent engagement boost (posts < 2 days with activity) ---
RECENT_ENGAGEMENT_WINDOW = 172_800  # 2 days
RECENT_ENGAGEMENT_MAX = 1.5

# --- Relationship ---
RELATIONSHIP_MUTUAL = 6.5
RELATIONSHIP_FOLLOWING = 5.0
RELATIONSHIP_FOLLOWED_BY = 2.0

# --- Own post boost (two-phase decay over 6 hours) ---
OWN_POST_PHASE1_MAX = 6.0
OWN_POST_PHASE1_SECONDS = 3_600  # 1 hour
OWN_POST_PHASE2_MAX = 2.0
OWN_POST_PHASE2_SECONDS = 18_000  # 5 hours (1h–6h)

# --- User reaction boost ---
USER_REACTION_BOOST = 1.0

# --- Discovery boost (unfollowed high-engagement image posts) ---
# Threshold candidates considered:
#   25 → ~12 reactions (still too easy to hit)
#   35 → ~17 reactions (chosen default: meaningful engagement required)
#   50 → ~25 reactions (conservative; may suppress too much discovery)
DISCOVERY_BOOST = 2.0
DISCOVERY_ENGAGEMENT_THRESHOLD = 35

# --- Deterministic jitter ---
JITTER_MAX = 0.2  # effective range: +/- 0.1

# --- Author spacing ---
AUTHOR_SPACING_WINDOW = 6  # look-back window size
AUTHOR_SPACING_MAX_PER_WINDOW = 2  # max posts from same author in window
