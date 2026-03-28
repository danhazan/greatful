"""
Unit tests for FeedServiceV2 — cursor encoding/decoding and author spacing.
"""

import base64
import json
import math
import pytest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.feed_service_v2 import FeedServiceV2, CURSOR_VERSION


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
    """Tests for the lightweight author spacing logic."""

    @staticmethod
    def _make_post(author_id: int, post_id: str = None):
        """Create a mock post with author_id."""
        post = SimpleNamespace()
        post.author_id = author_id
        post.id = post_id or f"post-{author_id}-{id(post)}"
        return post

    def test_no_reorder_when_few_posts(self):
        posts = [self._make_post(1), self._make_post(1), self._make_post(1)]
        result = FeedServiceV2._apply_author_spacing(posts, max_consecutive=4)
        assert len(result) == 3
        assert all(p.author_id == 1 for p in result)

    def test_reorder_when_exceeds_max_consecutive(self):
        posts = [
            self._make_post(1, "a"),
            self._make_post(1, "b"),
            self._make_post(1, "c"),
            self._make_post(1, "d"),
            self._make_post(1, "e"),  # 5th consecutive — should be deferred
            self._make_post(2, "f"),
        ]
        result = FeedServiceV2._apply_author_spacing(posts, max_consecutive=4)
        assert len(result) == 6
        # Post "e" should be deferred (moved to end)
        assert result[4].id == "f"
        assert result[5].id == "e"

    def test_no_posts_discarded(self):
        posts = [self._make_post(1) for _ in range(10)]
        result = FeedServiceV2._apply_author_spacing(posts, max_consecutive=2)
        assert len(result) == len(posts)

    def test_mixed_authors_unchanged(self):
        posts = [
            self._make_post(1, "a"),
            self._make_post(2, "b"),
            self._make_post(1, "c"),
            self._make_post(2, "d"),
        ]
        result = FeedServiceV2._apply_author_spacing(posts, max_consecutive=4)
        assert [p.id for p in result] == ["a", "b", "c", "d"]

    def test_empty_list(self):
        result = FeedServiceV2._apply_author_spacing([], max_consecutive=4)
        assert result == []


class TestScoringFormula:
    """Tests for the scoring formula math (independent of DB)."""

    def test_recency_brand_new(self):
        """A brand-new post should get full recency score."""
        age_seconds = 0
        recency = 10.0 * max(0, 1.0 - age_seconds / 604800.0)
        assert recency == 10.0

    def test_recency_3_days(self):
        """A 3-day-old post should get ~5.7 recency."""
        age_seconds = 3 * 24 * 3600
        recency = 10.0 * max(0, 1.0 - age_seconds / 604800.0)
        assert abs(recency - 5.71) < 0.1

    def test_recency_7_days(self):
        """A 7-day-old post should get 0 recency."""
        age_seconds = 7 * 24 * 3600
        recency = 10.0 * max(0, 1.0 - age_seconds / 604800.0)
        assert recency == 0.0

    def test_engagement_zero(self):
        """Zero engagement should give ln(1) = 0."""
        engagement = min(5.0, math.log(1 + 0))
        assert engagement == 0.0

    def test_engagement_moderate(self):
        """5 comments + 3 shares = ln(1 + 15 + 12) ≈ 3.3."""
        total = 5 * 3 + 3 * 4  # comments*3 + shares*4
        engagement = min(5.0, math.log(1 + total))
        assert abs(engagement - 3.33) < 0.1

    def test_engagement_capped(self):
        """Very high engagement should be capped at 5."""
        total = 1000 * 3 + 500 * 4  # massive engagement
        engagement = min(5.0, math.log(1 + total))
        assert engagement == 5.0

    def test_own_post_boost_brand_new(self):
        """Brand-new own post should get +5."""
        age_seconds = 0
        boost = 5.0 * max(0, 1.0 - age_seconds / 3600.0)
        assert boost == 5.0

    def test_own_post_boost_30_min(self):
        """30-min-old own post should get +2.5."""
        age_seconds = 30 * 60
        boost = 5.0 * max(0, 1.0 - age_seconds / 3600.0)
        assert boost == 2.5

    def test_own_post_boost_phase2_at_1hr(self):
        """At exactly 1 hour, phase 2 starts at +2.0."""
        age_seconds = 3600
        # Phase 1 gives 0, phase 2 gives 2.0 * max(0, 1.0 - 0/18000) = 2.0
        boost = 2.0 * max(0, 1.0 - (age_seconds - 3600) / 18000.0)
        assert boost == 2.0

    def test_own_post_boost_3hr(self):
        """3-hour-old own post should get ~1.2 from phase 2."""
        age_seconds = 3 * 3600
        boost = 2.0 * max(0, 1.0 - (age_seconds - 3600) / 18000.0)
        assert abs(boost - 1.2) < 0.01

    def test_own_post_boost_6hr(self):
        """6-hour-old own post should get 0."""
        age_seconds = 6 * 3600
        boost = 2.0 * max(0, 1.0 - (age_seconds - 3600) / 18000.0)
        assert boost == 0.0

    def test_total_score_new_own_post(self):
        """A brand-new own post with no engagement: 10 + 0 + 0 + 5 = 15."""
        recency = 10.0
        engagement = 0.0
        relationship = 0  # own post doesn't get relationship bonus
        own_boost = 5.0
        assert recency + engagement + relationship + own_boost == 15.0

    def test_total_score_max(self):
        """Maximum possible score should be 23."""
        recency = 10.0
        engagement = 5.0
        relationship = 3.0
        own_boost = 5.0
        assert recency + engagement + relationship + own_boost == 23.0

    def test_score_range_bounded(self):
        """All components should be non-negative and bounded."""
        for age_hours in [0, 0.5, 1, 6, 24, 72, 168]:
            age_seconds = age_hours * 3600
            recency = 10.0 * max(0, 1.0 - age_seconds / 604800.0)
            assert 0 <= recency <= 10.0

        for total_eng in [0, 1, 10, 100, 10000]:
            engagement = min(5.0, math.log(1 + total_eng))
            assert 0 <= engagement <= 5.0
