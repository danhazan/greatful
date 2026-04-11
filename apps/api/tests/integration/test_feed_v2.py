"""
Integration tests for the feed v2 endpoint.
Tests the full pipeline: SQL scoring, cursor pagination, privacy filtering, author spacing.
"""

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone

from app.models.post import Post
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
    heart_reactions = kwargs.pop("heart_reactions", 0)
    other_reactions = kwargs.pop("other_reactions", 0)
    diverse_reactions = kwargs.pop("diverse_reactions", [])
    
    is_public = kwargs.pop("is_public", True)
    privacy_level = kwargs.pop("privacy_level", "public")
    comments_count = kwargs.pop("comments_count", 0)
    shares_count = kwargs.pop("shares_count", 0)

    total_reactions = heart_reactions + other_reactions + len(diverse_reactions)

    post = Post(
        id=str(uuid.uuid4()),
        author_id=author.id,
        content=content,
        is_public=is_public,
        privacy_level=privacy_level,
        created_at=created_at,
        reactions_count=total_reactions,
        comments_count=comments_count,
        shares_count=shares_count,
    )
    db_session.add(post)
    await db_session.commit()

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
    async def test_only_reactions_boost_ranking(self, db_session, user_a, user_b):
        # Same age, only other reactions
        await _create_post(db_session, user_b, "Quiet post", age_hours=2)
        await _create_post(db_session, user_b, "Only reactions", age_hours=2, other_reactions=5)
        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=user_a.id)
        assert result["posts"][0]["content"] == "Only reactions"

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
