"""
Feed v2 diagnostic tests — validates that each scoring signal works as intended.

These tests use debug mode to inspect score breakdowns and verify that:
- Recency decays correctly over time
- Engagement scores reflect actual counts
- Relationship bonuses apply correctly
- User reaction JOIN works
- Author spacing reorders posts
- Problem cases are reproducible

Run with: pytest tests/integration/test_feed_v2_diagnostics.py -v -s
The -s flag is important — it prints the score breakdowns.
"""

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone

from app.models.post import Post
from app.models.emoji_reaction import EmojiReaction
from app.models.follow import Follow
from app.models.user import User
from app.core.security import get_password_hash
from app.services.feed_service_v2 import FeedServiceV2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _mk_user(db_session, name):
    user = User(
        email=f"{name}@diag.test",
        username=name,
        hashed_password=get_password_hash("pw"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _mk_post(db_session, author, content="Post", age_hours=0, **kwargs):
    created_at = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    heart_reactions = kwargs.pop("heart_reactions", 0)
    other_reactions = kwargs.pop("other_reactions", 0)
    
    is_public = kwargs.pop("is_public", True)
    privacy_level = kwargs.pop("privacy_level", "public")
    comments_count = kwargs.pop("comments_count", 0)
    shares_count = kwargs.pop("shares_count", 0)
    image_url = kwargs.pop("image_url", None)
    
    total_reactions = heart_reactions + other_reactions
    
    post = Post(
        id=str(uuid.uuid4()),
        author_id=author.id,
        content=content,
        is_public=is_public,
        privacy_level=privacy_level,
        created_at=created_at,
        reactions_count=total_reactions,
        image_url=image_url,
        comments_count=comments_count,
        shares_count=shares_count,
    )
    db_session.add(post)
    await db_session.commit()
    
    # Create heart reactions (dynamic)
    for i in range(heart_reactions):
        reaction = EmojiReaction(
            id=str(uuid.uuid4()),
            user_id=1000 + i,
            post_id=post.id,
            emoji_code="heart"
        )
        db_session.add(reaction)
        
    # Create other reactions (dynamic)
    for i in range(other_reactions):
        reaction = EmojiReaction(
            id=str(uuid.uuid4()),
            user_id=2000 + i,
            post_id=post.id,
            emoji_code="pray"
        )
        db_session.add(reaction)
        
    if heart_reactions > 0 or other_reactions > 0:
        await db_session.commit()
        
    await db_session.refresh(post)
    return post


async def _follow(db_session, follower, followed):
    f = Follow(
        id=str(uuid.uuid4()),
        follower_id=follower.id,
        followed_id=followed.id,
        status="active",
    )
    db_session.add(f)
    await db_session.commit()
    return f


async def _react(db_session, user, post, emoji="heart"):
    r = EmojiReaction(
        id=str(uuid.uuid4()),
        user_id=user.id,
        post_id=post.id,
        emoji_code=emoji,
    )
    db_session.add(r)
    await db_session.commit()
    return r


def _print_breakdown(result, label=""):
    """Print score breakdown for all posts in a debug feed result."""
    if label:
        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"{'='*60}")

    meta = result.get("_debugMeta", {})
    if meta:
        print(f"  queryTime: {meta.get('queryTime')}")
        print(f"  postCount: {meta.get('postCount')}")
        moves = meta.get("spacingMoves", [])
        if moves:
            print(f"  spacingMoves: {len(moves)}")
            for m in moves:
                print(f"    post {m['postId'][:8]}.. (author={m['authorId']}) "
                      f"moved {m['fromIndex']} -> {m['toIndex']}")
        else:
            print("  spacingMoves: none")

    for i, post in enumerate(result["posts"]):
        d = post.get("_debug", {})
        if not d:
            print(f"  [{i}] {post.get('content', '?')[:40]} — NO DEBUG DATA")
            continue
        print(
            f"  [{i}] {post.get('content', '?')[:40]:<40s} "
            f"score={d['score']:>7.4f}  "
            f"rec={d['recency']:>6.4f}  "
            f"eng={d['engagement']:>5.4f}  "
            f"rel={d['relationship']:>4.1f}  "
            f"own={d['ownPostBoost']:>4.2f}  "
            f"rEng={d['recentEngagement']:>5.4f}  "
            f"uReact={d['userReaction']:>3.1f}  "
            f"disc={d['discovery']:>3.1f}  "
            f"jit={d['jitter']:>+6.4f}  "
            f"age={d['postAgeHours']:>6.1f}h  "
            f"author={d['authorId']}  "
            f"reacted={d['userHasReacted']}"
        )
        raw = d.get("rawCounts", {})
        if any(raw.values()):
            print(
                f"       rawCounts: reactions={raw['reactions']} "
                f"comments={raw['comments']} shares={raw['shares']}"
            )
    print()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def viewer(db_session):
    return await _mk_user(db_session, "viewer")


@pytest_asyncio.fixture
async def alice(db_session):
    return await _mk_user(db_session, "alice")


@pytest_asyncio.fixture
async def bob(db_session):
    return await _mk_user(db_session, "bob")


@pytest_asyncio.fixture
async def carol(db_session):
    return await _mk_user(db_session, "carol")


# ---------------------------------------------------------------------------
# 1. Recency verification
# ---------------------------------------------------------------------------

class TestDiagRecency:

    @pytest.mark.asyncio
    async def test_recency_gradient(self, db_session, viewer, alice):
        """Verify recency decays correctly: 0h, 12h, 1d, 3d, 5d, 7d."""
        ages = [0, 12, 24, 72, 120, 168]
        for age in ages:
            await _mk_post(db_session, alice, f"Age {age}h", age_hours=age)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "RECENCY GRADIENT (expect descending recency)")

        # Extract recency scores in order
        posts = result["posts"]
        recencies = [(p["content"], p["_debug"]["recency"]) for p in posts]

        # Verify ordering: newer posts should have higher recency
        for i in range(len(recencies) - 1):
            assert recencies[i][1] >= recencies[i + 1][1], (
                f"Recency not descending: {recencies[i]} vs {recencies[i+1]}"
            )

        # Verify specific bounds
        youngest = next(p for p in posts if "Age 0h" in p["content"])
        oldest = next(p for p in posts if "Age 168h" in p["content"])
        assert youngest["_debug"]["recency"] >= 9.5, f"Brand-new post recency too low: {youngest['_debug']['recency']}"
        assert oldest["_debug"]["recency"] == 0.0, f"7-day-old post recency not zero: {oldest['_debug']['recency']}"

    @pytest.mark.asyncio
    async def test_recency_old_vs_new(self, db_session, viewer, alice):
        """Explicit pair: 2h old vs 96h old. New must rank higher."""
        await _mk_post(db_session, alice, "Old (96h)", age_hours=96)
        await _mk_post(db_session, alice, "New (2h)", age_hours=2)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "RECENCY: 2h vs 96h")

        assert result["posts"][0]["content"] == "New (2h)"
        new_rec = result["posts"][0]["_debug"]["recency"]
        old_rec = result["posts"][1]["_debug"]["recency"]
        print(f"  Gap: new={new_rec:.4f} - old={old_rec:.4f} = {new_rec - old_rec:.4f}")


# ---------------------------------------------------------------------------
# 2. Engagement verification
# ---------------------------------------------------------------------------

class TestDiagEngagement:

    @pytest.mark.asyncio
    async def test_engagement_gradient(self, db_session, viewer, alice):
        """Verify engagement scores reflect actual counts."""
        configs = [
            ("Zero eng", {}),
            ("Low eng", {"heart_reactions": 2, "other_reactions": 1}),
            ("Med eng", {"heart_reactions": 10, "other_reactions": 5, "comments_count": 3}),
            ("High eng", {"heart_reactions": 50, "other_reactions": 20, "comments_count": 10, "shares_count": 5}),
        ]
        for label, kwargs in configs:
            await _mk_post(db_session, alice, label, age_hours=12, **kwargs)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "ENGAGEMENT GRADIENT (expect ascending engagement)")

        # Check engagement scores are non-zero for engaged posts
        for p in result["posts"]:
            d = p["_debug"]
            if "Zero" in p["content"]:
                assert d["engagement"] == 0.0, f"Zero engagement should be 0, got {d['engagement']}"
            elif "High" in p["content"]:
                assert d["engagement"] > 3.0, f"High engagement too low: {d['engagement']}"

    @pytest.mark.asyncio
    async def test_engagement_null_safety(self, db_session, viewer, alice):
        """Posts with NULL counts should not crash or produce NaN."""
        # Create post with explicit None/0 counts
        await _mk_post(db_session, alice, "Null counts", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "ENGAGEMENT NULL SAFETY")

        d = result["posts"][0]["_debug"]
        assert d["engagement"] == 0.0
        assert d["score"] > 0  # should still have recency


# ---------------------------------------------------------------------------
# 3. Relationship dominance verification
# ---------------------------------------------------------------------------

class TestDiagRelationship:

    @pytest.mark.asyncio
    async def test_follow_vs_no_follow(self, db_session, viewer, alice, bob):
        """Followed user's post should rank above unfollowed at same age/engagement."""
        await _follow(db_session, viewer, alice)
        # Same age, same engagement
        await _mk_post(db_session, bob, "Unfollowed (bob)", age_hours=6)
        await _mk_post(db_session, alice, "Followed (alice)", age_hours=6)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "RELATIONSHIP: followed vs unfollowed (same age)")

        assert result["posts"][0]["content"] == "Followed (alice)"
        followed_rel = result["posts"][0]["_debug"]["relationship"]
        unfollowed_rel = result["posts"][1]["_debug"]["relationship"]
        print(f"  Followed relationship: {followed_rel}, Unfollowed: {unfollowed_rel}")
        print(f"  Gap: {followed_rel - unfollowed_rel}")

    @pytest.mark.asyncio
    async def test_relationship_vs_recency(self, db_session, viewer, alice, bob):
        """Does relationship overpower recency? Check at various age gaps."""
        await _follow(db_session, viewer, alice)

        # Case: followed alice 24h old vs unfollowed bob 1h old
        await _mk_post(db_session, alice, "Followed-24h", age_hours=24)
        await _mk_post(db_session, bob, "Unfollowed-1h", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "RELATIONSHIP vs RECENCY: followed-24h vs unfollowed-1h")

        winner = result["posts"][0]["content"]
        print(f"  Winner: {winner}")
        print(f"  Score gap: {result['posts'][0]['_debug']['score'] - result['posts'][1]['_debug']['score']:.4f}")

    @pytest.mark.asyncio
    async def test_mutual_vs_one_way(self, db_session, viewer, alice, bob):
        """Mutual follow should rank above one-way follow."""
        # viewer follows alice (one-way)
        await _follow(db_session, viewer, alice)
        # viewer and bob follow each other (mutual)
        await _follow(db_session, viewer, bob)
        await _follow(db_session, bob, viewer)

        await _mk_post(db_session, alice, "One-way (alice)", age_hours=6)
        await _mk_post(db_session, bob, "Mutual (bob)", age_hours=6)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "RELATIONSHIP: mutual vs one-way (same age)")

        assert result["posts"][0]["content"] == "Mutual (bob)"

    @pytest.mark.asyncio
    async def test_old_followed_vs_newer_unfollowed_with_engagement(
        self, db_session, viewer, alice, bob
    ):
        """Can an unfollowed post's engagement overcome the follow bonus?"""
        await _follow(db_session, viewer, alice)

        # Followed alice, old, no engagement
        await _mk_post(db_session, alice, "Followed-old-quiet", age_hours=48)
        # Unfollowed bob, newer, moderate engagement
        await _mk_post(
            db_session, bob, "Unfollowed-new-popular", age_hours=6,
            heart_reactions=10, other_reactions=8, comments_count=5,
        )

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "RELATIONSHIP vs ENGAGEMENT: followed-old vs unfollowed-new-popular")

        winner = result["posts"][0]["content"]
        print(f"  Winner: {winner}")
        print(f"  This tells us whether engagement can overcome relationship bonus.")


# ---------------------------------------------------------------------------
# 4. User reaction join verification
# ---------------------------------------------------------------------------

class TestDiagUserReaction:

    @pytest.mark.asyncio
    async def test_reaction_boost_applied(self, db_session, viewer, alice):
        """Verify er_user JOIN works and user_reaction_score is non-zero for reacted posts."""
        p1 = await _mk_post(db_session, alice, "Not reacted", age_hours=2)
        p2 = await _mk_post(db_session, alice, "Reacted by viewer", age_hours=2)
        await _react(db_session, viewer, p2)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "USER REACTION: reacted vs unreacted (same age)")

        reacted = next(p for p in result["posts"] if "Reacted" in p["content"])
        unreacted = next(p for p in result["posts"] if "Not reacted" in p["content"])

        assert reacted["_debug"]["userReaction"] == 1.0, (
            f"Reacted post should have userReaction=1.0, got {reacted['_debug']['userReaction']}"
        )
        assert reacted["_debug"]["userHasReacted"] is True
        assert unreacted["_debug"]["userReaction"] == 0.0
        assert unreacted["_debug"]["userHasReacted"] is False

        print(f"  Reacted score: {reacted['_debug']['score']:.4f}")
        print(f"  Unreacted score: {unreacted['_debug']['score']:.4f}")
        print(f"  Difference: {reacted['_debug']['score'] - unreacted['_debug']['score']:.4f}")

    @pytest.mark.asyncio
    async def test_other_user_reaction_no_boost(self, db_session, viewer, alice, bob):
        """Only the viewer's own reaction should trigger the boost, not other users'."""
        p = await _mk_post(db_session, alice, "Bob reacted", age_hours=2)
        await _react(db_session, bob, p)  # bob reacts, not viewer

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "USER REACTION: other user's reaction (should NOT boost)")

        d = result["posts"][0]["_debug"]
        assert d["userReaction"] == 0.0, (
            f"Other user's reaction should not boost viewer's feed, got {d['userReaction']}"
        )


# ---------------------------------------------------------------------------
# 5. Author spacing verification
# ---------------------------------------------------------------------------

class TestDiagAuthorSpacing:

    @pytest.mark.asyncio
    async def test_spacing_with_dominant_author(self, db_session, viewer, alice, bob):
        """5 posts from alice, 2 from bob — spacing should intersperse bob."""
        for i in range(5):
            await _mk_post(db_session, alice, f"Alice-{i}", age_hours=i * 0.5)
        await _mk_post(db_session, bob, "Bob-0", age_hours=0.5)
        await _mk_post(db_session, bob, "Bob-1", age_hours=1.0)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "AUTHOR SPACING: 5 alice + 2 bob")

        authors = [p["_debug"]["authorId"] for p in result["posts"]]
        print(f"  Author sequence: {authors}")

        # Check for 3+ consecutive same author
        for i in range(len(authors) - 2):
            window = authors[i:i+3]
            if len(set(window)) == 1:
                print(f"  WARNING: 3 consecutive from author {window[0]} at index {i}")

    @pytest.mark.asyncio
    async def test_spacing_score_gaps(self, db_session, viewer, alice, bob):
        """When score gaps are large, spacing may be ineffective. Diagnose."""
        # Alice has much higher scores (viewer follows alice)
        await _follow(db_session, viewer, alice)
        for i in range(4):
            await _mk_post(db_session, alice, f"Alice-followed-{i}", age_hours=i * 2)
        # Bob is unfollowed
        await _mk_post(db_session, bob, "Bob-unfollowed-0", age_hours=1)
        await _mk_post(db_session, bob, "Bob-unfollowed-1", age_hours=3)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "AUTHOR SPACING: followed alice vs unfollowed bob (score gap)")

        authors = [p["_debug"]["authorId"] for p in result["posts"]]
        scores = [p["_debug"]["score"] for p in result["posts"]]
        print(f"  Author sequence: {authors}")
        print(f"  Score sequence: {scores}")


# ---------------------------------------------------------------------------
# 6. Recent engagement verification
# ---------------------------------------------------------------------------

class TestDiagRecentEngagement:

    @pytest.mark.asyncio
    async def test_recent_engagement_decays(self, db_session, viewer, alice):
        """Recent engagement should be high for new posts, zero for old ones."""
        await _mk_post(
            db_session, alice, "New+engaged (2h)",
            age_hours=2, comments_count=5, reactions_count=3,
        )
        await _mk_post(
            db_session, alice, "Old+engaged (72h)",
            age_hours=72, comments_count=5, reactions_count=3,
        )
        await _mk_post(
            db_session, alice, "New+quiet (2h)",
            age_hours=2,
        )

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "RECENT ENGAGEMENT: new+engaged vs old+engaged vs new+quiet")

        for p in result["posts"]:
            d = p["_debug"]
            content = p["content"]
            if "Old+engaged" in content:
                assert d["recentEngagement"] == 0.0, (
                    f"72h old post should have 0 recent engagement, got {d['recentEngagement']}"
                )
            elif "New+quiet" in content:
                assert d["recentEngagement"] == 0.0, (
                    f"No engagement should mean 0 recent engagement, got {d['recentEngagement']}"
                )


# ---------------------------------------------------------------------------
# 7. Problem case reproduction
# ---------------------------------------------------------------------------

class TestDiagProblemCases:

    @pytest.mark.asyncio
    async def test_case_a_old_post_outranks_newer(self, db_session, viewer, alice, bob):
        """
        Case A: Can an old post outrank a newer one?
        Setup: old post with engagement + follow vs new post with nothing.
        """
        await _follow(db_session, viewer, alice)

        await _mk_post(
            db_session, alice, "Old-followed-engaged (48h)", age_hours=48,
            heart_reactions=15, other_reactions=10, comments_count=5,
        )
        await _mk_post(db_session, bob, "New-unfollowed-quiet (1h)", age_hours=1)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "CASE A: old-followed-engaged vs new-unfollowed-quiet")

        winner = result["posts"][0]["content"]
        p0 = result["posts"][0]["_debug"]
        p1 = result["posts"][1]["_debug"]
        print(f"  Winner: {winner}")
        print(f"  Score breakdown comparison:")
        print(f"    Recency gap: {p0['recency'] - p1['recency']:+.4f}")
        print(f"    Engagement gap: {p0['engagement'] - p1['engagement']:+.4f}")
        print(f"    Relationship gap: {p0['relationship'] - p1['relationship']:+.4f}")
        print(f"    RecentEng gap: {p0['recentEngagement'] - p1['recentEngagement']:+.4f}")
        print(f"    Total gap: {p0['score'] - p1['score']:+.4f}")

    @pytest.mark.asyncio
    async def test_case_b_reacted_not_boosted(self, db_session, viewer, alice):
        """
        Case B: Does the user reaction boost actually change ranking?
        Two identical posts, one reacted to.
        """
        p_no = await _mk_post(db_session, alice, "No reaction", age_hours=6)
        p_yes = await _mk_post(db_session, alice, "Has reaction", age_hours=6)
        await _react(db_session, viewer, p_yes)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "CASE B: identical posts, one reacted to")

        reacted = next(p for p in result["posts"] if "Has reaction" in p["content"])
        unreacted = next(p for p in result["posts"] if "No reaction" in p["content"])
        gap = reacted["_debug"]["score"] - unreacted["_debug"]["score"]
        print(f"  Score gap from reaction: {gap:+.4f}")
        print(f"  userReaction values: reacted={reacted['_debug']['userReaction']}, unreacted={unreacted['_debug']['userReaction']}")

        if gap <= 0:
            print("  BUG: Reacted post does NOT rank higher despite boost!")
        else:
            print("  OK: Reacted post ranks higher.")

    @pytest.mark.asyncio
    async def test_case_c_author_cluster(self, db_session, viewer, alice, bob, carol):
        """
        Case C: Multiple posts from same author clustering.
        6 from alice (followed), 2 from bob, 2 from carol.
        """
        await _follow(db_session, viewer, alice)
        for i in range(6):
            await _mk_post(db_session, alice, f"Alice-{i}", age_hours=i)
        await _mk_post(db_session, bob, "Bob-0", age_hours=2)
        await _mk_post(db_session, bob, "Bob-1", age_hours=4)
        await _mk_post(db_session, carol, "Carol-0", age_hours=3)
        await _mk_post(db_session, carol, "Carol-1", age_hours=5)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "CASE C: 6 alice (followed) + 2 bob + 2 carol")

        authors = [p["_debug"]["authorId"] for p in result["posts"]]
        print(f"  Author sequence: {authors}")

        # Count max consecutive same author
        max_consec = 1
        cur_consec = 1
        for i in range(1, len(authors)):
            if authors[i] == authors[i-1]:
                cur_consec += 1
                max_consec = max(max_consec, cur_consec)
            else:
                cur_consec = 1
        print(f"  Max consecutive same author: {max_consec}")

    @pytest.mark.asyncio
    async def test_case_d_own_post_vs_popular_followed(self, db_session, viewer, alice):
        """
        Case D: Own brand-new post vs popular followed post.
        Own post should always appear at top when fresh.
        """
        await _follow(db_session, viewer, alice)

        await _mk_post(
            db_session, alice, "Alice popular (6h)", age_hours=6,
            heart_reactions=30, other_reactions=15, comments_count=8,
        )
        await _mk_post(db_session, viewer, "My own post (0h)", age_hours=0)

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "CASE D: own brand-new vs popular followed")

        winner = result["posts"][0]["content"]
        print(f"  Winner: {winner}")
        if "My own" not in winner:
            print("  WARNING: Own brand-new post did NOT appear at top!")

    @pytest.mark.asyncio
    async def test_case_e_discovery_conditions(self, db_session, viewer, alice):
        """
        Case E: Discovery boost should apply only when conditions are met.
        Unfollowed user, high engagement, has image.
        """
        # Qualifies for discovery: unfollowed, high engagement, has image
        await _mk_post(
            db_session, alice, "Discoverable", age_hours=12,
            heart_reactions=20, other_reactions=10, comments_count=5, shares_count=3,
            image_url="https://example.com/photo.jpg",
        )
        # Same engagement but no image
        await _mk_post(
            db_session, alice, "No image", age_hours=12,
            heart_reactions=20, other_reactions=10, comments_count=5, shares_count=3,
        )
        # Has image but low engagement
        await _mk_post(
            db_session, alice, "Low engagement", age_hours=12,
            heart_reactions=1,
            image_url="https://example.com/photo2.jpg",
        )

        service = FeedServiceV2(db_session)
        result = await service.get_feed(user_id=viewer.id, debug=True)
        _print_breakdown(result, "CASE E: discovery conditions (image + engagement)")

        for p in result["posts"]:
            d = p["_debug"]
            content = p["content"]
            if "Discoverable" in content:
                print(f"  Discoverable: discovery={d['discovery']} (expect 2.0)")
                assert d["discovery"] == 2.0, f"Expected discovery=2.0, got {d['discovery']}"
            elif "No image" in content:
                print(f"  No image: discovery={d['discovery']} (expect 0)")
                assert d["discovery"] == 0.0, f"Expected discovery=0, got {d['discovery']}"
            elif "Low engagement" in content:
                print(f"  Low engagement: discovery={d['discovery']} (expect 0)")
                assert d["discovery"] == 0.0, f"Expected discovery=0, got {d['discovery']}"
