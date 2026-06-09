"""Account deletion orchestration."""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationException
from app.core.security import get_password_hash
from app.models.deleted_user_auth_identity import DeletedUserAuthIdentity
from app.models.emoji_reaction import EmojiReaction
from app.models.follow import Follow
from app.models.notification import Notification
from app.models.post import Post
from app.models.post_privacy import PostPrivacyUser
from app.models.share import Share
from app.models.token import PasswordResetToken
from app.models.user import User
from app.models.user_interaction import UserInteraction
from app.services.post_deletion_service import PostDeletionService
from app.services.profile_photo_service import ProfilePhotoService

logger = logging.getLogger(__name__)


class UserDeletionService:
    """Idempotent, resumable account deletion pipeline."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def delete_user(self, user_id: int, confirmation: str) -> dict[str, Any]:
        user = await self._get_user(user_id)
        if confirmation != user.username:
            raise ValidationException("Confirmation must match the current username")

        if user.account_status == "active":
            await self._mark_deletion_pending(user)
        elif user.account_status not in {"deletion_pending", "deleted"}:
            raise ValidationException("Account cannot be deleted from its current state")

        await self._tombstone_owned_posts(user_id)
        await self._delete_authored_reactions(user_id)
        await self._delete_relationships_and_private_rows(user_id)
        await self._cleanup_profile_media(user_id)
        await self._scrub_user(user_id)

        user = await self._get_user(user_id)
        if user.account_status != "deleted":
            user.account_status = "deleted"
            user.deleted_at = user.deleted_at or datetime.now(timezone.utc)
            user.deletion_source = user.deletion_source or "self"
            self.db.add(user)
            await self.db.commit()

        return {
            "id": user.id,
            "username": user.username,
            "account_status": user.account_status,
            "is_deleted": True,
            "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        }

    async def _get_user(self, user_id: int) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError("User", str(user_id))
        return user

    async def _mark_deletion_pending(self, user: User) -> None:
        user.account_status = "deletion_pending"
        user.deletion_requested_at = user.deletion_requested_at or datetime.now(timezone.utc)
        user.deletion_source = "self"
        user.token_version = (user.token_version or 0) + 1
        self.db.add(user)
        await self.db.commit()

    async def _tombstone_owned_posts(self, user_id: int) -> None:
        result = await self.db.execute(
            select(Post).where(Post.author_id == user_id, Post.deleted_at.is_(None))
        )
        posts = result.scalars().all()
        post_deletion = PostDeletionService(self.db)
        for post in posts:
            await post_deletion.tombstone_post(post, deletion_source="self")

    async def _delete_authored_reactions(self, user_id: int) -> None:
        affected_result = await self.db.execute(
            select(EmojiReaction.post_id).where(EmojiReaction.user_id == user_id).distinct()
        )
        affected_post_ids = list(affected_result.scalars().all())
        await self.db.execute(delete(EmojiReaction).where(EmojiReaction.user_id == user_id))
        await self.db.commit()

        for post_id in affected_post_ids:
            count_result = await self.db.execute(
                select(func.count(EmojiReaction.id)).where(
                    EmojiReaction.post_id == post_id,
                    EmojiReaction.object_type == "post",
                )
            )
            count = count_result.scalar() or 0
            await self.db.execute(
                update(Post).where(Post.id == post_id).values(reactions_count=count)
            )
        await self.db.commit()

    async def _delete_relationships_and_private_rows(self, user_id: int) -> None:
        await self.db.execute(
            delete(Follow).where((Follow.follower_id == user_id) | (Follow.followed_id == user_id))
        )
        await self.db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
        await self.db.execute(delete(PostPrivacyUser).where(PostPrivacyUser.user_id == user_id))
        await self.db.execute(
            delete(UserInteraction).where(
                (UserInteraction.user_id == user_id) | (UserInteraction.target_user_id == user_id)
            )
        )
        await self.db.execute(delete(Notification).where(Notification.user_id == user_id))
        await self.db.execute(delete(Share).where(Share.user_id == user_id))
        await self._remove_user_from_share_recipients(user_id)
        await self.db.commit()

    async def _remove_user_from_share_recipients(self, user_id: int) -> None:
        result = await self.db.execute(select(Share).where(Share.recipient_user_ids.isnot(None)))
        for share in result.scalars().all():
            recipients = share.recipient_ids_list
            if user_id in recipients:
                share.recipient_ids_list = [rid for rid in recipients if rid != user_id]
                self.db.add(share)

    async def _cleanup_profile_media(self, user_id: int) -> None:
        try:
            await ProfilePhotoService(self.db).delete_profile_photo(user_id)
        except Exception:
            await self.db.rollback()

    async def _scrub_user(self, user_id: int) -> None:
        user = await self._get_user(user_id)
        now = datetime.now(timezone.utc)
        await self._preserve_recovery_identity(user, now)

        user.email = f"deleted-user-{user.id}-{secrets.token_hex(8)}@deleted.grateful.internal"
        user.hashed_password = get_password_hash(secrets.token_urlsafe(32))
        user.bio = None
        user.profile_image_url = None
        user.display_name = None
        user.city = None
        user.institutions = None
        user.websites = None
        user.location = None
        user.profile_photo_filename = None
        user.profile_preferences = None
        user.last_feed_view = None
        user.oauth_data = None
        user.oauth_provider = None
        user.oauth_id = None
        user.deleted_at = user.deleted_at or now
        user.deletion_source = user.deletion_source or "self"
        self.db.add(user)
        await self.db.commit()

    async def _preserve_recovery_identity(self, user: User, deleted_at: datetime) -> None:
        email_hash = self._hash_identity(user.email) if user.email else None
        identity_specs = []
        if email_hash:
            identity_specs.append(("email", None, None, email_hash))
        if user.oauth_provider and user.oauth_id:
            identity_specs.append(("oauth", user.oauth_provider, user.oauth_id, email_hash))

        for identity_type, provider, provider_user_id, hashed_email in identity_specs:
            existing = await self.db.execute(
                select(DeletedUserAuthIdentity).where(
                    DeletedUserAuthIdentity.user_id == user.id,
                    DeletedUserAuthIdentity.identity_type == identity_type,
                    DeletedUserAuthIdentity.provider == provider,
                    DeletedUserAuthIdentity.provider_user_id == provider_user_id,
                )
            )
            if existing.scalar_one_or_none():
                continue
            self.db.add(
                DeletedUserAuthIdentity(
                    user_id=user.id,
                    identity_type=identity_type,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    email_hash=hashed_email,
                    deleted_at=deleted_at,
                )
            )
        await self.db.commit()

    def _hash_identity(self, value: str) -> str:
        key = os.getenv("SECRET_KEY", "development-key")
        return hashlib.sha256(f"{key}:{value.lower()}".encode("utf-8")).hexdigest()
