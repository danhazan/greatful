"""
Unit tests for FeedServiceV2 — cursor encoding/decoding, author spacing, and scoring formula.
"""

import base64
import json
import math
import pytest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.config.feed_config import (
    CURSOR_VERSION,
    RECENCY_WINDOW_SECONDS,
    RECENCY_MAX,
    ENGAGEMENT_MAX,
    COMBINED_ENGAGEMENT_MAX,
    RELATIONSHIP_MUTUAL,
    RELATIONSHIP_FOLLOWING,
    RELATIONSHIP_FOLLOWED_BY,
    OWN_POST_PHASE1_MAX,
    OWN_POST_PHASE1_SECONDS,
    OWN_POST_PHASE2_MAX,
    OWN_POST_PHASE2_SECONDS,
    RECENT_ENGAGEMENT_MAX,
    RECENT_ENGAGEMENT_WINDOW,
    USER_REACTION_BOOST,
    DISCOVERY_BOOST,
    DISCOVERY_ENGAGEMENT_THRESHOLD,
    JITTER_MAX,
    WEIGHT_COMMENTS,
    WEIGHT_SHARES,
    WEIGHT_REACTIONS,
    AUTHOR_SPACING_WINDOW,
    AUTHOR_SPACING_MAX_PER_WINDOW,
)
from app.services.feed_service_v2 import FeedServiceV2


class TestCursorEncoding:
    """Tests for cursor encode/decode round-trips."""

    def test_encode_decode_roundtrip(self):
        qt = datetime(2026, 3, 28, 14, 30, 0, tzinfo=timezone.utc)
        score = 12.345678
        created_at = datetime(2026, 3, 28, 12, 15, 30, tzinfo=timezone.utc)
        post_id = "abc-123-def"

        encoded = FeedServiceV2._encode_cursor(qt, score, created_at, post_id)
        decoded = FeedServiceV2._decode_cursor(encoded)

        assert decoded["query_time"] == qt
        assert abs(decoded["score"] - score) < 1e-5
        assert decoded["created_at"] == created_at
        assert decoded["id"] == post_id

    def test_encode_includes_version(self):
        qt = datetime(2026, 1, 1, tzinfo=timezone.utc)
        encoded = FeedServiceV2._encode_cursor(qt, 1.0, qt, "id")
        payload = json.loads(base64.urlsafe_b64decode(encoded))
        assert payload["v"] == CURSOR_VERSION

    def test_decode_invalid_base64(self):
        with pytest.raises(ValueError, match="Invalid cursor encoding"):
            FeedServiceV2._decode_cursor("not-valid-base64!!!")

    def test_decode_invalid_json(self):
        encoded = base64.urlsafe_b64encode(b"not json").decode()
        with pytest.raises(ValueError, match="Invalid cursor encoding"):
            FeedServiceV2._decode_cursor(encoded)

    def test_decode_wrong_version(self):
        payload = {"v": 99, "qt": "2026-01-01T00:00:00+00:00", "s": 1.0, "t": "2026-01-01T00:00:00+00:00", "id": "x"}
        encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        with pytest.raises(ValueError, match="Unsupported cursor version"):
            FeedServiceV2._decode_cursor(encoded)

    def test_decode_missing_fields(self):
        payload = {"v": CURSOR_VERSION, "qt": "2026-01-01T00:00:00+00:00"}
        encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        with pytest.raises(ValueError, match="Missing cursor fields"):
            FeedServiceV2._decode_cursor(encoded)

    def test_score_preserves_full_precision(self):
        qt = datetime(2026, 1, 1, tzinfo=timezone.utc)
        encoded = FeedServiceV2._encode_cursor(qt, 1.123456789, qt, "id")
        payload = json.loads(base64.urlsafe_b64decode(encoded))
        assert payload["s"] == 1.123456789  # full precision for correct cursor comparisons

    def test_naive_datetime_gets_utc(self):
        """Naive datetimes should be treated as UTC."""
        qt = datetime(2026, 3, 28, 14, 0, 0)  # naive
        created_at = datetime(2026, 3, 28, 12, 0, 0)  # naive
        encoded = FeedServiceV2._encode_cursor(qt, 5.0, created_at, "id")
        decoded = FeedServiceV2._decode_cursor(encoded)
        assert decoded["query_time"].tzinfo is not None
        assert decoded["created_at"].tzinfo is not None


class TestAuthorSpacing:
    """Tests for the deterministic constraint author spacing with LRU preference."""

    @staticmethod
    def _make_post(author_id: int, post_id: str = None):
        """Create a mock post with author_id."""
        post = SimpleNamespace()
        post.author_id = author_id
        post.id = post_id or f"post-{author_id}-{id(post)}"
        return post

    def test_single_post_unchanged(self):
        posts = [self._make_post(1)]
        result = FeedServiceV2._apply_author_spacing(posts)
        assert len(result) == 1

    def test_no_posts_discarded(self):
        posts = [self._make_post(1) for _ in range(10)]
        result = FeedServiceV2._apply_author_spacing(posts)
        assert len(result) == len(posts)

    def test_mixed_authors_preserves_order(self):
        posts = [
            self._make_post(1, "a"),
            self._make_post(2, "b"),
            self._make_post(1, "c"),
            self._make_post(2, "d"),
        ]
        result = FeedServiceV2._apply_author_spacing(posts)
        assert [p.id for p in result] == ["a", "b", "c", "d"]

    def test_constraint_with_config_defaults(self):
        """With default config (max 2 per window of 6), 4 authors distribute cleanly."""
        posts = [
            self._make_post(1, "a1"),
            self._make_post(1, "a2"),
            self._make_post(1, "a3"),
            self._make_post(2, "b1"),
            self._make_post(2, "b2"),
            self._make_post(2, "b3"),
            self._make_post(3, "c1"),
            self._make_post(3, "c2"),
            self._make_post(4, "d1"),
            self._make_post(4, "d2"),
        ]
        result = FeedServiceV2._apply_author_spacing(posts)
        assert len(result) == 10
        w = AUTHOR_SPACING_WINDOW
        m = AUTHOR_SPACING_MAX_PER_WINDOW
        for i in range(len(result)):
            window = result[i:i + w]
            for author_id in set(p.author_id for p in window):
                count = sum(1 for p in window if p.author_id == author_id)
                assert count <= m, (
                    f"Author {author_id} appears {count} times in window [{i}:{i+w}]"
                )

    def test_lru_prefers_least_recent_author(self):
        """LRU preference should intersperse authors rather than greedily batching."""
        # 3 from each author — LRU should produce A B C A B C ... not A A B B C C
        posts = [
            self._make_post(1, "a1"),
            self._make_post(1, "a2"),
            self._make_post(1, "a3"),
            self._make_post(2, "b1"),
            self._make_post(2, "b2"),
            self._make_post(2, "b3"),
            self._make_post(3, "c1"),
            self._make_post(3, "c2"),
            self._make_post(3, "c3"),
        ]
        result = FeedServiceV2._apply_author_spacing(posts)
        authors = [p.author_id for p in result]
        # No 3 consecutive from same author
        for i in range(len(authors) - 2):
            assert len(set(authors[i:i+3])) > 1, (
                f"3 consecutive from author {authors[i]} at index {i}: {authors}"
            )

    def test_graceful_degradation_when_constraint_unsatisfiable(self):
        """When one author dominates, spacing does its best without discarding posts."""
        posts = [self._make_post(1, f"a{i}") for i in range(5)]
        posts += [self._make_post(2, "b1"), self._make_post(2, "b2")]
        result = FeedServiceV2._apply_author_spacing(posts)
        assert len(result) == 7
        # Author 2 should be interspersed early
        author_2_positions = [i for i, p in enumerate(result) if p.author_id == 2]
        assert author_2_positions[0] < 4, "Author 2 should appear before position 4"

    def test_all_same_author_no_crash(self):
        """10 posts from the same author — should not crash or loop forever."""
        posts = [self._make_post(1, f"p{i}") for i in range(10)]
        result = FeedServiceV2._apply_author_spacing(posts)
        assert len(result) == 10

    def test_empty_list(self):
        result = FeedServiceV2._apply_author_spacing([])
        assert result == []


class TestScoringFormula:
    """Tests for the scoring formula math (independent of DB)."""

    def test_recency_brand_new(self):
        """A brand-new post should get full recency score."""
        age_seconds = 0
        recency = RECENCY_MAX * max(0, 1.0 - age_seconds / RECENCY_WINDOW_SECONDS)
        assert recency == 10.0

    def test_recency_3_days(self):
        """A 3-day-old post should get ~5.7 recency."""
        age_seconds = 3 * 24 * 3600
        recency = RECENCY_MAX * max(0, 1.0 - age_seconds / RECENCY_WINDOW_SECONDS)
        assert abs(recency - 5.71) < 0.1

    def test_recency_7_days(self):
        """A 7-day-old post should get 0 recency."""
        age_seconds = 7 * 24 * 3600
        recency = RECENCY_MAX * max(0, 1.0 - age_seconds / RECENCY_WINDOW_SECONDS)
        assert recency == 0.0

    def test_engagement_zero(self):
        """Zero engagement should give ln(1) = 0."""
        engagement = min(ENGAGEMENT_MAX, math.log(1 + 0))
        assert engagement == 0.0

    def test_engagement_moderate(self):
        """5 comments + 3 shares = ln(1 + 15 + 12) ≈ 3.3."""
        total = 5 * WEIGHT_COMMENTS + 3 * WEIGHT_SHARES
        engagement = min(ENGAGEMENT_MAX, math.log(1 + total))
        assert abs(engagement - 3.33) < 0.1

    def test_engagement_capped(self):
        """Very high engagement should be capped at 5."""
        total = 1000 * WEIGHT_COMMENTS + 500 * WEIGHT_SHARES
        engagement = min(ENGAGEMENT_MAX, math.log(1 + total))
        assert engagement == ENGAGEMENT_MAX

    def test_own_post_boost_brand_new(self):
        """Brand-new own post should get full phase 1 boost."""
        age_seconds = 0
        boost = OWN_POST_PHASE1_MAX * max(0, 1.0 - age_seconds / OWN_POST_PHASE1_SECONDS)
        assert boost == OWN_POST_PHASE1_MAX  # 6.0

    def test_own_post_boost_30_min(self):
        """30-min-old own post should get half of phase 1."""
        age_seconds = 30 * 60
        boost = OWN_POST_PHASE1_MAX * max(0, 1.0 - age_seconds / OWN_POST_PHASE1_SECONDS)
        assert boost == OWN_POST_PHASE1_MAX / 2  # 3.0

    def test_own_post_boost_phase2_at_1hr(self):
        """At exactly 1 hour, phase 2 starts at +2.0."""
        age_seconds = 3600
        boost = OWN_POST_PHASE2_MAX * max(0, 1.0 - (age_seconds - OWN_POST_PHASE1_SECONDS) / OWN_POST_PHASE2_SECONDS)
        assert boost == 2.0

    def test_own_post_boost_3hr(self):
        """3-hour-old own post should get ~1.2 from phase 2."""
        age_seconds = 3 * 3600
        boost = OWN_POST_PHASE2_MAX * max(0, 1.0 - (age_seconds - OWN_POST_PHASE1_SECONDS) / OWN_POST_PHASE2_SECONDS)
        assert abs(boost - 1.2) < 0.01

    def test_own_post_boost_6hr(self):
        """6-hour-old own post should get 0."""
        age_seconds = 6 * 3600
        boost = OWN_POST_PHASE2_MAX * max(0, 1.0 - (age_seconds - OWN_POST_PHASE1_SECONDS) / OWN_POST_PHASE2_SECONDS)
        assert boost == 0.0

    def test_total_score_new_own_post(self):
        """A brand-new own post with no engagement: recency + own_post = 16."""
        recency = 10.0
        engagement = 0.0
        relationship = 0  # own post doesn't get relationship bonus
        own_boost = OWN_POST_PHASE1_MAX  # 6.0
        recent_eng = 0.0  # no engagement
        user_reaction = 0.0
        discovery = 0.0
        assert recency + engagement + relationship + own_boost + recent_eng + user_reaction + discovery == 16.0

    def test_total_score_max(self):
        """Maximum possible score (discovery excluded, brand-new post)."""
        recency = 10.0
        combined_eng = COMBINED_ENGAGEMENT_MAX  # 5.0
        recency_fraction = 1.0  # brand new
        relationship = RELATIONSHIP_MUTUAL * recency_fraction  # 4.5 * 1.0
        own_boost = OWN_POST_PHASE1_MAX  # 6.0
        user_reaction = USER_REACTION_BOOST  # 1.0
        jitter = JITTER_MAX / 2  # 0.1
        total = recency + combined_eng + relationship + own_boost + user_reaction + jitter
        assert abs(total - 26.6) < 0.01

    def test_score_range_bounded(self):
        """All components should be non-negative and bounded."""
        for age_hours in [0, 0.5, 1, 6, 24, 72, 168]:
            age_seconds = age_hours * 3600
            recency = RECENCY_MAX * max(0, 1.0 - age_seconds / RECENCY_WINDOW_SECONDS)
            assert 0 <= recency <= RECENCY_MAX

        for total_eng in [0, 1, 10, 100, 10000]:
            engagement = min(ENGAGEMENT_MAX, math.log(1 + total_eng))
            assert 0 <= engagement <= ENGAGEMENT_MAX

    # --- New scoring component tests ---

    def test_recent_engagement_new_popular_post(self):
        """Brand-new post with high comments+reactions gets near max recent engagement."""
        age_seconds = 0
        comments = 10
        reactions = 5
        raw = math.log(1 + comments * 2 + reactions)
        recency_factor = max(0, 1.0 - age_seconds / RECENT_ENGAGEMENT_WINDOW)
        score = min(RECENT_ENGAGEMENT_MAX, raw * recency_factor)
        assert score == RECENT_ENGAGEMENT_MAX  # ln(26) ≈ 3.26, capped at 1.5

    def test_recent_engagement_old_post_zero(self):
        """A 3-day-old post gets 0 recent engagement regardless of activity."""
        age_seconds = 3 * 24 * 3600
        comments = 100
        reactions = 50
        raw = math.log(1 + comments * 2 + reactions)
        recency_factor = max(0, 1.0 - age_seconds / RECENT_ENGAGEMENT_WINDOW)
        score = min(RECENT_ENGAGEMENT_MAX, raw * recency_factor)
        assert score == 0.0

    def test_recent_engagement_moderate(self):
        """A 1-day-old post with moderate engagement gets partial boost."""
        age_seconds = 24 * 3600
        comments = 3
        reactions = 2
        raw = math.log(1 + comments * 2 + reactions)  # ln(9) ≈ 2.2
        recency_factor = max(0, 1.0 - age_seconds / RECENT_ENGAGEMENT_WINDOW)  # 0.5
        score = min(RECENT_ENGAGEMENT_MAX, raw * recency_factor)
        assert 0.5 < score < RECENT_ENGAGEMENT_MAX

    def test_user_reaction_boost_value(self):
        """User reaction boost is exactly USER_REACTION_BOOST."""
        assert USER_REACTION_BOOST == 1.0

    def test_discovery_conditions(self):
        """Discovery boost requires: no follow + high engagement + image."""
        # All conditions met
        has_follow = False
        weighted_engagement = 15  # above threshold of 10
        has_image = True
        score = DISCOVERY_BOOST if (not has_follow and weighted_engagement >= DISCOVERY_ENGAGEMENT_THRESHOLD and has_image) else 0
        assert score == DISCOVERY_BOOST

        # Missing image
        score_no_img = DISCOVERY_BOOST if (not has_follow and weighted_engagement >= DISCOVERY_ENGAGEMENT_THRESHOLD and False) else 0
        assert score_no_img == 0

        # Has follow relationship → no discovery
        has_follow_rel = True
        score_follow = DISCOVERY_BOOST if (not has_follow_rel and weighted_engagement >= DISCOVERY_ENGAGEMENT_THRESHOLD and has_image) else 0
        assert score_follow == 0

        # Below engagement threshold
        score_low = DISCOVERY_BOOST if (not has_follow and 5 >= DISCOVERY_ENGAGEMENT_THRESHOLD and has_image) else 0
        assert score_low == 0

    def test_jitter_bounded(self):
        """Jitter should be bounded within [-JITTER_MAX/2, +JITTER_MAX/2]."""
        half = JITTER_MAX / 2
        # Simulate the jitter range: input 0..1 → JITTER_MAX * x - half
        for x in [0.0, 0.25, 0.5, 0.75, 1.0]:
            jitter = JITTER_MAX * x - half
            assert -half <= jitter <= half
