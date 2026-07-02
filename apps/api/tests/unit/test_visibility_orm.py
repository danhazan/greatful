"""
ORM equivalence tests.

Uses ``PostPrivacyService.visible_to_user_clause()`` for every scenario
from the shared matrix.  Ensures the ORM-level expression produces the
same visibility decisions as the raw-SQL builders.
"""

import pytest
import uuid
from sqlalchemy import and_, select

from app.services.post_privacy_service import PostPrivacyService
from app.models.post import Post
from app.models.post_privacy import PostPrivacyRule, PostPrivacyUser
from app.models.follow import Follow
from app.models.user import User

from .visibility_scenarios import VisibilityScenario, VISIBILITY_SCENARIOS


# ``visible_to_user_clause()`` is a composable building block — it checks
# visibility rules but does NOT filter ``deleted_at``.  The caller (e.g.
# ``_apply_visibility`` in ``PostRepository``) adds the deleted check.
# Therefore deleted-at scenarios are excluded from this ORM suite; they are
# covered by the builder suites and the integration tests.
_ORM_SCENARIOS = [s for s in VISIBILITY_SCENARIOS if not s.deleted]


class TestOrmEquivalence:
    """Every non-deleted scenario from the shared matrix must produce the
    correct visibility decision when evaluated through the ORM expression."""

    @pytest.mark.parametrize(
        "scenario",
        _ORM_SCENARIOS,
        ids=[s.label for s in _ORM_SCENARIOS],
    )
    async def test_visibility_decision(self, db_session, scenario: VisibilityScenario):
        author = User(
            email=f"author_{uuid.uuid4().hex[:8]}@test.com",
            username=f"author_{uuid.uuid4().hex[:8]}",
            hashed_password="x",
        )
        viewer = User(
            email=f"viewer_{uuid.uuid4().hex[:8]}@test.com",
            username=f"viewer_{uuid.uuid4().hex[:8]}",
            hashed_password="x",
        )
        db_session.add_all([author, viewer])
        await db_session.flush()

        author_id = author.id
        viewer_id = viewer.id if not scenario.viewer_is_author else author.id

        post = Post(
            id=str(uuid.uuid4()),
            author_id=author_id,
            content=f"Test post {scenario.label}",
            privacy_level=scenario.privacy_level,
            is_public=(scenario.privacy_level == "public"),
            deleted_at=None,
        )
        if scenario.deleted:
            from datetime import datetime, timezone
            post.deleted_at = datetime.now(timezone.utc)
        db_session.add(post)
        await db_session.flush()

        for rule_type in scenario.rule_types:
            db_session.add(PostPrivacyRule(
                id=str(uuid.uuid4()),
                post_id=post.id,
                rule_type=rule_type,
            ))

        if scenario.viewer_is_specific_user:
            db_session.add(PostPrivacyUser(
                id=str(uuid.uuid4()),
                post_id=post.id,
                user_id=viewer_id,
            ))

        if scenario.viewer_follows_author:
            db_session.add(Follow(
                id=str(uuid.uuid4()),
                follower_id=viewer_id,
                followed_id=author_id,
                status="active",
            ))

        if scenario.viewer_followed_by_author:
            db_session.add(Follow(
                id=str(uuid.uuid4()),
                follower_id=author_id,
                followed_id=viewer_id,
                status="active",
            ))

        await db_session.commit()

        clause = PostPrivacyService.visible_to_user_clause(viewer_id)
        result = await db_session.execute(
            select(Post.id).where(
                and_(Post.id == post.id, clause)
            ).limit(1)
        )
        actual = result.scalar_one_or_none() is not None

        assert actual == scenario.expected_visible, (
            f"[ORM] {scenario.label}: "
            f"expected visible={scenario.expected_visible}, got {actual}"
        )
