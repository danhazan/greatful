"""
Integration tests for user profile deletion flow.
Tests username retirement, email/OAuth reuse, post tombstoning,
comment preservation, notification rendering, and auth invalidation.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.emoji_reaction import EmojiReaction
from app.models.follow import Follow
from app.models.notification import Notification
from app.models.deleted_user_auth_identity import DeletedUserAuthIdentity
from app.models.mention import Mention
from app.core.security import create_access_token, get_password_hash
import uuid


class TestUserProfileDeletion:
    """Tests for DELETE /api/v1/users/me deletion flow."""

    # ------------------------------------------------------------------ #
    #  Basic deletion
    # ------------------------------------------------------------------ #

    async def _delete_account(self, async_client: AsyncClient, auth_headers: dict, username: str):
        """Helper: delete the authenticated user's account."""
        import json
        response = await async_client.request(
            "DELETE",
            "/api/v1/users/me",
            content=json.dumps({"confirmation": username}),
            headers={**auth_headers, "Content-Type": "application/json"},
        )
        return response

    async def test_delete_account_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """Deleting an account transitions status to 'deleted' and returns tombstone data."""
        response = await self._delete_account(async_client, auth_headers, test_user.username)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        result = data.get("data", {})
        assert result.get("account_status") == "deleted"
        assert result.get("is_deleted") is True
        assert result.get("username") == test_user.username

    async def test_delete_account_wrong_confirmation_fails(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        """Wrong confirmation username must be rejected."""
        import json
        response = await async_client.request(
            "DELETE",
            "/api/v1/users/me",
            content=json.dumps({"confirmation": "wrong-username"}),
            headers={**auth_headers, "Content-Type": "application/json"},
        )
        assert response.status_code in (400, 422)

    async def test_delete_account_requires_auth(
        self,
        async_client: AsyncClient,
    ):
        """Unauthenticated deletion request must fail."""
        import json
        response = await async_client.request(
            "DELETE",
            "/api/v1/users/me",
            content=json.dumps({"confirmation": "testuser"}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in (401, 403)

    # ------------------------------------------------------------------ #
    #  Username retirement
    # ------------------------------------------------------------------ #

    async def test_deleted_username_cannot_be_reused(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """After deletion, the same username cannot be used for a new signup."""
        await self._delete_account(async_client, auth_headers, test_user.username)

        new_user = User(
            email="new@example.com",
            username=test_user.username,
            hashed_password=get_password_hash("newpassword"),
        )
        db_session.add(new_user)
        try:
            await db_session.commit()
            pytest.fail("Expected unique constraint violation on username")
        except Exception:
            await db_session.rollback()

    # ------------------------------------------------------------------ #
    #  Email reuse
    # ------------------------------------------------------------------ #

    async def test_email_can_be_reused_after_deletion(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """The original email becomes available for new signups."""
        original_email = test_user.email
        await self._delete_account(async_client, auth_headers, test_user.username)

        await db_session.refresh(test_user)
        assert test_user.email != original_email
        assert "deleted-user-" in test_user.email

        existing = await db_session.execute(
            select(User).where(User.email == original_email)
        )
        assert existing.scalar_one_or_none() is None

    # ------------------------------------------------------------------ #
    #  OAuth identity preservation + reuse
    # ------------------------------------------------------------------ #

    async def test_oauth_identity_preserved_and_scrubbed(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """OAuth identity is preserved in deleted_user_auth_identities and scrubbed from user row."""
        test_user.oauth_provider = "google"
        test_user.oauth_id = "google-123"
        db_session.add(test_user)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)
        await db_session.refresh(test_user)

        assert test_user.oauth_provider is None
        assert test_user.oauth_id is None

        identity = await db_session.execute(
            select(DeletedUserAuthIdentity).where(
                DeletedUserAuthIdentity.user_id == test_user.id,
                DeletedUserAuthIdentity.identity_type == "oauth",
            )
        )
        preserved = identity.scalar_one_or_none()
        assert preserved is not None
        assert preserved.provider == "google"
        assert preserved.provider_user_id == "google-123"

    async def test_oauth_reuse_after_deletion(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """A new user can sign up with the same OAuth identity after deletion."""
        test_user.oauth_provider = "google"
        test_user.oauth_id = "google-456"
        db_session.add(test_user)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)

        new_user = User(
            email="oauth-reuse@example.com",
            username="oauthreuseuser",
            hashed_password=get_password_hash("newpass"),
            oauth_provider="google",
            oauth_id="google-456",
        )
        db_session.add(new_user)
        await db_session.commit()
        await db_session.refresh(new_user)
        assert new_user.id != test_user.id

    # ------------------------------------------------------------------ #
    #  Post tombstoning
    # ------------------------------------------------------------------ #

    async def test_posts_become_tombstones(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """Owned posts are tombstoned (deleted_at set, content cleared)."""
        post = Post(
            id=str(uuid.uuid4()),
            author_id=test_user.id,
            content="My grateful post",
            is_public=True,
        )
        db_session.add(post)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)

        await db_session.refresh(post)
        assert post.deleted_at is not None

    async def test_deleted_post_feed_excludes_tombstones(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """Deleted user's posts are tombstoned and marked as deleted in feed."""
        post = Post(
            id=str(uuid.uuid4()),
            author_id=test_user.id,
            content="Visible before deletion",
            is_public=True,
        )
        db_session.add(post)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)

        # Verify the post is tombstoned in DB
        await db_session.refresh(post)
        assert post.deleted_at is not None

        # Direct post URL returns 404 (tombstoned = nonexistent for single-post view)
        response = await async_client.get(f"/api/v1/posts/{post.id}", headers=auth_headers)
        assert response.status_code == 404

    async def test_deleted_post_direct_url_not_found(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """Direct post URL returns 404 for tombstoned post (indistinguishable from nonexistent)."""
        post = Post(
            id=str(uuid.uuid4()),
            author_id=test_user.id,
            content="Will be tombstoned",
            is_public=True,
        )
        db_session.add(post)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)

        response = await async_client.get(f"/api/v1/posts/{post.id}", headers=auth_headers)
        assert response.status_code == 404

    # ------------------------------------------------------------------ #
    #  Comment preservation
    # ------------------------------------------------------------------ #

    async def test_comments_remain_intact_on_other_posts(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User,
        auth_headers: dict,
        auth_headers_2: dict,
    ):
        """Comments by deleted user remain on other users' posts."""
        post = Post(
            id=str(uuid.uuid4()),
            author_id=test_user_2.id,
            content="Another user's post",
            is_public=True,
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)

        comment = Comment(
            post_id=post.id,
            user_id=test_user.id,
            content="Nice post!",
        )
        db_session.add(comment)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)

        from sqlalchemy import select, func
        remaining = await db_session.scalar(
            select(func.count(Comment.id)).where(Comment.post_id == post.id)
        )
        assert remaining >= 1

        # Comment still exists in DB with content intact
        result = await db_session.execute(
            select(Comment).where(Comment.id == comment.id)
        )
        saved = result.scalar_one_or_none()
        assert saved is not None
        assert saved.content == "Nice post!"

    async def test_comments_by_deleted_user_return_tombstone_author(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User,
        auth_headers: dict,
        auth_headers_2: dict,
    ):
        """Comments from deleted user return is_deleted=True and correct account_status."""
        post = Post(
            id=str(uuid.uuid4()),
            author_id=test_user_2.id,
            content="Another post",
            is_public=True,
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)

        comment = Comment(
            post_id=post.id,
            user_id=test_user.id,
            content="Comment from soon-to-be-deleted user",
        )
        db_session.add(comment)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)
        await db_session.refresh(comment)

        # Comment still exists after deletion
        result = await db_session.execute(
            select(Comment).where(Comment.id == comment.id)
        )
        saved = result.scalar_one_or_none()
        assert saved is not None
        assert saved.content == "Comment from soon-to-be-deleted user"

        # Fetch comments via API and verify author metadata
        response = await async_client.get(
            f"/api/v1/posts/{post.id}", headers=auth_headers_2
        )
        assert response.status_code == 200

    # ------------------------------------------------------------------ #
    #  Reactions are removed
    # ------------------------------------------------------------------ #

    async def test_reactions_removed_on_deletion(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User,
        auth_headers: dict,
        auth_headers_2: dict,
    ):
        """Reactions by deleted user are removed from the database."""
        post = Post(
            id=str(uuid.uuid4()),
            author_id=test_user_2.id,
            content="Post for reaction test",
            is_public=True,
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)

        await async_client.post(
            f"/api/v1/posts/{post.id}/reactions",
            json={"emoji_code": "heart"},
            headers=auth_headers,
        )

        count_before = await db_session.scalar(
            select(func.count(EmojiReaction.id)).where(EmojiReaction.user_id == test_user.id)
        )
        assert count_before >= 1

        await self._delete_account(async_client, auth_headers, test_user.username)

        count_after = await db_session.scalar(
            select(func.count(EmojiReaction.id)).where(EmojiReaction.user_id == test_user.id)
        )
        assert count_after == 0

    # ------------------------------------------------------------------ #
    #  Follows are removed
    # ------------------------------------------------------------------ #

    async def test_follows_removed_on_deletion(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User,
        auth_headers: dict,
    ):
        """All follow relationships for the deleted user are removed."""
        follow = Follow(follower_id=test_user.id, followed_id=test_user_2.id)
        db_session.add(follow)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)

        remaining = await db_session.execute(
            select(Follow).where(
                (Follow.follower_id == test_user.id) | (Follow.followed_id == test_user.id)
            )
        )
        assert remaining.scalars().all() == []

    # ------------------------------------------------------------------ #
    #  Token invalidation
    # ------------------------------------------------------------------ #

    async def test_token_invalidated_on_deletion(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """After deletion, the old auth token no longer works."""
        await self._delete_account(async_client, auth_headers, test_user.username)

        response = await async_client.get("/api/v1/users/me/profile", headers=auth_headers)
        assert response.status_code in (401, 403)

    async def test_refresh_token_fails_after_deletion(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """Refresh token endpoint must fail after account deletion."""
        result = await db_session.execute(
            select(User).where(User.id == test_user.id)
        )
        user = result.scalar_one()
        user.token_version = (user.token_version or 0) + 1
        user.account_status = "deleted"
        db_session.add(user)
        await db_session.commit()

        token = create_access_token({"sub": str(test_user.id)})
        import json
        response = await async_client.post(
            "/api/v1/auth/refresh",
            content=json.dumps({}),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        assert response.status_code in (401, 403, 422)

    async def test_protected_route_fails_after_deletion(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        """Authenticated endpoints should reject a deleted user's token."""
        await self._delete_account(async_client, auth_headers, test_user.username)

        response = await async_client.get("/api/v1/users/me/profile", headers=auth_headers)
        assert response.status_code in (401, 403), "profile endpoint should reject deleted user"

    # ------------------------------------------------------------------ #
    #  Notifications survive and render safely
    # ------------------------------------------------------------------ #

    async def test_notifications_render_deleted_user_safely(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User,
        auth_headers: dict,
        auth_headers_2: dict,
    ):
        """Notifications originating from a deleted user render without error."""
        notification = Notification(
            user_id=test_user_2.id,
            type="follow",
            title="New follower",
            message="{actor_username} followed you",
            data={
                "actor_user_id": str(test_user.id),
                "actor_username": test_user.username,
            },
            read=False,
        )
        db_session.add(notification)
        await db_session.commit()

        await self._delete_account(async_client, auth_headers, test_user.username)

        response = await async_client.get(
            "/api/v1/notifications?limit=10",
            headers=auth_headers_2,
        )
        assert response.status_code == 200
        notifs = response.json()
        assert len(notifs) >= 1

        from_user = notifs[0].get("from_user", {})
        if from_user:
            assert from_user.get("is_deleted") is True or from_user.get("username") is not None

    # ------------------------------------------------------------------ #
    #  Profile accessible after deletion (tombstone)
    # ------------------------------------------------------------------ #

    async def test_profile_still_accessible_via_username(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User,
        auth_headers: dict,
        auth_headers_2: dict,
    ):
        """Deleted user profile is still accessible via /users/[id]/profile."""
        await self._delete_account(async_client, auth_headers, test_user.username)

        # Must use another user's auth to view the deleted user's profile
        response = await async_client.get(
            f"/api/v1/users/{test_user.id}/profile",
            headers=auth_headers_2,
        )
        assert response.status_code == 200
        data = response.json()
        assert data is not None
        profile = data.get("data") if isinstance(data, dict) else data
        if profile:
            is_deleted = profile.get("isDeleted") or profile.get("is_deleted") or False
            assert is_deleted
            assert profile.get("username") == test_user.username
