"""Tombstone-based post deletion orchestration."""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.mention import Mention
from app.models.notification import Notification
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.post_privacy import PostPrivacyRule, PostPrivacyUser
from app.models.share import Share
from app.models.user_interaction import UserInteraction
from app.repositories.post_repository import PostRepository
from app.services.comment_service import CommentService
from app.services.file_upload_service import FileUploadService
from app.services.mention_service import MentionService
from app.services.reaction_service import ReactionService

logger = logging.getLogger(__name__)


class PostDeletionService:
    """Owns explicit cleanup for post tombstone deletion."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def delete_post_as_author(
        self,
        post_id: str,
        author_id: int,
        deletion_source: str = "self",
    ) -> bool:
        post_repo = PostRepository(self.db)
        post = await post_repo.get_by_id_or_404(post_id)
        if post.author_id != author_id:
            from app.core.exceptions import PermissionDeniedError

            raise PermissionDeniedError("You can only delete your own posts", "Post", "delete")
        return await self.tombstone_post(post, deletion_source=deletion_source)

    async def tombstone_post(self, post: Post, deletion_source: str = "self") -> bool:
        """Tombstone a post and explicitly clean all dependent rows."""
        if post.deleted_at is not None:
            return False

        post_id = post.id
        image_paths = await self._collect_image_paths(post)

        await CommentService(self.db).delete_comments_for_post(post_id, commit=False)
        await MentionService(self.db).delete_post_mentions(post_id, commit=False)
        await ReactionService(self.db).delete_all_post_reactions(post_id)
        await self.db.execute(delete(Share).where(Share.post_id == post_id))
        await self.db.execute(delete(PostPrivacyRule).where(PostPrivacyRule.post_id == post_id))
        await self.db.execute(delete(PostPrivacyUser).where(PostPrivacyUser.post_id == post_id))
        await self.db.execute(delete(PostImage).where(PostImage.post_id == post_id))
        await self.db.execute(delete(UserInteraction).where(UserInteraction.post_id == post_id))
        await self._delete_post_notifications(post_id)

        post.content = ""
        post.rich_content = None
        post.post_style = None
        post.image_url = None
        post.location = None
        post.location_data = None
        post.is_public = True
        post.privacy_level = "public"
        post.reactions_count = 0
        post.shares_count = 0
        post.comments_count = 0
        post.deleted_at = datetime.now(timezone.utc)
        post.deletion_source = deletion_source

        await self.db.commit()

        file_service = FileUploadService(self.db)
        for path in image_paths:
            try:
                await file_service.delete_with_deduplication(path)
            except Exception as exc:
                logger.warning("Failed to clean media for tombstoned post %s: %s", post_id, exc)

        logger.info("Tombstoned post %s", post_id)
        return True

    async def _collect_image_paths(self, post: Post) -> list[str]:
        paths: list[str] = []
        if post.image_url:
            paths.append(post.image_url)

        result = await self.db.execute(select(PostImage).where(PostImage.post_id == post.id))
        for image in result.scalars().all():
            if image.medium_url:
                paths.append(image.medium_url)
            elif image.original_url:
                paths.append(image.original_url)
            elif image.thumbnail_url:
                paths.append(image.thumbnail_url)

        return list(dict.fromkeys(paths))

    async def _delete_post_notifications(self, post_id: str) -> int:
        result = await self.db.execute(select(Notification).where(Notification.data.isnot(None)))
        notifications = result.scalars().all()
        deleted = 0
        for notification in notifications:
            data: Any = notification.data or {}
            if isinstance(data, dict) and data.get("post_id") == post_id:
                await self.db.delete(notification)
                deleted += 1
        return deleted
