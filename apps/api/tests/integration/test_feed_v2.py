"""
Integration tests for the feed v2 endpoint.
Tests the full pipeline: SQL scoring, cursor pagination, privacy filtering, author spacing.
"""

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone

from app.models.post import Post, PostType
from app.models.follow import Follow
from app.models.user import User
from app.core.security import create_access_token, get_password_hash
from app.services.feed_service_v2 import FeedServiceV2


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def user_a(db_session):
    """Primary test user (the viewer)."""
    user = User(
        email="user_a@test.com",
        username="user_a",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_b(db_session):
    """Second user."""
    user = User(
        email="user_b@test.com",
        username="user_b",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_c(db_session):
    """Third user."""
    user = User(
        email="user_c@test.com",
        username="user_c",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _create_post(db_session, author, content="Grateful", age_hours=0, **kwargs):
    """Helper to create a post with a specific age."""
    created_at = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    post = Post(
        id=str(uuid.uuid4()),
        author_id=author.id,
        content=content,
        post_type=kwargs.pop("post_type", PostType.daily),
        is_public=kwargs.pop("is_public", True),
        privacy_level=kwargs.pop("privacy_level", "public"),
        created_at=created_at,
        hearts_count=kwargs.pop("hearts_count", 0),
        reactions_count=kwargs.pop("reactions_count", 0),
        comments_count=kwargs.pop("comments_count", 0),
        shares_count=kwargs.pop("shares_count", 0),
        **kwargs,
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


async def _follow(db_session, follower, followed):
    """Helper to create a follow relationship."""
    follow = Follow(
        id=str(uuid.uuid4()),
        follower_id=follower.id,
        followed_id=followed.id,
        status="active",
    )
    db_session.add(follow)
    await db_session.commit()
    return follow


# ---------------------------------------------------------------------------
# Test: Basic feed retrieval
# ---------------------------------------------------------------------------

class TestFeedV2Basic:

    @pytest.mark.asyncio
    async def test_empty_feed(self, db_session, user_a):
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"] == []
        assert result["nextCursor"] is None

    @pytest.mark.asyncio
    async def test_single_post(self, db_session, user_a):
        await _create_post(db_session, user_a, "My gratitude")
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert len(result["posts"]) == 1
        assert result["posts"][0]["content"] == "My gratitude"

    @pytest.mark.asyncio
    async def test_no_algorithm_score_in_response(self, db_session, user_a):
        await _create_post(db_session, user_a)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert "algorithm_score" not in result["posts"][0]
        assert "algorithmScore" not in result["posts"][0]

    @pytest.mark.asyncio
    async def test_debug_mode_includes_scores(self, db_session, user_a):
        await _create_post(db_session, user_a)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, debug=True)
        debug_info = result["posts"][0].get("_debug")
        assert debug_info is not None
        assert "score" in debug_info
        assert "recency" in debug_info
        assert "engagement" in debug_info


# ---------------------------------------------------------------------------
# Test: Scoring and ordering
# ---------------------------------------------------------------------------

class TestFeedV2Scoring:

    @pytest.mark.asyncio
    async def test_newer_post_ranks_higher(self, db_session, user_a, user_b):
        old = await _create_post(db_session, user_b, "Old post", age_hours=48)
        new = await _create_post(db_session, user_b, "New post", age_hours=1)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert len(result["posts"]) == 2
        assert result["posts"][0]["content"] == "New post"

    @pytest.mark.asyncio
    async def test_own_post_boosted_to_top(self, db_session, user_a, user_b):
        # user_b's post is 1 hour old with high engagement
        await _create_post(
            db_session, user_b, "Popular", age_hours=0.5,
            hearts_count=50, reactions_count=20, comments_count=10,
        )
        # user_a's own post is brand new with no engagement
        await _create_post(db_session, user_a, "My own", age_hours=0)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "My own"

    @pytest.mark.asyncio
    async def test_engagement_boosts_ranking(self, db_session, user_a, user_b):
        # Same age, different engagement
        await _create_post(
            db_session, user_b, "Low engagement", age_hours=2,
            hearts_count=0, reactions_count=0,
        )
        await _create_post(
            db_session, user_b, "High engagement", age_hours=2,
            hearts_count=20, reactions_count=10, comments_count=5, shares_count=3,
        )
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "High engagement"

    @pytest.mark.asyncio
    async def test_followed_user_ranks_higher(self, db_session, user_a, user_b, user_c):
        # user_a follows user_b but not user_c
        await _follow(db_session, user_a, user_b)
        # Same age, same engagement
        await _create_post(db_session, user_c, "Unfollowed", age_hours=1)
        await _create_post(db_session, user_b, "Followed", age_hours=1)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "Followed"

    @pytest.mark.asyncio
    async def test_mutual_follow_ranks_highest(self, db_session, user_a, user_b, user_c):
        # user_a and user_b follow each other (mutual)
        await _follow(db_session, user_a, user_b)
        await _follow(db_session, user_b, user_a)
        # user_a follows user_c (one-way)
        await _follow(db_session, user_a, user_c)
        # Same age, same engagement
        await _create_post(db_session, user_c, "One-way follow", age_hours=1)
        await _create_post(db_session, user_b, "Mutual follow", age_hours=1)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "Mutual follow"


# ---------------------------------------------------------------------------
# Test: Cursor-based pagination
# ---------------------------------------------------------------------------

class TestFeedV2Pagination:

    @pytest.mark.asyncio
    async def test_pagination_returns_all_posts(self, db_session, user_a, user_b):
        # Create 5 posts with well-separated ages to avoid score ties
        created_ids = set()
        for i in range(5):
            p = await _create_post(db_session, user_b, f"Post {i}", age_hours=i * 6)
            created_ids.add(p.id)
        service = FeedServiceV2(db_session)

        # Collect all posts across pages
        all_posts = []
        cursor = None
        pages = 0
        while pages < 10:  # safety limit
            result = await service.get_feed(user_id=user_a.id, cursor=cursor, page_size=2)
            all_posts.extend(result["posts"])
            cursor = result["nextCursor"]
            pages += 1
            if cursor is None:
                break

        # All 5 created posts should be present (there may be others from fixtures)
        returned_ids = {p["id"] for p in all_posts}
        assert created_ids.issubset(returned_ids)

        # No duplicates
        all_ids = [p["id"] for p in all_posts]
        assert len(all_ids) == len(set(all_ids))

    @pytest.mark.asyncio
    async def test_pagination_order_preserved(self, db_session, user_a, user_b):
        for i in range(6):
            await _create_post(db_session, user_b, f"Post {i}", age_hours=i)
        service = FeedServiceV2(db_session)

        all_posts = []
        cursor = None
        while True:
            result = await service.get_feed(user_id=user_a.id, cursor=cursor, page_size=2)
            all_posts.extend(result["posts"])
            cursor = result["nextCursor"]
            if cursor is None:
                break

        # Check that posts are in descending order (newest first)
        timestamps = [p["created_at"] for p in all_posts]
        assert timestamps == sorted(timestamps, reverse=True)

    @pytest.mark.asyncio
    async def test_invalid_cursor_raises_400(self, client, auth_headers):
        response = client.get(
            "/api/v1/posts/feed/v2?cursor=invalid-cursor",
            headers=auth_headers,
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Test: Privacy filtering
# ---------------------------------------------------------------------------

class TestFeedV2Privacy:

    @pytest.mark.asyncio
    async def test_private_post_not_visible(self, db_session, user_a, user_b):
        await _create_post(
            db_session, user_b, "Private post",
            is_public=False, privacy_level="private",
        )
        await _create_post(db_session, user_b, "Public post")
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert len(result["posts"]) == 1
        assert result["posts"][0]["content"] == "Public post"

    @pytest.mark.asyncio
    async def test_own_private_post_visible(self, db_session, user_a):
        await _create_post(
            db_session, user_a, "My private",
            is_public=False, privacy_level="private",
        )
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert len(result["posts"]) == 1
        assert result["posts"][0]["content"] == "My private"


# ---------------------------------------------------------------------------
# Test: Author spacing
# ---------------------------------------------------------------------------

class TestFeedV2AuthorSpacing:

    @pytest.mark.asyncio
    async def test_consecutive_posts_reordered(self, db_session, user_a, user_b, user_c):
        # Create 4 posts from user_b and 2 from user_c, all similar age
        for i in range(4):
            await _create_post(db_session, user_b, f"B-{i}", age_hours=i * 0.1)
        await _create_post(db_session, user_c, "C-0", age_hours=0.5)
        await _create_post(db_session, user_c, "C-1", age_hours=1.0)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)

        authors = [p["author_id"] for p in result["posts"]]
        # Verify that user_b never has more than 2 consecutive posts
        for i in range(len(authors) - 2):
            window = authors[i : i + 3]
            if len(set(window)) == 1:
                assert False, f"Found 3 consecutive posts from author {window[0]} at index {i}"


# ---------------------------------------------------------------------------
# Test: Endpoint via TestClient
# ---------------------------------------------------------------------------

class TestFeedV2Endpoint:

    def test_endpoint_returns_200(self, client, auth_headers):
        response = client.get("/api/v1/posts/feed/v2", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        assert "nextCursor" in data or "next_cursor" in data

    def test_endpoint_requires_auth(self, client):
        response = client.get("/api/v1/posts/feed/v2")
        assert response.status_code in (401, 403)

    def test_page_size_validation(self, client, auth_headers):
        response = client.get("/api/v1/posts/feed/v2?page_size=0", headers=auth_headers)
        assert response.status_code == 400

        response = client.get("/api/v1/posts/feed/v2?page_size=51", headers=auth_headers)
        assert response.status_code == 400

    def test_page_size_default(self, client, auth_headers):
        response = client.get("/api/v1/posts/feed/v2", headers=auth_headers)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Test: Old posts included (no candidate window — scoring handles ordering)
# ---------------------------------------------------------------------------

class TestFeedV2OldPosts:

    @pytest.mark.asyncio
    async def test_old_posts_included_but_ranked_lower(self, db_session, user_a, user_b):
        # Post from 15 days ago — old but still visible
        await _create_post(db_session, user_b, "Very old", age_hours=15 * 24)
        # Post from 1 day ago — recent
        await _create_post(db_session, user_b, "Recent", age_hours=24)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert len(result["posts"]) == 2
        # Recent post should rank higher due to recency score
        assert result["posts"][0]["content"] == "Recent"
        assert result["posts"][1]["content"] == "Very old"
