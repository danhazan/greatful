"""
J7 Slice 6a: client_key idempotency for Community post creation.

Matrix: nullable key, echo, JSON/multipart replay (200 same id, no second
row), cross-author isolation, deleted-key reuse, malformed/oversized keys,
and the DB-level partial uniqueness guard.
"""

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image

from app.core.security import create_access_token
from app.models.post import Post
from app.models.user import User


def _image_bytes(color: str = "red") -> bytes:
    img = Image.new("RGB", (10, 10), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


async def _post_count(db_session: AsyncSession) -> int:
    result = await db_session.execute(select(func.count()).select_from(Post))
    return result.scalar_one()


class TestClientKeyJsonCreate:
    @pytest.mark.asyncio
    async def test_create_without_key_still_201_and_key_absent(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        response = await async_client.post(
            "/api/v1/posts", json={"content": "grateful, no key"}, headers=auth_headers
        )
        assert response.status_code == 201
        assert response.json().get("clientKey") is None

    @pytest.mark.asyncio
    async def test_create_with_new_key_201_and_echoes_key(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        key = str(uuid.uuid4())
        response = await async_client.post(
            "/api/v1/posts",
            json={"content": "grateful, keyed", "client_key": key},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["clientKey"] == key
        assert data["id"]

    @pytest.mark.asyncio
    async def test_replay_same_key_returns_existing_200_without_duplicate(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        key = str(uuid.uuid4())
        first = await async_client.post(
            "/api/v1/posts",
            json={"content": "first attempt", "client_key": key},
            headers=auth_headers,
        )
        assert first.status_code == 201
        before = await _post_count(db_session)

        second = await async_client.post(
            "/api/v1/posts",
            json={"content": "first attempt", "client_key": key},
            headers=auth_headers,
        )
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]
        assert second.json()["clientKey"] == key
        assert await _post_count(db_session) == before

    @pytest.mark.asyncio
    async def test_replay_same_key_different_body_returns_existing(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        """Stable-key replay: documented simple-return, no body hashing."""
        key = str(uuid.uuid4())
        first = await async_client.post(
            "/api/v1/posts",
            json={"content": "original body", "client_key": key},
            headers=auth_headers,
        )
        assert first.status_code == 201

        second = await async_client.post(
            "/api/v1/posts",
            json={"content": "materially different body", "client_key": key},
            headers=auth_headers,
        )
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]

    @pytest.mark.asyncio
    async def test_same_key_other_author_creates_new_post(
        self,
        async_client: AsyncClient,
        auth_headers,
        auth_headers_2,
        db_session: AsyncSession,
    ):
        key = str(uuid.uuid4())
        first = await async_client.post(
            "/api/v1/posts",
            json={"content": "author one", "client_key": key},
            headers=auth_headers,
        )
        assert first.status_code == 201

        second = await async_client.post(
            "/api/v1/posts",
            json={"content": "author two", "client_key": key},
            headers=auth_headers_2,
        )
        assert second.status_code == 201
        assert second.json()["id"] != first.json()["id"]

    @pytest.mark.asyncio
    async def test_empty_key_treated_as_absent(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        response = await async_client.post(
            "/api/v1/posts",
            json={"content": "blank key", "client_key": "   "},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json().get("clientKey") is None

    @pytest.mark.asyncio
    async def test_oversized_key_rejected(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        response = await async_client.post(
            "/api/v1/posts",
            json={"content": "big key", "client_key": "k" * 129},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_non_string_key_rejected(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        response = await async_client.post(
            "/api/v1/posts",
            json={"content": "typed key", "client_key": 12345},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_deleted_key_reuse_creates_new_post(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        key = str(uuid.uuid4())
        first = await async_client.post(
            "/api/v1/posts",
            json={"content": "to be deleted", "client_key": key},
            headers=auth_headers,
        )
        assert first.status_code == 201

        deleted = await async_client.delete(
            f"/api/v1/posts/{first.json()['id']}", headers=auth_headers
        )
        assert deleted.status_code == 200

        again = await async_client.post(
            "/api/v1/posts",
            json={"content": "reborn with same key", "client_key": key},
            headers=auth_headers,
        )
        assert again.status_code == 201
        assert again.json()["id"] != first.json()["id"]
        assert again.json()["clientKey"] == key


class TestClientKeyMultipartCreate:
    @pytest.mark.asyncio
    async def test_upload_with_new_key_201_and_echoes(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        key = str(uuid.uuid4())
        response = await async_client.post(
            "/api/v1/posts/upload",
            headers={"Authorization": auth_headers["Authorization"]},
            data={"content": "image post", "client_key": key, "force_upload": "true"},
            files={"images": ("a.png", _image_bytes("red"), "image/png")},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["clientKey"] == key
        assert len(data["images"]) == 1

    @pytest.mark.asyncio
    async def test_upload_replay_returns_existing_without_reupload(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        key = str(uuid.uuid4())
        first = await async_client.post(
            "/api/v1/posts/upload",
            headers={"Authorization": auth_headers["Authorization"]},
            data={"content": "image post", "client_key": key, "force_upload": "true"},
            files={"images": ("a.png", _image_bytes("blue"), "image/png")},
        )
        assert first.status_code == 201
        before = await _post_count(db_session)

        second = await async_client.post(
            "/api/v1/posts/upload",
            headers={"Authorization": auth_headers["Authorization"]},
            data={"content": "image post", "client_key": key},
        )
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]
        assert await _post_count(db_session) == before

    @pytest.mark.asyncio
    async def test_upload_oversized_key_rejected(
        self, async_client: AsyncClient, auth_headers, db_session: AsyncSession
    ):
        response = await async_client.post(
            "/api/v1/posts/upload",
            headers={"Authorization": auth_headers["Authorization"]},
            data={"content": "big key upload", "client_key": "k" * 129},
        )
        assert response.status_code == 422


class TestClientKeyConstraint:
    @pytest.mark.asyncio
    async def test_db_rejects_second_active_post_for_same_author_key(
        self, db_session: AsyncSession, test_user: User
    ):
        key = str(uuid.uuid4())
        db_session.add(Post(id=str(uuid.uuid4()), author_id=test_user.id, content="one", client_key=key))
        await db_session.commit()

        db_session.add(Post(id=str(uuid.uuid4()), author_id=test_user.id, content="two", client_key=key))
        with pytest.raises(IntegrityError):
            await db_session.commit()
        await db_session.rollback()

    @pytest.mark.asyncio
    async def test_db_allows_null_keys_and_deleted_reuse(
        self, db_session: AsyncSession, test_user: User
    ):
        from datetime import datetime, timezone

        db_session.add(Post(id=str(uuid.uuid4()), author_id=test_user.id, content="n1"))
        db_session.add(Post(id=str(uuid.uuid4()), author_id=test_user.id, content="n2"))
        key = str(uuid.uuid4())
        db_session.add(
            Post(
                id=str(uuid.uuid4()),
                author_id=test_user.id,
                content="gone",
                client_key=key,
                deleted_at=datetime.now(timezone.utc),
            )
        )
        db_session.add(Post(id=str(uuid.uuid4()), author_id=test_user.id, content="anew", client_key=key))
        await db_session.commit()
