"""
Integration tests for custom post privacy visibility behavior.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.follow import Follow
from app.models.post import Post
from app.models.post_privacy import PostPrivacyRule, PostPrivacyUser
from app.models.user import User
from app.services.post_privacy_service import PostPrivacyService


def _print_privacy_debug_header(title: str):
    print(f"\n[TEST PRIVACY DEBUG] {title}")


def _print_privacy_debug_line(message: str):
    print(f"[TEST PRIVACY DEBUG] {message}")


def _extract_post_ids(feed_payload):
    if isinstance(feed_payload, list):
        return [row.get("id") for row in feed_payload if isinstance(row, dict) and row.get("id")]
    if isinstance(feed_payload, dict):
        data = feed_payload.get("data")
        if isinstance(data, list):
            return [row.get("id") for row in data if isinstance(row, dict) and row.get("id")]
    return []


@pytest.mark.asyncio
async def test_custom_specific_users_visibility_pipeline(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    auth_headers: dict,
):
    """
    Critical end-to-end test:
    custom + specific_users grants access to listed user only.
    """
    token_user_2 = create_access_token({"sub": str(test_user_2.id)})
    token_user_3 = create_access_token({"sub": str(test_user_3.id)})
    auth_headers_2 = {"Authorization": f"Bearer {token_user_2}"}
    auth_headers_3 = {"Authorization": f"Bearer {token_user_3}"}

    create_payload = {
        "content": "Custom specific users visibility test",
        "privacy_level": "custom",
        "rules": ["specific_users"],
        "specific_users": [test_user_2.id],
    }
    _print_privacy_debug_header("POST CREATION")
    _print_privacy_debug_line(f"privacy_level={create_payload['privacy_level']}")
    _print_privacy_debug_line(f"rules={create_payload['rules']}")
    _print_privacy_debug_line(f"specific_users={create_payload['specific_users']}")
    create_response = await async_client.post("/api/v1/posts", json=create_payload, headers=auth_headers)
    assert create_response.status_code == 201, create_response.text
    created = create_response.json()
    post_id = created["id"]

    post_row = await db_session.scalar(select(Post).where(Post.id == post_id))
    assert post_row is not None
    assert post_row.privacy_level == "custom"
    assert post_row.is_public is False

    rules_rows = (
        await db_session.execute(
            select(PostPrivacyRule.rule_type).where(PostPrivacyRule.post_id == post_id).order_by(PostPrivacyRule.rule_type)
        )
    ).scalars().all()
    users_rows = (
        await db_session.execute(
            select(PostPrivacyUser.user_id).where(PostPrivacyUser.post_id == post_id).order_by(PostPrivacyUser.user_id)
        )
    ).scalars().all()
    _print_privacy_debug_header("DATABASE STATE AFTER CREATE")
    _print_privacy_debug_line(
        f"post_id={post_id} privacy_level={post_row.privacy_level if post_row else None} is_public={post_row.is_public if post_row else None}"
    )
    _print_privacy_debug_line(f"DB rules rows={rules_rows}")
    _print_privacy_debug_line(f"DB users rows={users_rows}")
    assert rules_rows == ["specific_users"]
    assert users_rows == [test_user_2.id]

    allowed_direct = await async_client.get(f"/api/v1/posts/{post_id}", headers=auth_headers_2)
    blocked_direct = await async_client.get(f"/api/v1/posts/{post_id}", headers=auth_headers_3)
    assert allowed_direct.status_code == 200, allowed_direct.text
    assert blocked_direct.status_code == 403, blocked_direct.text

    allowed_feed = await async_client.get("/api/v1/posts/feed?algorithm=false&limit=50", headers=auth_headers_2)
    blocked_feed = await async_client.get("/api/v1/posts/feed?algorithm=false&limit=50", headers=auth_headers_3)
    assert allowed_feed.status_code == 200, allowed_feed.text
    assert blocked_feed.status_code == 200, blocked_feed.text
    allowed_feed_ids = _extract_post_ids(allowed_feed.json())
    blocked_feed_ids = _extract_post_ids(blocked_feed.json())
    allowed_feed_contains_post = post_id in allowed_feed_ids
    blocked_feed_contains_post = post_id in blocked_feed_ids
    _print_privacy_debug_header("VISIBILITY CHECKS")
    _print_privacy_debug_line(
        f"viewer={test_user_2.id} direct_access={allowed_direct.status_code} feed_status={allowed_feed.status_code} feed_contains_post={allowed_feed_contains_post}"
    )
    _print_privacy_debug_line(
        f"viewer={test_user_3.id} direct_access={blocked_direct.status_code} feed_status={blocked_feed.status_code} feed_contains_post={blocked_feed_contains_post}"
    )
    assert allowed_feed_contains_post
    assert not blocked_feed_contains_post

    svc = PostPrivacyService(db_session)
    allowed_clause_hit = await db_session.scalar(
        select(Post.id).where(and_(Post.id == post_id, svc.visible_to_user_clause(test_user_2.id)))
    )
    blocked_clause_hit = await db_session.scalar(
        select(Post.id).where(and_(Post.id == post_id, svc.visible_to_user_clause(test_user_3.id)))
    )
    _print_privacy_debug_header("SQL VISIBILITY CHECK")
    _print_privacy_debug_line(f"viewer={test_user_2.id} clause_hit={allowed_clause_hit}")
    _print_privacy_debug_line(f"viewer={test_user_3.id} clause_hit={blocked_clause_hit}")
    assert allowed_clause_hit == post_id
    assert blocked_clause_hit is None


@pytest.mark.asyncio
async def test_custom_followers_and_specific_users_visibility_pipeline(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    test_user_2: User,
    test_user_3: User,
    auth_headers: dict,
):
    """
    Combined rule test:
    followers OR specific_users should grant visibility.
    """
    # user_2 follows author (test_user)
    db_session.add(
        Follow(
            id=str(uuid.uuid4()),
            follower_id=test_user_2.id,
            followed_id=test_user.id,
            status="active",
        )
    )
    await db_session.commit()

    token_user_2 = create_access_token({"sub": str(test_user_2.id)})
    token_user_3 = create_access_token({"sub": str(test_user_3.id)})
    auth_headers_2 = {"Authorization": f"Bearer {token_user_2}"}
    auth_headers_3 = {"Authorization": f"Bearer {token_user_3}"}

    create_payload = {
        "content": "Custom followers + specific users test",
        "privacy_level": "custom",
        "rules": ["followers", "specific_users"],
        "specific_users": [test_user_3.id],
    }
    _print_privacy_debug_header("POST CREATION")
    _print_privacy_debug_line(f"privacy_level={create_payload['privacy_level']}")
    _print_privacy_debug_line(f"rules={create_payload['rules']}")
    _print_privacy_debug_line(f"specific_users={create_payload['specific_users']}")
    create_response = await async_client.post("/api/v1/posts", json=create_payload, headers=auth_headers)
    assert create_response.status_code == 201, create_response.text
    post_id = create_response.json()["id"]

    rules_rows = (
        await db_session.execute(
            select(PostPrivacyRule.rule_type).where(PostPrivacyRule.post_id == post_id).order_by(PostPrivacyRule.rule_type)
        )
    ).scalars().all()
    users_rows = (
        await db_session.execute(
            select(PostPrivacyUser.user_id).where(PostPrivacyUser.post_id == post_id).order_by(PostPrivacyUser.user_id)
        )
    ).scalars().all()
    post_row = await db_session.scalar(select(Post).where(Post.id == post_id))
    _print_privacy_debug_header("DATABASE STATE AFTER CREATE")
    _print_privacy_debug_line(
        f"post_id={post_id} privacy_level={post_row.privacy_level if post_row else None} is_public={post_row.is_public if post_row else None}"
    )
    _print_privacy_debug_line(f"DB rules rows={rules_rows}")
    _print_privacy_debug_line(f"DB users rows={users_rows}")
    assert rules_rows == ["followers", "specific_users"]
    assert users_rows == [test_user_3.id]

    direct_user_2 = await async_client.get(f"/api/v1/posts/{post_id}", headers=auth_headers_2)
    direct_user_3 = await async_client.get(f"/api/v1/posts/{post_id}", headers=auth_headers_3)
    assert direct_user_2.status_code == 200, direct_user_2.text
    assert direct_user_3.status_code == 200, direct_user_3.text

    feed_user_2 = await async_client.get("/api/v1/posts/feed?algorithm=false&limit=50", headers=auth_headers_2)
    feed_user_3 = await async_client.get("/api/v1/posts/feed?algorithm=false&limit=50", headers=auth_headers_3)
    assert feed_user_2.status_code == 200, feed_user_2.text
    assert feed_user_3.status_code == 200, feed_user_3.text
    feed_user_2_ids = _extract_post_ids(feed_user_2.json())
    feed_user_3_ids = _extract_post_ids(feed_user_3.json())
    feed_user_2_contains_post = post_id in feed_user_2_ids
    feed_user_3_contains_post = post_id in feed_user_3_ids
    _print_privacy_debug_header("VISIBILITY CHECKS")
    _print_privacy_debug_line(
        f"viewer={test_user_2.id} direct_access={direct_user_2.status_code} feed_status={feed_user_2.status_code} feed_contains_post={feed_user_2_contains_post}"
    )
    _print_privacy_debug_line(
        f"viewer={test_user_3.id} direct_access={direct_user_3.status_code} feed_status={feed_user_3.status_code} feed_contains_post={feed_user_3_contains_post}"
    )
    assert feed_user_2_contains_post
    assert feed_user_3_contains_post

    svc = PostPrivacyService(db_session)
    clause_hit_user_2 = await db_session.scalar(
        select(Post.id).where(and_(Post.id == post_id, svc.visible_to_user_clause(test_user_2.id)))
    )
    clause_hit_user_3 = await db_session.scalar(
        select(Post.id).where(and_(Post.id == post_id, svc.visible_to_user_clause(test_user_3.id)))
    )
    _print_privacy_debug_header("SQL VISIBILITY CHECK")
    _print_privacy_debug_line(f"viewer={test_user_2.id} clause_hit={clause_hit_user_2}")
    _print_privacy_debug_line(f"viewer={test_user_3.id} clause_hit={clause_hit_user_3}")
    assert clause_hit_user_2 == post_id
    assert clause_hit_user_3 == post_id


def test_custom_rule_identifiers_are_consistent():
    """
    Rule name parity check between expected API contract and backend constants.
    """
    assert PostPrivacyService.RULE_FOLLOWERS == "followers"
    assert PostPrivacyService.RULE_FOLLOWING == "following"
    assert PostPrivacyService.RULE_SPECIFIC_USERS == "specific_users"
