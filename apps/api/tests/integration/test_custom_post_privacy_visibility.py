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


async def _assert_post_visibility_parity(
    async_client: AsyncClient,
    *,
    viewer_headers: dict,
    viewer_id: int,
    post_id: str,
    author_id: int,
    expected_direct_status: int,
):
    direct_resp = await async_client.get(f"/api/v1/posts/{post_id}", headers=viewer_headers)
    assert direct_resp.status_code == expected_direct_status, direct_resp.text

    feed_resp = await async_client.get("/api/v1/posts/feed?algorithm=false&limit=50", headers=viewer_headers)
    assert feed_resp.status_code == 200, feed_resp.text
    feed_contains = post_id in _extract_post_ids(feed_resp.json())

    timeline_resp = await async_client.get(f"/api/v1/users/{author_id}/posts", headers=viewer_headers)
    assert timeline_resp.status_code == 200, timeline_resp.text
    timeline_contains = post_id in _extract_post_ids(timeline_resp.json())

    _print_privacy_debug_header("VISIBILITY CHECKS")
    _print_privacy_debug_line(
        f"viewer={viewer_id} direct_access={direct_resp.status_code} feed_contains_post={feed_contains} timeline_contains_post={timeline_contains}"
    )

    if expected_direct_status == 200:
        assert feed_contains
        assert timeline_contains
    else:
        assert not feed_contains
        assert not timeline_contains


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

    await _assert_post_visibility_parity(
        async_client,
        viewer_headers=auth_headers_2,
        viewer_id=test_user_2.id,
        post_id=post_id,
        author_id=test_user.id,
        expected_direct_status=200,
    )
    await _assert_post_visibility_parity(
        async_client,
        viewer_headers=auth_headers_3,
        viewer_id=test_user_3.id,
        post_id=post_id,
        author_id=test_user.id,
        expected_direct_status=403,
    )

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

    await _assert_post_visibility_parity(
        async_client,
        viewer_headers=auth_headers_2,
        viewer_id=test_user_2.id,
        post_id=post_id,
        author_id=test_user.id,
        expected_direct_status=200,
    )
    await _assert_post_visibility_parity(
        async_client,
        viewer_headers=auth_headers_3,
        viewer_id=test_user_3.id,
        post_id=post_id,
        author_id=test_user.id,
        expected_direct_status=200,
    )

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


@pytest.mark.asyncio
async def test_author_always_sees_own_private_and_custom_posts_in_timeline(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict,
):
    private_payload = {
        "content": "Author-only private post",
        "privacy_level": "private",
        "rules": [],
        "specific_users": [],
    }
    private_resp = await async_client.post("/api/v1/posts", json=private_payload, headers=auth_headers)
    assert private_resp.status_code == 201, private_resp.text
    private_id = private_resp.json()["id"]

    custom_payload = {
        "content": "Author custom post",
        "privacy_level": "custom",
        "rules": ["specific_users"],
        "specific_users": [],
    }
    # This payload is invalid by design (custom needs a rule audience), so use followers to keep test realistic.
    custom_payload["rules"] = ["followers"]
    custom_resp = await async_client.post("/api/v1/posts", json=custom_payload, headers=auth_headers)
    assert custom_resp.status_code == 201, custom_resp.text
    custom_id = custom_resp.json()["id"]

    me_timeline = await async_client.get("/api/v1/users/me/posts", headers=auth_headers)
    assert me_timeline.status_code == 200, me_timeline.text
    post_ids = _extract_post_ids(me_timeline.json())
    assert private_id in post_ids
    assert custom_id in post_ids
