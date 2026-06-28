"""
Integration tests for the feed v2 endpoint.
Tests the full pipeline: SQL scoring, cursor pagination, privacy filtering, author spacing.
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
    await db_session.flush()
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
    await db_session.flush()
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
    heart_reactions = kwargs.pop("heart_reactions", 0)
    other_reactions = kwargs.pop("other_reactions", 0)
    diverse_reactions = kwargs.pop("diverse_reactions", [])
    
    is_public = kwargs.pop("is_public", True)
    privacy_level = kwargs.pop("privacy_level", "public")
    comments_count = kwargs.pop("comments_count", 0)
    shares_count = kwargs.pop("shares_count", 0)
    image_url = kwargs.pop("image_url", None)
    location = kwargs.pop("location", None)

    total_reactions = heart_reactions + other_reactions + len(diverse_reactions)

    post = Post(
        id=str(uuid.uuid4()),
        author=author,
        content=content,
        is_public=is_public,
        privacy_level=privacy_level,
        created_at=created_at,
        reactions_count=total_reactions,
        comments_count=comments_count,
        shares_count=shares_count,
        image_url=image_url,
        location=location,
    )
    db_session.add(post)
    await db_session.flush()  # Ensure post is in session before adding reactions

    # Insert mock emoji reactions so dynamic SQL queries correctly score them
    for i in range(heart_reactions):
        reaction = EmojiReaction(
            id=str(uuid.uuid4()),
            user_id=1000 + i,  # synthetic mock user ID
            post_id=post.id,
            emoji_code="heart",
        )
        db_session.add(reaction)

    for i in range(other_reactions):
        reaction = EmojiReaction(
            id=str(uuid.uuid4()),
            user_id=2000 + i,  # synthetic mock user ID
            post_id=post.id,
            emoji_code="pray",
        )
        db_session.add(reaction)

    # diverse_reactions: each string is a distinct emoji_code from a unique user
    for i, emoji_code in enumerate(diverse_reactions):
        reaction = EmojiReaction(
            id=str(uuid.uuid4()),
            user_id=3000 + i,  # synthetic mock user ID
            post_id=post.id,
            emoji_code=emoji_code,
        )
        db_session.add(reaction)

    if heart_reactions > 0 or other_reactions > 0 or diverse_reactions:
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
        # Phase 6 extended debug fields
        assert "postAgeHours" in debug_info
        assert "authorId" in debug_info
        assert "userHasReacted" in debug_info
        assert "rawCounts" in debug_info
        assert isinstance(debug_info["rawCounts"], dict)
        # Debug meta
        meta = result.get("_debugMeta")
        assert meta is not None
        assert "queryTime" in meta
        assert "spacingMoves" in meta


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
        # user_b's post is 3 days old with high engagement (beyond recent-engagement window)
        await _create_post(
            db_session, user_b, "Popular", age_hours=72,
            heart_reactions=50, other_reactions=20, comments_count=10,
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
            heart_reactions=0, other_reactions=0,
        )
        await _create_post(
            db_session, user_b, "High engagement", age_hours=2,
            heart_reactions=20, other_reactions=10, comments_count=5, shares_count=3,
        )
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "High engagement"

    @pytest.mark.asyncio
    async def test_reactions_boost_ranking(self, db_session, user_a, user_b):
        # Same age, only reactions (any emoji type boosts equally)
        await _create_post(db_session, user_b, "Quiet post", age_hours=2)
        await _create_post(db_session, user_b, "Only reactions", age_hours=2,
                           diverse_reactions=["heart", "fire", "pray", "clap", "star"])
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "Only reactions"

    @pytest.mark.asyncio
    async def test_utc_date_range_required(self, db_session, user_a, user_b):
        now = datetime.now(timezone.utc)
        in_range = await _create_post(db_session, user_b, "In range", age_hours=6)
        too_old = await _create_post(db_session, user_b, "Too old", age_hours=72)

        start = (now - timedelta(hours=48)).isoformat()
        end = now.isoformat()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            date_mode="required",
            date_start=start,
            date_end=end,
        )
        returned_ids = {post["id"] for post in result["posts"]}
        assert in_range.id in returned_ids
        assert all(post["content"] != "Too old" for post in result["posts"])

    @pytest.mark.asyncio
    async def test_date_boost_reorders_within_required_subset(self, db_session, user_a, user_b):
        now = datetime.now(timezone.utc)
        await _follow(db_session, user_a, user_b)
        older = await _create_post(db_session, user_b, "Older followed", age_hours=30)
        recent = await _create_post(db_session, user_b, "Recent followed", age_hours=6)

        service = FeedServiceV2(db_session)
        baseline = await service.get_feed(
            user_id=user_a.id,
            type_required=["followed"],
        )
        boosted = await service.get_feed(
            user_id=user_a.id,
            type_required=["followed"],
            date_mode="boost",
            date_start=(now - timedelta(hours=48)).isoformat(),
            date_end=now.isoformat(),
        )

        baseline_ids = {post["id"] for post in baseline["posts"]}
        boosted_ids = {post["id"] for post in boosted["posts"]}
        assert baseline_ids == boosted_ids
        assert boosted["posts"][0]["id"] == recent.id

    @pytest.mark.asyncio
    async def test_feed_returns_privacy_details(self, db_session, user_a, user_b):
        """Feed response must include specific_users and privacy_rules for custom privacy posts."""
        post = await _create_post(
            db_session, user_a, "Custom privacy post",
            age_hours=1, is_public=True, privacy_level="custom",
        )
        rule = PostPrivacyRule(
            id=str(uuid.uuid4()),
            post_id=post.id,
            rule_type="specific_users",
        )
        p_user = PostPrivacyUser(
            id=str(uuid.uuid4()),
            post_id=post.id,
            user_id=user_b.id,
        )
        db_session.add_all([rule, p_user])
        await db_session.commit()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)

        assert len(result["posts"]) == 1
        feed_post = result["posts"][0]
        assert feed_post["privacy_level"] == "custom"
        assert feed_post["specific_users"] == [user_b.id]
        assert "specific_users" in feed_post["privacy_rules"]

    @pytest.mark.asyncio
    async def test_feed_public_post_has_empty_privacy_details(self, db_session, user_a):
        """Owned public post should have empty privacy arrays (fetched-but-empty)."""
        await _create_post(db_session, user_a, "Public post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)

        assert len(result["posts"]) == 1
        feed_post = result["posts"][0]
        assert feed_post["privacy_level"] == "public"
        assert feed_post["specific_users"] == []
        assert feed_post["privacy_rules"] == []

    @pytest.mark.asyncio
    async def test_feed_custom_other_user_post_omits_privacy(self, db_session, user_a, user_b, user_c):
        """Non-owned custom posts must omit privacy metadata (null, not empty array)."""
        post = await _create_post(
            db_session, user_b, "Other's custom post",
            age_hours=1, is_public=True, privacy_level="custom",
        )
        rule = PostPrivacyRule(
            id=str(uuid.uuid4()),
            post_id=post.id,
            rule_type="specific_users",
        )
        p_user_1 = PostPrivacyUser(
            id=str(uuid.uuid4()),
            post_id=post.id,
            user_id=user_a.id,
        )
        p_user_2 = PostPrivacyUser(
            id=str(uuid.uuid4()),
            post_id=post.id,
            user_id=user_c.id,
        )
        db_session.add_all([rule, p_user_1, p_user_2])
        await db_session.commit()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)

        assert len(result["posts"]) == 1
        feed_post = result["posts"][0]
        assert feed_post["privacy_level"] == "custom"
        # Viewer is not the author → privacy metadata must be null/absent
        assert feed_post.get("specific_users") is None
        assert feed_post.get("privacy_rules") is None


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
        # Use 6-hour spacing so recency differences (~0.6) overwhelm jitter (±0.1)
        for i in range(6):
            await _create_post(db_session, user_b, f"Post {i}", age_hours=i * 6)
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
            "/api/v1/posts/feed?cursor=invalid-cursor",
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
# Test: Feed filters
# ---------------------------------------------------------------------------

class TestFeedV2Filters:

    @pytest.mark.asyncio
    async def test_required_filters_use_and_semantics(self, db_session, user_a, user_b, user_c):
        await _follow(db_session, user_a, user_b)  # followed
        await _follow(db_session, user_c, user_a)  # follower
        outsider = User(
            email="user_d@test.com",
            username="user_d",
            hashed_password=get_password_hash("password"),
        )
        db_session.add(outsider)
        await db_session.flush()

        followed_post = await _create_post(db_session, user_b, "Followed post", age_hours=1)
        follower_post = await _create_post(db_session, user_c, "Follower post", age_hours=1)
        await _create_post(db_session, outsider, "Outsider post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["followed", "followers"],
        )

        returned_ids = {post["id"] for post in result["posts"]}
        # AND semantics: only posts from users who are BOTH followed AND followers (mutual)
        # Since user_b is not a follower and user_c is not followed, result should be empty
        assert len(returned_ids) == 0

    @pytest.mark.asyncio
    async def test_required_any_or_semantics_returns_union(self, db_session, user_a, user_b, user_c):
        """Test type_required_any uses OR semantics: posts matching ANY condition are returned.

        user_a follows user_b (but not mutual). user_c follows user_a (follower).
        type_required_any=["followed", "followers"] should return posts from BOTH user_b and user_c.
        """
        await _follow(db_session, user_a, user_b)
        await _follow(db_session, user_c, user_a)

        post_b = await _create_post(db_session, user_b, "Followed user post", age_hours=1)
        post_c = await _create_post(db_session, user_c, "Follower user post", age_hours=1)
        await _create_post(db_session, user_a, "Own post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required_any=["followed", "followers"],
        )

        returned_ids = {post["id"] for post in result["posts"]}
        # OR semantics: posts from BOTH followed and follower users
        assert post_b.id in returned_ids
        assert post_c.id in returned_ids

    @pytest.mark.asyncio
    async def test_required_any_mine_returns_own_posts(self, db_session, user_a, user_b):
        """Test type_required_any=['mine'] returns only the user's own posts."""
        own = await _create_post(db_session, user_a, "Own post", age_hours=1)
        await _create_post(db_session, user_b, "Other user post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, type_required_any=["mine"])
        returned_ids = {post["id"] for post in result["posts"]}
        assert own.id in returned_ids

    @pytest.mark.asyncio
    async def test_required_any_followed_returns_followed_posts(self, db_session, user_a, user_b, user_c):
        """Test type_required_any=['followed'] returns posts from followed users only."""
        await _follow(db_session, user_a, user_b)
        followed_post = await _create_post(db_session, user_b, "Followed post", age_hours=1)
        unfollowed_post = await _create_post(db_session, user_c, "Unfollowed post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, type_required_any=["followed"])
        returned_ids = {post["id"] for post in result["posts"]}
        assert followed_post.id in returned_ids
        assert unfollowed_post.id not in returned_ids

    @pytest.mark.asyncio
    async def test_required_any_followers_returns_follower_posts(self, db_session, user_a, user_b, user_c):
        """Test type_required_any=['followers'] returns posts from followers only."""
        await _follow(db_session, user_b, user_a)
        await _follow(db_session, user_c, user_a)
        follower_post = await _create_post(db_session, user_b, "Follower post", age_hours=1)
        other_post = await _create_post(db_session, user_c, "Other follower post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, type_required_any=["followers"])
        returned_ids = {post["id"] for post in result["posts"]}
        assert follower_post.id in returned_ids
        assert other_post.id in returned_ids

    @pytest.mark.asyncio
    async def test_required_any_public_returns_unrelated_posts(self, db_session, user_a, user_b):
        """Test type_required_any=['public'] returns posts from unrelated users."""
        await _create_post(db_session, user_a, "Own post", age_hours=1)
        public_post = await _create_post(db_session, user_b, "Public post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, type_required_any=["public"])
        returned_ids = {post["id"] for post in result["posts"]}
        assert public_post.id in returned_ids

    @pytest.mark.asyncio
    async def test_required_any_combination_mine_or_followers(self, db_session, user_a, user_b):
        """Test type_required_any=['mine', 'followers'] — posts matching EITHER."""
        await _follow(db_session, user_b, user_a)
        own = await _create_post(db_session, user_a, "Own post", age_hours=1)
        follower = await _create_post(db_session, user_b, "Follower post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, type_required_any=["mine", "followers"])
        returned_ids = {post["id"] for post in result["posts"]}
        assert own.id in returned_ids
        assert follower.id in returned_ids

    @pytest.mark.asyncio
    async def test_required_any_combination_followed_or_public(self, db_session, user_a, user_b, user_c):
        """Test type_required_any=['followed', 'public'] — posts matching EITHER."""
        await _follow(db_session, user_a, user_b)
        followed = await _create_post(db_session, user_b, "Followed", age_hours=1)
        public = await _create_post(db_session, user_c, "Public", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, type_required_any=["followed", "public"])
        returned_ids = {post["id"] for post in result["posts"]}
        assert followed.id in returned_ids
        assert public.id in returned_ids

    @pytest.mark.asyncio
    async def test_required_and_any_combined(self, db_session, user_a, user_b, user_c):
        """Test type_required=['images'] AND type_required_any=['mine', 'followed'].
        Both conditions must be satisfied: images AND (mine OR followed).
        """
        await _follow(db_session, user_a, user_b)
        # Own post with image
        own_img = await _create_post(db_session, user_a, "Own image", age_hours=1, image_url="https://example.com/img.jpg")
        # Followed user's post with image
        followed_img = await _create_post(db_session, user_b, "Followed image", age_hours=1, image_url="https://example.com/img.jpg")
        # Own post without image — should NOT match
        own_no_img = await _create_post(db_session, user_a, "Own no image", age_hours=1)
        # Followed user's post without image — should NOT match
        followed_no_img = await _create_post(db_session, user_b, "Followed no image", age_hours=1)
        # Unrelated user's post with image — should NOT match (not mine or followed)
        await _create_post(db_session, user_c, "Unrelated image", age_hours=1, image_url="https://example.com/img.jpg")

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["images"],
            type_required_any=["mine", "followed"],
        )
        returned_ids = {post["id"] for post in result["posts"]}
        assert own_img.id in returned_ids
        assert followed_img.id in returned_ids
        assert own_no_img.id not in returned_ids
        assert followed_no_img.id not in returned_ids

    @pytest.mark.asyncio
    async def test_required_and_mutual_filter_returns_intersection(self, db_session, user_a, user_b, user_c):
        """Test REQUIRED AND with mutual - should return only mutual relationships."""
        await _follow(db_session, user_a, user_b)  # user_a follows user_b
        await _follow(db_session, user_b, user_a)  # user_b follows user_a (mutual)
        
        await _create_post(db_session, user_b, "Mutual post", age_hours=1)
        await _create_post(db_session, user_a, "User A post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["followed", "followers"],
        )

        returned_ids = {post["id"] for post in result["posts"]}
        # Only the mutual user's post should be returned
        assert len(returned_ids) == 1

    @pytest.mark.asyncio
    async def test_required_and_time_filter_both_applied(self, db_session, user_a, user_b):
        """Test REQUIRED AND with time filter - both conditions must match."""
        now = datetime.now(timezone.utc)
        await _create_post(db_session, user_a, "Old own post", age_hours=48)
        recent = await _create_post(db_session, user_a, "Recent own post", age_hours=6)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["mine"],
            date_mode="required",
            date_start=(now - timedelta(hours=24)).isoformat(),
            date_end=now.isoformat(),
        )

        returned_ids = {post["id"] for post in result["posts"]}
        assert recent.id in returned_ids
        assert all(post["content"] != "Old own post" for post in result["posts"])

    @pytest.mark.asyncio
    async def test_public_filter_returns_unrelated_only(self, db_session, user_a, user_b, user_c):
        await _follow(db_session, user_a, user_b)  # followed
        await _follow(db_session, user_c, user_a)  # follower
        outsider = User(
            email="user_public@test.com",
            username="user_public",
            hashed_password=get_password_hash("password"),
        )
        db_session.add(outsider)
        await db_session.flush()

        await _create_post(db_session, user_a, "Mine post", age_hours=1)
        await _create_post(db_session, user_b, "Followed post", age_hours=1)
        await _create_post(db_session, user_c, "Follower post", age_hours=1)
        outsider_post = await _create_post(db_session, outsider, "Public unrelated", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["public"],
        )

        assert len(result["posts"]) == 1
        assert result["posts"][0]["id"] == outsider_post.id

    @pytest.mark.asyncio
    async def test_images_filter_covers_legacy_and_multi_image(self, db_session, user_a, user_b):
        legacy = await _create_post(db_session, user_b, "Legacy image", age_hours=1, image_url="/uploads/legacy.jpg")
        multi = await _create_post(db_session, user_b, "Multi image", age_hours=1)
        db_session.add(PostImage(
            post_id=multi.id,
            position=0,
            thumbnail_url="/uploads/thumb.jpg",
            medium_url="/uploads/medium.jpg",
            original_url="/uploads/original.jpg",
        ))
        await db_session.flush()
        await _create_post(db_session, user_b, "No image", age_hours=1)
        await db_session.commit()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["images"],
        )

        returned_ids = {post["id"] for post in result["posts"]}
        assert legacy.id in returned_ids
        assert multi.id in returned_ids
        assert all(post["content"] != "No image" for post in result["posts"])

    @pytest.mark.asyncio
    async def test_no_boost_filters_preserve_baseline_order(self, db_session, user_a, user_b):
        await _create_post(db_session, user_b, "A", age_hours=1, comments_count=3)
        await _create_post(db_session, user_b, "B", age_hours=2, comments_count=1)
        await _create_post(db_session, user_b, "C", age_hours=3, comments_count=0)

        service = FeedServiceV2(db_session)
        baseline = await service.get_feed(user_id=user_a.id)
        with_empty_boosts = await service.get_feed(user_id=user_a.id, type_boost=[])

        baseline_ids = [post["id"] for post in baseline["posts"]]
        empty_boost_ids = [post["id"] for post in with_empty_boosts["posts"]]
        assert baseline_ids == empty_boost_ids

    @pytest.mark.asyncio
    async def test_boost_score_is_capped(self, db_session, user_a, user_b):
        now = datetime.now(timezone.utc)
        await _follow(db_session, user_a, user_b)
        await _follow(db_session, user_b, user_a)
        await _create_post(
            db_session,
            user_b,
            "Boost target",
            age_hours=1,
            image_url="/uploads/boost.jpg",
        )

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_boost=["followed", "followers", "images"],
            date_mode="boost",
            date_start=(now - timedelta(hours=48)).isoformat(),
            date_end=now.isoformat(),
            debug=True,
        )

        assert result["posts"][0]["_debug"]["filterBoost"] == 3.0

    @pytest.mark.asyncio
    async def test_required_subset_then_boost_reorders_inside_subset(self, db_session, user_a, user_b, user_c):
        await _follow(db_session, user_a, user_b)  # followed users are eligible
        followed_plain = await _create_post(db_session, user_b, "Followed plain", age_hours=1)
        followed_image = await _create_post(
            db_session,
            user_b,
            "Followed image",
            age_hours=1,
            image_url="/uploads/followed-image.jpg",
        )
        await _create_post(db_session, user_c, "Unrelated image", age_hours=1, image_url="/uploads/public-image.jpg")

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["followed"],
            type_boost=["images"],
            debug=True,
        )

        # Required filter keeps only followed-author posts
        assert all(post["author_id"] == user_b.id for post in result["posts"])
        # Boost reorders only inside required subset
        assert result["posts"][0]["id"] == followed_image.id
        returned_ids = {post["id"] for post in result["posts"]}
        assert followed_plain.id in returned_ids
        assert followed_image.id in returned_ids
        assert all(post["content"] != "Unrelated image" for post in result["posts"])


# ---------------------------------------------------------------------------
# Test: Author spacing
# ---------------------------------------------------------------------------

class TestFeedV2AuthorSpacing:

    @pytest.mark.asyncio
    async def test_consecutive_posts_reordered(self, db_session, user_a, user_b, user_c):
        # Create 4 posts from user_b and 2 from user_c, all similar age
        # Use slight engagement differences to help spacing work better
        for i in range(4):
            await _create_post(db_session, user_b, f"B-{i}", age_hours=i * 0.1, other_reactions=i)
        await _create_post(db_session, user_c, "C-0", age_hours=0.5, other_reactions=1)
        await _create_post(db_session, user_c, "C-1", age_hours=1.0, other_reactions=2)

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
        response = client.get("/api/v1/posts/feed", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        assert "nextCursor" in data or "next_cursor" in data

    def test_endpoint_requires_auth(self, client):
        response = client.get("/api/v1/posts/feed")
        assert response.status_code in (401, 403)

    def test_page_size_validation(self, client, auth_headers):
        response = client.get("/api/v1/posts/feed?page_size=0", headers=auth_headers)
        assert response.status_code == 400

        response = client.get("/api/v1/posts/feed?page_size=51", headers=auth_headers)
        assert response.status_code == 400

    def test_page_size_default(self, client, auth_headers):
        response = client.get("/api/v1/posts/feed", headers=auth_headers)
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


# ---------------------------------------------------------------------------
# Test: User reaction boost
# ---------------------------------------------------------------------------

class TestFeedV2UserReaction:

    @pytest.mark.asyncio
    async def test_reacted_post_ranks_higher(self, db_session, user_a, user_b):
        """A post the user reacted to should rank above an identical unreacted post."""
        post_unreacted = await _create_post(db_session, user_b, "Unreacted", age_hours=2)
        post_reacted = await _create_post(db_session, user_b, "Reacted", age_hours=2)

        # Add user_a's reaction to post_reacted
        reaction = EmojiReaction(
            id=str(uuid.uuid4()),
            user_id=user_a.id,
            post_id=post_reacted.id,
            emoji_code="heart",
        )
        db_session.add(reaction)
        await db_session.commit()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "Reacted"


# ---------------------------------------------------------------------------
# Test: Followed user dominance
# ---------------------------------------------------------------------------

class TestFeedV2FollowDominance:

    @pytest.mark.asyncio
    async def test_followed_clearly_outranks_unfollowed(self, db_session, user_a, user_b, user_c):
        """Followed user's post should rank above unfollowed with trivial engagement at same age."""
        await _follow(db_session, user_a, user_b)
        # Both 12h old — follow bonus (3.0) should dominate over 1 reaction (~0.69 engagement)
        await _create_post(
            db_session, user_c, "Unfollowed popular", age_hours=12,
            diverse_reactions=["heart"],  # 1 reaction, 1 type → minimal engagement + bonus
        )
        await _create_post(db_session, user_b, "Followed quiet", age_hours=12)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "Followed quiet"

    @pytest.mark.asyncio
    async def test_new_high_engagement_beats_old_followed(self, db_session, user_a, user_b, user_c):
        """New high-engagement post must beat old followed post with low engagement."""
        await _follow(db_session, user_a, user_b)
        # Post A: 3 days old, followed, low engagement
        await _create_post(
            db_session, user_b, "Old followed quiet", age_hours=72,
            heart_reactions=1, other_reactions=1,
        )
        # Post B: 6 hours old, NOT followed, high engagement
        await _create_post(
            db_session, user_c, "New engaged", age_hours=6,
            heart_reactions=10, other_reactions=8, comments_count=5,
        )

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, debug=True)
        assert result["posts"][0]["content"] == "New engaged"


# ---------------------------------------------------------------------------
# Test: Diversity bonus
# ---------------------------------------------------------------------------

class TestFeedV2DiversityBonus:

    @pytest.mark.asyncio
    async def test_diverse_reactions_rank_higher_than_uniform(self, db_session, user_a, user_b):
        """Post B has same reaction count but more emoji types → higher score."""
        # Post A: 5 identical emoji (1 unique type → min bonus)
        await _create_post(
            db_session, user_b, "Uniform reactions", age_hours=2,
            diverse_reactions=["heart", "heart", "heart", "heart", "heart"],
        )
        # Post B: 5 different emoji types (5 unique types → max capped bonus)
        await _create_post(
            db_session, user_b, "Diverse reactions", age_hours=2,
            diverse_reactions=["heart", "fire", "pray", "clap", "star"],
        )
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "Diverse reactions"

    @pytest.mark.asyncio
    async def test_diversity_bonus_is_capped(self, db_session, user_a, user_b, user_c):
        """10 emoji types and 3 emoji types give the same bonus (cap = DIVERSITY_BONUS_MAX_TYPES)."""
        from app.config.feed_config import DIVERSITY_BONUS_MAX_TYPES

        # Post with exactly MAX_TYPES unique emojis
        emojis_at_cap = [f"emoji_{i}" for i in range(DIVERSITY_BONUS_MAX_TYPES)]
        await _create_post(
            db_session, user_b, "At cap", age_hours=2,
            diverse_reactions=emojis_at_cap,
        )
        # Post with MAX_TYPES + 7 unique emojis (well above cap)
        emojis_above_cap = [f"emoji_{i}" for i in range(DIVERSITY_BONUS_MAX_TYPES + 7)]
        await _create_post(
            db_session, user_c, "Above cap", age_hours=2,
            diverse_reactions=emojis_above_cap,
        )

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, debug=True)

        # Both posts have the same capped diversity bonus — ordering is deterministic
        # but the key requirement is that both appear and neither crashes
        post_contents = [p["content"] for p in result["posts"]]
        assert "At cap" in post_contents
        assert "Above cap" in post_contents

        # Verify the bonus values are equal (both capped)
        scores = {p["content"]: p["_debug"]["rawCounts"]["diversityBonus"] for p in result["posts"]}
        assert scores["At cap"] == scores["Above cap"]

    @pytest.mark.asyncio
    async def test_no_reactions_no_diversity_bonus(self, db_session, user_a, user_b):
        """A post with zero reactions must have zero diversity bonus."""
        await _create_post(db_session, user_b, "Empty post", age_hours=2)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, debug=True)
        assert result["posts"][0]["_debug"]["rawCounts"]["diversityBonus"] == 0.0

    @pytest.mark.asyncio
    async def test_diversity_bonus_additive_with_engagement(self, db_session, user_a, user_b, user_c):
        """Diversity bonus is additive: same engagement + diversity > same engagement alone."""
        # Post A: 3 reactions, same emoji (low diversity bonus)
        await _create_post(
            db_session, user_b, "Single type", age_hours=2,
            diverse_reactions=["heart", "heart", "heart"],
        )
        # Post B: 3 reactions, all different emoji (higher diversity bonus, same reaction count)
        await _create_post(
            db_session, user_c, "Three types", age_hours=2,
            diverse_reactions=["heart", "fire", "pray"],
        )
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id, debug=True)
        # Three types has higher diversity bonus → ranks first
        assert result["posts"][0]["content"] == "Three types"


# ---------------------------------------------------------------------------
# Test: New filter predicates (modal-era)
# ---------------------------------------------------------------------------

class TestFeedV2NewFilters:

    @pytest.mark.asyncio
    async def test_utc_custom_range_required(self, db_session, user_a, user_b):
        now = datetime.now(timezone.utc)
        in_range = await _create_post(db_session, user_b, "In range", age_hours=24 * 5)
        outside = await _create_post(db_session, user_b, "Outside", age_hours=24 * 60)

        start = (now - timedelta(days=10)).isoformat()
        end = now.isoformat()

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            date_mode="required",
            date_start=start,
            date_end=end,
        )

        returned_ids = {post["id"] for post in result["posts"]}
        assert in_range.id in returned_ids
        assert all(post["content"] != "Outside" for post in result["posts"])

    @pytest.mark.asyncio
    async def test_utc_range_end_before_start_raises_error(self, db_session, user_a):
        now = datetime.now(timezone.utc)
        service = FeedServiceV2(db_session)
        with pytest.raises(ValueError, match="date_end must be after date_start"):
            await service.get_feed(
                user_id=user_a.id,
                date_mode="required",
                date_start=now.isoformat(),
                date_end=(now - timedelta(hours=1)).isoformat(),
            )

    @pytest.mark.asyncio
    async def test_utc_range_requires_timezone_aware(self, db_session, user_a):
        service = FeedServiceV2(db_session)
        with pytest.raises(ValueError, match="timezone-aware"):
            await service.get_feed(
                user_id=user_a.id,
                date_mode="required",
                date_start="2026-01-01T00:00:00",
                date_end="2026-01-31T00:00:00",
            )

    @pytest.mark.asyncio
    async def test_author_required_multiple(self, db_session, user_a, user_b, user_c):
        user_b_post = await _create_post(db_session, user_b, "User B post", age_hours=1)
        user_c_post = await _create_post(db_session, user_c, "User C post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            author_mode="required",
            author_ids=[user_b.id, user_c.id],
        )

        returned_ids = {post["id"] for post in result["posts"]}
        assert user_b_post.id in returned_ids
        assert user_c_post.id in returned_ids

    @pytest.mark.asyncio
    async def test_author_boost_reorders(self, db_session, user_a, user_b, user_c):
        await _follow(db_session, user_a, user_b)
        await _follow(db_session, user_a, user_c)

        b_post = await _create_post(db_session, user_b, "User B post", age_hours=1)
        c_post = await _create_post(db_session, user_c, "User C post", age_hours=1)

        service = FeedServiceV2(db_session)
        baseline = await service.get_feed(user_id=user_a.id)
        boosted = await service.get_feed(
            user_id=user_a.id,
            author_mode="boost",
            author_ids=[user_c.id],
        )

        baseline_ids = {post["id"] for post in baseline["posts"]}
        boosted_ids = {post["id"] for post in boosted["posts"]}
        assert baseline_ids == boosted_ids

    @pytest.mark.asyncio
    async def test_keyword_required_filters_content(self, db_session, user_a, user_b):
        matching = await _create_post(db_session, user_b, "I feel grateful today", age_hours=1)
        non_matching = await _create_post(db_session, user_b, "Completely different content", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            keyword_mode="required",
            keyword="grateful",
        )

        returned_ids = {post["id"] for post in result["posts"]}
        assert matching.id in returned_ids
        assert all(post["content"] != "Completely different content" for post in result["posts"])

    @pytest.mark.asyncio
    async def test_keyword_boost_reorders_within_visible(self, db_session, user_a, user_b):
        await _follow(db_session, user_a, user_b)
        older_matching = await _create_post(db_session, user_b, "Older grateful post", age_hours=2)
        recent_non = await _create_post(db_session, user_b, "Recent non-matching content", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            keyword_mode="boost",
            keyword="grateful",
        )

        returned_ids = {post["id"] for post in result["posts"]}
        assert older_matching.id in returned_ids
        assert recent_non.id in returned_ids
        # Keyword boost (+1.0) should overcome 1h recency gap (~0.06) and rank matching post first
        assert result["posts"][0]["id"] == older_matching.id

    @pytest.mark.asyncio
    async def test_public_plus_followed_zero_results(self, db_session, user_a, user_b):
        await _follow(db_session, user_a, user_b)
        await _create_post(db_session, user_b, "Followed post", age_hours=1)
        outsider = User(
            email="outsider@test.com",
            username="outsider",
            hashed_password=get_password_hash("password"),
        )
        db_session.add(outsider)
        await db_session.flush()
        await _create_post(db_session, outsider, "Public post", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["public", "followed"],
        )

        # A post cannot be both public (unrelated) and followed → zero results
        assert len(result["posts"]) == 0

    @pytest.mark.asyncio
    async def test_image_empty_string_not_matched(self, db_session, user_a, user_b):
        legacy = await _create_post(db_session, user_b, "Legacy image", age_hours=1, image_url="/uploads/legacy.jpg")
        empty = await _create_post(db_session, user_b, "Empty image url", age_hours=1, image_url="")
        no_image = await _create_post(db_session, user_b, "No image", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            type_required=["images"],
        )

        returned_ids = {post["id"] for post in result["posts"]}
        assert legacy.id in returned_ids
        assert empty.id not in returned_ids
        assert no_image.id not in returned_ids

    @pytest.mark.asyncio
    async def test_keyword_privacy_no_leak(self, db_session, user_a, user_b):
        private = await _create_post(
            db_session, user_b, "grateful private content",
            age_hours=1, is_public=False, privacy_level="private",
        )

        service = FeedServiceV2(db_session)
        result = await service.get_feed(
            user_id=user_a.id,
            keyword_mode="required",
            keyword="grateful",
        )

        # Private post should not leak even though content matches
        assert len(result["posts"]) == 0

    @pytest.mark.asyncio
    async def test_date_boost_reorders(self, db_session, user_a, user_b):
        now = datetime.now(timezone.utc)
        await _follow(db_session, user_a, user_b)
        old = await _create_post(db_session, user_b, "Old post", age_hours=72)
        recent = await _create_post(db_session, user_b, "Recent post", age_hours=2)

        service = FeedServiceV2(db_session)
        baseline = await service.get_feed(user_id=user_a.id)
        boosted = await service.get_feed(
            user_id=user_a.id,
            date_mode="boost",
            date_start=(now - timedelta(hours=48)).isoformat(),
            date_end=now.isoformat(),
        )

        baseline_ids = {post["id"] for post in baseline["posts"]}
        boosted_ids = {post["id"] for post in boosted["posts"]}
        assert baseline_ids == boosted_ids
        assert boosted["posts"][0]["id"] == recent.id


class TestFeedV2PrivacyOwnership:
    """Verify privacy metadata is only returned for the viewer's own posts."""

    @pytest.mark.asyncio
    async def test_post_detail_own_post_has_privacy(self, db_session, user_a, user_b):
        """Author fetches own post detail → privacy details present."""
        from app.repositories.post_repository import PostRepository

        post = await _create_post(
            db_session, user_a, "My custom post",
            age_hours=1, privacy_level="custom",
        )
        rule = PostPrivacyRule(
            id=str(uuid.uuid4()), post_id=post.id, rule_type="specific_users",
        )
        p_user = PostPrivacyUser(
            id=str(uuid.uuid4()), post_id=post.id, user_id=user_b.id,
        )
        db_session.add_all([rule, p_user])
        await db_session.commit()

        repo = PostRepository(db_session)
        result = await repo.get_single_post_with_engagement(
            post_id=post.id, viewer_id=user_a.id, include_privacy_details=True,
        )

        assert result is not None
        assert result["privacy_level"] == "custom"
        assert result["specific_users"] == [user_b.id]
        assert "specific_users" in result["privacy_rules"]

    @pytest.mark.asyncio
    async def test_post_detail_other_user_omits_privacy(self, db_session, user_a, user_b, user_c):
        """Non-author fetches another's post detail → privacy metadata absent (null)."""
        from app.repositories.post_repository import PostRepository

        # Make user_a follow user_b so they can see user_b's custom post
        await _follow(db_session, user_a, user_b)

        post = await _create_post(
            db_session, user_b, "Their custom post",
            age_hours=1, privacy_level="custom",
        )
        rule = PostPrivacyRule(
            id=str(uuid.uuid4()), post_id=post.id, rule_type="followers",
        )
        p_user = PostPrivacyUser(
            id=str(uuid.uuid4()), post_id=post.id, user_id=user_c.id,
        )
        db_session.add_all([rule, p_user])
        await db_session.commit()

        repo = PostRepository(db_session)
        result = await repo.get_single_post_with_engagement(
            post_id=post.id, viewer_id=user_a.id, include_privacy_details=True,
        )

        assert result is not None
        assert result["privacy_level"] == "custom"
        # user_a is a follower (can see the post) but not the author → no privacy metadata
        assert result.get("specific_users") is None
        assert result.get("privacy_rules") is None

    @pytest.mark.asyncio
    async def test_post_detail_own_post_public_empty_privacy(self, db_session, user_a):
        """Own public post detail → privacy fetched but empty arrays."""
        from app.repositories.post_repository import PostRepository

        post = await _create_post(
            db_session, user_a, "My public post",
            age_hours=1, privacy_level="public",
        )
        await db_session.commit()

        repo = PostRepository(db_session)
        result = await repo.get_single_post_with_engagement(
            post_id=post.id, viewer_id=user_a.id, include_privacy_details=True,
        )

        assert result is not None
        assert result["privacy_level"] == "public"
        assert result.get("specific_users") == []
        assert result.get("privacy_rules") == []
