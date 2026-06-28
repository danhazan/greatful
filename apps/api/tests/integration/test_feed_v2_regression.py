"""
Regression and cross-feature integration tests for the feed v2 endpoint.
Covers gaps identified during Phase 3 optimization:
  P1 — Pagination while filters active, combined multi-filter scenarios
  P2 — Feed vs post detail consistency, URL serialization, date preset persistence
  P3 — Deleted authors, date boundaries, empty filter values, keyword normalization
"""

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone

from app.models.post import Post
from app.models.post_image import PostImage
from app.models.post_privacy import PostPrivacyRule, PostPrivacyUser
from app.models.emoji_reaction import EmojiReaction
from app.models.follow import Follow
from app.models.user import User
from app.core.security import create_access_token, get_password_hash
from app.services.feed_service_v2 import FeedServiceV2
from app.repositories.post_repository import PostRepository


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def u_a(db_session):
    u = User(email="a@t.com", username="u_a", hashed_password=get_password_hash("p"))
    db_session.add(u); await db_session.flush(); return u

@pytest_asyncio.fixture
async def u_b(db_session):
    u = User(email="b@t.com", username="u_b", hashed_password=get_password_hash("p"))
    db_session.add(u); await db_session.flush(); return u

@pytest_asyncio.fixture
async def u_c(db_session):
    u = User(email="c@t.com", username="u_c", hashed_password=get_password_hash("p"))
    db_session.add(u); await db_session.flush(); return u


async def _post(db_session, author, content="P", age_hours=0, **kw):
    created_at = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    heart_rx = kw.pop("heart_reactions", 0)
    other_rx = kw.pop("other_reactions", 0)
    diverse_rx = kw.pop("diverse_reactions", [])
    total_rx = heart_rx + other_rx + len(diverse_rx)

    post = Post(
        id=str(uuid.uuid4()),
        author=author,
        content=content,
        is_public=kw.pop("is_public", True),
        privacy_level=kw.pop("privacy_level", "public"),
        created_at=created_at,
        reactions_count=total_rx,
        comments_count=kw.pop("comments_count", 0),
        shares_count=kw.pop("shares_count", 0),
        image_url=kw.pop("image_url", None),
        location=kw.pop("location", None),
    )
    db_session.add(post); await db_session.flush()

    for i in range(heart_rx):
        db_session.add(EmojiReaction(id=str(uuid.uuid4()), user_id=1000+i, post_id=post.id, emoji_code="heart"))
    for i in range(other_rx):
        db_session.add(EmojiReaction(id=str(uuid.uuid4()), user_id=2000+i, post_id=post.id, emoji_code="pray"))
    for i, ec in enumerate(diverse_rx):
        db_session.add(EmojiReaction(id=str(uuid.uuid4()), user_id=3000+i, post_id=post.id, emoji_code=ec))
    if total_rx > 0:
        await db_session.commit()
    await db_session.refresh(post)
    return post


async def _follow(db_session, follower, followed):
    f = Follow(id=str(uuid.uuid4()), follower_id=follower.id, followed_id=followed.id, status="active")
    db_session.add(f); await db_session.commit()


# ===================================================================
# P1 — Pagination while filters are active
# ===================================================================

class TestPaginationWithFilters:

    @pytest.mark.asyncio
    async def test_pagination_with_type_required(self, db_session, u_a, u_b):
        """Pagination preserves type_required filter across pages."""
        await _follow(db_session, u_a, u_b)
        ids = set()
        for i in range(5):
            p = await _post(db_session, u_b, f"Followed-{i}", age_hours=i * 6)
            ids.add(p.id)

        # Create one post NOT from followed user (should never appear)
        await _post(db_session, u_a, "Own", age_hours=0)

        service = FeedServiceV2(db_session)
        all_posts = []; cursor = None
        while True:
            result = await service.get_feed(
                user_id=u_a.id, cursor=cursor, page_size=2,
                type_required=["followed"],
            )
            all_posts.extend(result["posts"])
            cursor = result["nextCursor"]
            if cursor is None:
                break

        returned_ids = {p["id"] for p in all_posts}
        assert ids.issubset(returned_ids)
        assert all(p["author_id"] == u_b.id for p in all_posts)
        assert len(all_posts) == len(set(p["id"] for p in all_posts))

    @pytest.mark.asyncio
    async def test_pagination_with_keyword_required(self, db_session, u_a, u_b):
        """Pagination preserves keyword_required filter across pages."""
        matching_ids = set()
        for i in range(5):
            p = await _post(db_session, u_b, f"grateful day {i}", age_hours=i * 6)
            matching_ids.add(p.id)
        await _post(db_session, u_b, "nothing matches", age_hours=0)

        service = FeedServiceV2(db_session)
        all_posts = []; cursor = None
        while True:
            result = await service.get_feed(
                user_id=u_a.id, cursor=cursor, page_size=2,
                keyword_mode="required", keyword="grateful",
            )
            all_posts.extend(result["posts"])
            cursor = result["nextCursor"]
            if cursor is None:
                break

        returned_ids = {p["id"] for p in all_posts}
        assert matching_ids == returned_ids
        assert len(all_posts) == 5

    @pytest.mark.asyncio
    async def test_pagination_with_author_required(self, db_session, u_a, u_b, u_c):
        """Pagination preserves author_required filter across pages."""
        b_ids = set()
        for i in range(5):
            p = await _post(db_session, u_b, f"B-{i}", age_hours=i * 6)
            b_ids.add(p.id)
        await _post(db_session, u_c, "C intruder", age_hours=0)

        service = FeedServiceV2(db_session)
        all_posts = []; cursor = None
        while True:
            result = await service.get_feed(
                user_id=u_a.id, cursor=cursor, page_size=2,
                author_mode="required", author_ids=[u_b.id],
            )
            all_posts.extend(result["posts"])
            cursor = result["nextCursor"]
            if cursor is None:
                break

        returned_ids = {p["id"] for p in all_posts}
        assert b_ids == returned_ids


# ===================================================================
# P1 — Multiple combined filters
# ===================================================================

class TestCombinedFilters:

    @pytest.mark.asyncio
    async def test_type_required_with_author_boost(self, db_session, u_a, u_b, u_c):
        """type_required + author_mode=boost: required narrows, boost reorders inside."""
        await _follow(db_session, u_a, u_b)
        await _follow(db_session, u_a, u_c)

        b = await _post(db_session, u_b, "B followed", age_hours=2)
        c = await _post(db_session, u_c, "C followed", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=u_a.id,
            type_required=["followed"],
            author_mode="boost",
            author_ids=[u_b.id],
        )

        ids = [p["id"] for p in result["posts"]]
        # Both followed users present
        assert b.id in ids and c.id in ids
        # B is boosted above C despite being older
        assert ids.index(b.id) < ids.index(c.id)

    @pytest.mark.asyncio
    async def test_keyword_required_with_date_required(self, db_session, u_a, u_b):
        """keyword_required + date_required: both conditions must match."""
        now = datetime.now(timezone.utc)
        recent_matching = await _post(db_session, u_b, "grateful today", age_hours=2)
        old_matching = await _post(db_session, u_b, "grateful long ago", age_hours=72)
        recent_non = await _post(db_session, u_b, "nothing here", age_hours=2)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=u_a.id,
            keyword_mode="required", keyword="grateful",
            date_mode="required",
            date_start=(now - timedelta(hours=24)).isoformat(),
            date_end=now.isoformat(),
        )

        ids = {p["id"] for p in result["posts"]}
        assert recent_matching.id in ids
        assert old_matching.id not in ids
        assert recent_non.id not in ids


# ===================================================================
# P2 — Feed vs post detail consistency
# ===================================================================

class TestFeedPostDetailConsistency:

    @pytest.mark.asyncio
    async def test_feed_and_detail_return_same_content(self, db_session, u_a):
        """A post returned in feed has same content/shape as via detail endpoint."""
        post = await _post(db_session, u_a, "Consistent content", age_hours=1)

        service = FeedServiceV2(db_session)
        feed_result = await service.get_feed(user_id=u_a.id)
        feed_post = feed_result["posts"][0]

        repo = PostRepository(db_session)
        detail = await repo.get_single_post_with_engagement(
            post_id=post.id, viewer_id=u_a.id, include_privacy_details=True,
        )

        assert feed_post["id"] == detail["id"]
        assert feed_post["content"] == detail.get("content")
        assert feed_post["privacy_level"] == detail.get("privacy_level")
        assert feed_post["comments_count"] == detail.get("comments_count", post.comments_count)
        assert feed_post["reactions_count"] == detail.get("reactions_count", post.reactions_count)

    @pytest.mark.asyncio
    async def test_feed_and_detail_match_following_field(self, db_session, u_a, u_b):
        """feed following field matches detail endpoint."""
        await _follow(db_session, u_a, u_b)
        post = await _post(db_session, u_b, "Followed post", age_hours=1)

        service = FeedServiceV2(db_session)
        feed_result = await service.get_feed(user_id=u_a.id)
        feed_post = feed_result["posts"][0]

        repo = PostRepository(db_session)
        detail = await repo.get_single_post_with_engagement(
            post_id=post.id, viewer_id=u_a.id,
        )

        assert feed_post.get("following") == detail.get("following")


# ===================================================================
# P2 — URL serialization / deserialization
# ===================================================================

class TestURLSerialization:

    @pytest.mark.asyncio
    async def test_image_url_roundtrip(self, db_session, u_a):
        """Post with image_url survives feed serialization."""
        from app.core.storage import storage
        await _post(db_session, u_a, "Has image", age_hours=1, image_url="/uploads/img.webp")

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=u_a.id)
        expected_url = storage.get_url("/uploads/img.webp")
        assert result["posts"][0]["image_url"] == expected_url

    @pytest.mark.asyncio
    async def test_null_image_url(self, db_session, u_a):
        """Post without image_url returns None, not empty string."""
        await _post(db_session, u_a, "No image", age_hours=1, image_url=None)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=u_a.id)
        assert result["posts"][0].get("image_url") is None

    @pytest.mark.asyncio
    async def test_empty_string_image_url(self, db_session, u_a):
        """Post with empty string image_url returns None after normalization."""
        await _post(db_session, u_a, "Empty image", age_hours=1, image_url="")

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=u_a.id)
        # empty string should be treated as no image
        assert not result["posts"][0].get("image_url")

    @pytest.mark.asyncio
    async def test_multi_image_serialization(self, db_session, u_a):
        """PostImage model URLs survive feed serialization."""
        post = await _post(db_session, u_a, "Multi image post", age_hours=1)
        pi = PostImage(
            post_id=post.id, position=0,
            thumbnail_url="/uploads/thumb.jpg",
            medium_url="/uploads/medium.jpg",
            original_url="/uploads/original.jpg",
        )
        db_session.add(pi); await db_session.commit()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=u_a.id)
        images = result["posts"][0].get("images", [])
        assert len(images) == 1
        assert images[0]["thumbnail_url"] == "/uploads/thumb.jpg"
        assert images[0]["medium_url"] == "/uploads/medium.jpg"
        assert images[0]["original_url"] == "/uploads/original.jpg"


# ===================================================================
# P2 — Date preset persistence
# ===================================================================

class TestDatePresetPersistence:

    @pytest.mark.asyncio
    async def test_date_preset_survives_pagination(self, db_session, u_a, u_b):
        """date_mode=required with date range persists across cursor pages."""
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(days=5)
        in_window_ids = set()
        for i in range(5):
            p = await _post(db_session, u_b, f"In-{i}", age_hours=1 + i * 12,
                            heart_reactions=(5 - i))
            in_window_ids.add(p.id)
        # Outside window
        await _post(db_session, u_b, "Out", age_hours=24 * 30)

        service = FeedServiceV2(db_session)
        all_posts = []; cursor = None
        while True:
            result = await service.get_feed(
                user_id=u_a.id, cursor=cursor, page_size=2,
                date_mode="required",
                date_start=window_start.isoformat(),
                date_end=now.isoformat(),
            )
            all_posts.extend(result["posts"])
            cursor = result["nextCursor"]
            if cursor is None:
                break

        returned_ids = {p["id"] for p in all_posts}
        assert in_window_ids.issubset(returned_ids)
        assert all(p["content"] != "Out" for p in all_posts)
        assert len(all_posts) == len(set(p["id"] for p in all_posts))

    @pytest.mark.asyncio
    async def test_date_boost_ordering_persists_across_pages(self, db_session, u_a, u_b):
        """date_mode=boost reordering is consistent across pagination boundaries."""
        now = datetime.now(timezone.utc)
        await _follow(db_session, u_a, u_b)
        for i in range(6):
            await _post(db_session, u_b, f"P-{i}", age_hours=1 + i * 4)

        service = FeedServiceV2(db_session)
        all_posts = []; cursor = None
        while True:
            result = await service.get_feed(
                user_id=u_a.id, cursor=cursor, page_size=2,
                date_mode="boost",
                date_start=(now - timedelta(hours=48)).isoformat(),
                date_end=now.isoformat(),
            )
            all_posts.extend(result["posts"])
            cursor = result["nextCursor"]
            if cursor is None:
                break

        timestamps = [p["created_at"] for p in all_posts]
        # Boosted results should still be in descending chronological order
        assert timestamps == sorted(timestamps, reverse=True)


# ===================================================================
# P3 — Deleted authors
# ===================================================================

class TestDeletedAuthors:

    @pytest.mark.asyncio
    async def test_post_from_deleted_author_excluded(self, db_session, u_a, u_b):
        """A post whose author is deleted should not appear in feed."""
        author_id = u_b.id
        await _post(db_session, u_b, "From deleted user", age_hours=1)
        await db_session.delete(u_b)
        await db_session.commit()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=u_a.id)
        assert all(p["author_id"] != author_id for p in result["posts"])


# ===================================================================
# P3 — Date boundaries
# ===================================================================

class TestDateBoundaries:

    @pytest.mark.asyncio
    async def test_post_at_exact_date_start_included(self, db_session, u_a, u_b):
        """A post created at the start boundary is included, created before is excluded."""
        now = datetime.now(timezone.utc)
        boundary = await _post(db_session, u_b, "Boundary", age_hours=0)
        before = await _post(db_session, u_b, "Before", age_hours=72)
        start = (now - timedelta(hours=24)).isoformat()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=u_a.id,
            date_mode="required",
            date_start=start,
            date_end=(now + timedelta(hours=1)).isoformat(),
        )
        ids = {p["id"] for p in result["posts"]}
        assert boundary.id in ids
        assert all(p["content"] != "Before" for p in result["posts"])

    @pytest.mark.asyncio
    async def test_post_before_date_start_excluded(self, db_session, u_a, u_b):
        """A post created just before date_start should be excluded."""
        now = datetime.now(timezone.utc)
        start = (now - timedelta(hours=24)).isoformat()
        before = await _post(db_session, u_b, "Just before", age_hours=25)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=u_a.id,
            date_mode="required",
            date_start=start,
            date_end=now.isoformat(),
        )
        assert all(p["content"] != "Just before" for p in result["posts"])


# ===================================================================
# P3 — Empty filter values
# ===================================================================

class TestEmptyFilterValues:

    @pytest.mark.asyncio
    async def test_empty_keyword_ignored(self, db_session, u_a):
        """Empty keyword string should not filter results."""
        service = FeedServiceV2(db_session)
        with pytest.raises(ValueError, match="keyword is required when keyword_mode is provided"):
            await service.get_feed(user_id=u_a.id, keyword_mode="required", keyword="")

    @pytest.mark.asyncio
    async def test_empty_author_ids_rejected(self, db_session, u_a):
        """author_mode without author_ids should raise."""
        service = FeedServiceV2(db_session)
        with pytest.raises(ValueError, match="author_ids are required when author_mode is provided"):
            await service.get_feed(user_id=u_a.id, author_mode="required", author_ids=[])

    @pytest.mark.asyncio
    async def test_empty_type_boost_does_not_error(self, db_session, u_a, u_b):
        """Empty type_boost array should not raise and return normal feed."""
        await _post(db_session, u_b, "Normal post", age_hours=1)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=u_a.id, type_boost=[])
        assert len(result["posts"]) == 1


# ===================================================================
# P3 — Keyword normalization
# ===================================================================

class TestKeywordNormalization:

    @pytest.mark.asyncio
    async def test_multi_word_keyword(self, db_session, u_a, u_b):
        """Multi-word keyword matches posts containing all words."""
        await _post(db_session, u_b, "i feel grateful for today", age_hours=1)
        await _post(db_session, u_b, "grateful", age_hours=1)
        await _post(db_session, u_b, "nothing matches here", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=u_a.id,
            keyword_mode="required",
            keyword="feel grateful",
        )
        ids = {p["id"] for p in result["posts"]}
        assert len(ids) == 1  # only the first post matches 'feel grateful'

    @pytest.mark.asyncio
    async def test_keyword_whitespace_normalized(self, db_session, u_a, u_b):
        """Extra whitespace in keyword is normalized (leading/trailing trimmed, multiple spaces collapsed)."""
        await _post(db_session, u_b, "grateful for the day", age_hours=1)
        await _post(db_session, u_b, "nothing special", age_hours=1)

        service = FeedServiceV2(db_session)
        # Keyword with leading/trailing spaces and double spaces inside
        result = await service.get_feed(
            user_id=u_a.id,
            keyword_mode="required",
            keyword="   grateful   for   ",
        )
        ids = {p["id"] for p in result["posts"]}
        assert len(ids) > 0
        # The normalized keyword "grateful for" should match the first post
