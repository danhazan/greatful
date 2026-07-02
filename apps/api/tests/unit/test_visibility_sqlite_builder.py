"""
SQLite builder equivalence tests.

Generates the visibility SQL fragment using
``feed_visibility_sql.build_visibility_sql("sqlite")`` and executes it
against the in-memory SQLite database.
"""

import pytest
import uuid
from sqlalchemy import text

from app.services.feed_visibility_sql import build_visibility_sql
from app.models.post import Post
from app.models.post_privacy import PostPrivacyRule, PostPrivacyUser
from app.models.follow import Follow
from app.models.user import User

from .visibility_scenarios import VisibilityScenario, VISIBILITY_SCENARIOS


class TestSqliteBuilderEquivalence:
    """Every scenario from the shared matrix must produce the correct
    visibility decision when executed through the SQLite-generated SQL."""

    @pytest.mark.parametrize(
        "scenario",
        VISIBILITY_SCENARIOS,
        ids=[s.label for s in VISIBILITY_SCENARIOS],
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

        visibility_sql = build_visibility_sql(
            dialect="sqlite",
            uid_placeholder=str(viewer_id),
            table_alias="p",
        )
        check_sql = text(
            f"SELECT EXISTS(SELECT 1 FROM posts p WHERE p.id = :pid AND {visibility_sql})"
        )
        result = await db_session.execute(check_sql, {"pid": post.id})
        actual = bool(result.scalar())

        assert actual == scenario.expected_visible, (
            f"[SQLite builder] {scenario.label}: "
            f"expected visible={scenario.expected_visible}, got {actual}"
        )
