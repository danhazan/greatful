"""
Privacy Transition Regression Tests.

Core security tests that verify:
1. Private posts are immediately inaccessible to guests on creation.
2. Public→Private transitions are immediately inaccessible to guests.
3. Public→Custom transitions are immediately inaccessible to guests.
4. DB drift resilience: authorization survives inconsistent legacy state.
"""

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.post import Post
from app.models.user import User
from main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_user(db: AsyncSession, email: str, username: str) -> User:
    from app.core.security import get_password_hash

    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash("testpassword"),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def _auth_headers(user: User) -> dict:
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


async def _create_post_via_api(
    client: AsyncClient, headers: dict, *, privacy_level: str = "public", content: str = "Test"
) -> dict:
    payload = {
        "content": content,
        "privacy_level": privacy_level,
        "is_public": privacy_level == "public",
    }
    resp = await client.post("/api/v1/posts", json=payload, headers=headers)
    assert resp.status_code == 201, f"Create post failed: {resp.text}"
    return resp.json()


async def _update_privacy_via_api(
    client: AsyncClient, headers: dict, post_id: str, *, privacy_level: str,
    rules: list | None = None, specific_users: list | None = None,
) -> dict:
    payload = {"privacy_level": privacy_level}
    if rules is not None:
        payload["rules"] = rules
    if specific_users is not None:
        payload["specific_users"] = specific_users
    resp = await client.put(f"/api/v1/posts/{post_id}", json=payload, headers=headers)
    assert resp.status_code == 200, f"Update post failed: {resp.text}"
    return resp.json()


async def _guest_fetch(client: AsyncClient, post_id: str) -> int:
    """Fetch a post without auth. Returns status code."""
    resp = await client.get(f"/api/v1/posts/{post_id}")
    return resp.status_code


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestPrivatePostCreation:
    """Private posts must be immediately inaccessible to guests."""

    async def test_private_post_immediately_inaccessible(
        self, setup_test_database
    ):
        TestSessionLocal = setup_test_database
        async with TestSessionLocal() as db:
            user = await _create_user(db, "creator@test.com", "creator")

        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = _auth_headers(user)
            post = await _create_post_via_api(
                client, headers, privacy_level="private", content="Secret thought"
            )

            # Guest must NOT see this post
            status = await _guest_fetch(client, post["id"])
            assert status == 404, (
                f"Private post {post['id']} was accessible to guest (status={status}). "
                "Expected 404."
            )

    async def test_public_post_accessible_to_guest(
        self, setup_test_database
    ):
        TestSessionLocal = setup_test_database
        async with TestSessionLocal() as db:
            user = await _create_user(db, "public@test.com", "publicuser")

        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = _auth_headers(user)
            post = await _create_post_via_api(
                client, headers, privacy_level="public", content="Public thought"
            )

            # Guest MUST see this post
            status = await _guest_fetch(client, post["id"])
            assert status == 200, (
                f"Public post {post['id']} was NOT accessible to guest (status={status}). "
                "Expected 200."
            )


@pytest.mark.asyncio
class TestPublicToPrivateTransition:
    """Public→Private transitions must be immediately effective for guests."""

    async def test_public_to_private_immediately_blocks_guest(
        self, setup_test_database
    ):
        TestSessionLocal = setup_test_database
        async with TestSessionLocal() as db:
            user = await _create_user(db, "transition@test.com", "transitioner")

        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = _auth_headers(user)

            # Create as public
            post = await _create_post_via_api(
                client, headers, privacy_level="public", content="Was public"
            )
            assert await _guest_fetch(client, post["id"]) == 200

            # Transition to private
            await _update_privacy_via_api(
                client, headers, post["id"], privacy_level="private"
            )

            # Guest must now be denied — no stale cache, no temporal window
            status = await _guest_fetch(client, post["id"])
            assert status == 404, (
                f"Post {post['id']} remained accessible to guest after public→private "
                f"transition (status={status}). Expected 404."
            )


@pytest.mark.asyncio
class TestPublicToCustomTransition:
    """Public→Custom transitions must be immediately effective for guests."""

    async def test_public_to_custom_immediately_blocks_guest(
        self, setup_test_database
    ):
        TestSessionLocal = setup_test_database
        async with TestSessionLocal() as db:
            user = await _create_user(db, "custom@test.com", "customuser")

        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = _auth_headers(user)

            # Create as public
            post = await _create_post_via_api(
                client, headers, privacy_level="public", content="Was public, now custom"
            )
            assert await _guest_fetch(client, post["id"]) == 200

            # Transition to custom (followers only — guest is not a follower)
            await _update_privacy_via_api(
                client, headers, post["id"], privacy_level="custom",
                rules=["followers"],
            )

            # Guest must be denied
            status = await _guest_fetch(client, post["id"])
            assert status == 404, (
                f"Post {post['id']} remained accessible to guest after public→custom "
                f"transition (status={status}). Expected 404."
            )


@pytest.mark.asyncio
class TestDBDriftResilience:
    """Authorization must survive inconsistent legacy state.

    Even if a row has privacy_level='private' but is_public=true
    (a state the new CHECK constraint prevents), the read-path
    must still deny guest access because privacy_level is canonical.
    """

    async def test_mismatched_row_denies_guest(self, setup_test_database):
        TestSessionLocal = setup_test_database
        async with TestSessionLocal() as db:
            user = await _create_user(db, "drift@test.com", "driftuser")

            # Manually insert a drifted row — SQLite tests don't have the
            # CHECK constraint, so this simulates the legacy scenario.
            post_id = str(uuid.uuid4())
            post = Post(
                id=post_id,
                author=user,
                content="Drifted post",
                privacy_level="private",
                is_public=True,  # Inconsistent — simulates legacy drift
                created_at=datetime.now(timezone.utc),
            )
            db.add(post)
            await db.commit()

        async with AsyncClient(app=app, base_url="http://test") as client:
            # The read-path uses privacy_level (canonical), not is_public.
            # Guest must be denied even though is_public=true.
            status = await _guest_fetch(client, post_id)
            assert status == 404, (
                f"Drifted post {post_id} (privacy_level=private, is_public=true) "
                f"was accessible to guest (status={status}). "
                "Read-path must use privacy_level as canonical source of truth."
            )
