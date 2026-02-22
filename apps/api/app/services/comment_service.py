"""
CommentService for handling comment business logic.
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import delete, or_
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException, PermissionDeniedError, BusinessLogicError
from app.core.storage import storage  # ← ADDED: Import storage adapter
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.core.notification_factory import NotificationFactory

logger = logging.getLogger(__name__)


class CommentService(BaseService):
    """Service for managing comments and replies on posts."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)

    async def create_comment(
        self,
        post_id: str,
        user_id: int,
        content: str,
        parent_comment_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new comment or reply.
        
        Args:
            post_id: ID of the post to comment on
            user_id: ID of the user creating the comment
            content: Comment content (1-500 characters)
            parent_comment_id: Optional ID of parent comment for replies
            
        Returns:
            Dict: Comment data with user information and full URLs
            
        Raises:
            NotFoundError: If post or parent comment doesn't exist
            ValidationException: If content length is invalid or reply nesting is invalid
        """
        # Validate content length
        self.validate_field_length(content.strip(), "content", max_length=500, min_length=1)
        
        # Verify post exists
        post = await self.get_by_id_or_404(Post, post_id, "Post")
        
        # Verify user exists
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        # If this is a reply, validate parent comment
        if parent_comment_id:
            parent_comment = await self.get_by_id_or_404(
                Comment, 
                parent_comment_id, 
                "Comment"
            )
            
            # Verify parent comment belongs to the same post
            if parent_comment.post_id != post_id:
                raise ValidationException(
                    "Parent comment does not belong to this post",
                    {"parent_comment_id": "Comment must belong to the same post"}
                )
            
            # Prevent replies to replies (single-level nesting only)
            if parent_comment.parent_comment_id is not None:
                raise ValidationException(
                    "Cannot reply to a reply. Only single-level nesting is allowed.",
                    {"parent_comment_id": "Cannot create nested replies"}
                )
        
        # Create the comment
        comment = await self.create_entity(
            Comment,
            post_id=post_id,
            user_id=user_id,
            content=content.strip(),
            parent_comment_id=parent_comment_id
        )
        
        # Increment post comments_count
        post.comments_count = (post.comments_count or 0) + 1
        await self.db.commit()
        
        # Refresh post to ensure comments_count is up-to-date
        await self.db.refresh(post)
        
        logger.info(
            f"Created comment {comment.id} by user {user_id} on post {post_id}"
            + (f" (reply to {parent_comment_id})" if parent_comment_id else "")
        )
        
        # Create notifications using NotificationFactory convenience methods
        try:
            notification_factory = NotificationFactory(self.db)
            
            if parent_comment_id:
                # This is a reply - notify the parent comment author
                parent_comment = await self.get_by_id(Comment, parent_comment_id)
                if parent_comment and parent_comment.user_id != user_id:
                    # Don't notify if replying to own comment
                    await notification_factory.create_comment_reply_notification(
                        comment_author_id=parent_comment.user_id,
                        replier_username=user.username,
                        replier_id=user_id,
                        post_id=post_id,
                        comment_id=comment.id,
                        parent_comment_id=parent_comment_id
                    )
            else:
                # This is a top-level comment - notify the post author
                if post.author_id != user_id:
                    # Don't notify if commenting on own post
                    await notification_factory.create_comment_notification(
                        post_author_id=post.author_id,
                        commenter_username=user.username,
                        commenter_id=user_id,
                        post_id=post_id,
                        comment_id=comment.id
                    )
        except Exception as e:
            logger.error(f"Failed to create notification for comment: {e}")
            # Don't fail the comment creation if notification fails
        
        # ✅ FIXED: Convert profile_image_url to full URL
        profile_image_url = None
        if user.profile_image_url:
            profile_image_url = storage.get_url(user.profile_image_url)
        
        # Return comment data with user information
        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "user_id": comment.user_id,
            "parent_comment_id": comment.parent_comment_id,
            "content": comment.content,
            "created_at": comment.created_at.isoformat(),
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
            "edited_at": comment.edited_at.isoformat() if comment.edited_at else None,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "profile_image_url": profile_image_url  # ← Full URL now!
            }
        }

    async def get_post_comments(
        self,
        post_id: str,
        include_replies: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get all comments for a post with user data loaded.
        
        Args:
            post_id: ID of the post
            include_replies: Whether to include replies (default: True)
            
        Returns:
            List[Dict]: List of comment dictionaries with user data and full URLs
        """
        # Build query for top-level comments
        query = select(Comment).where(
            Comment.post_id == post_id,
            Comment.parent_comment_id.is_(None)
        ).options(
            selectinload(Comment.user)
        ).order_by(Comment.created_at.asc())
        
        result = await self.db.execute(query)
        comments = result.scalars().all()
        
        # Convert to dictionaries
        comment_list = []
        for comment in comments:
            # ✅ FIXED: Convert profile_image_url to full URL
            profile_image_url = None
            if comment.user.profile_image_url:
                profile_image_url = storage.get_url(comment.user.profile_image_url)
            
            comment_dict = {
                "id": comment.id,
                "post_id": comment.post_id,
                "user_id": comment.user_id,
                "parent_comment_id": comment.parent_comment_id,
                "content": comment.content,
                "created_at": comment.created_at.isoformat(),
                "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
                "edited_at": comment.edited_at.isoformat() if comment.edited_at else None,
                "user": {
                    "id": comment.user.id,
                    "username": comment.user.username,
                    "display_name": comment.user.display_name,
                    "profile_image_url": profile_image_url  # ← Full URL now!
                }
            }
            
            # Fetch replies if requested (lazy loading for performance)
            if include_replies:
                replies = await self.get_comment_replies(comment.id)
                comment_dict["replies"] = replies
            else:
                comment_dict["replies"] = []
            
            comment_list.append(comment_dict)
        
        return comment_list

    async def get_comment_replies(self, comment_id: str) -> List[Dict[str, Any]]:
        """
        Get replies for a specific comment.

        Args:
            comment_id: ID of the parent comment

        Returns:
            List[Dict]: List of reply dictionaries with user data and full URLs.
                        Each reply includes 'can_delete' indicating if it can be deleted
                        (only the chronologically last reply can be deleted).
        """
        query = select(Comment).where(
            Comment.parent_comment_id == comment_id
        ).options(
            selectinload(Comment.user)
        ).order_by(Comment.created_at.asc())

        result = await self.db.execute(query)
        replies = list(result.scalars().all())

        # Build reply list - only the last reply can be deleted
        reply_list = []
        total_replies = len(replies)

        for index, reply in enumerate(replies):
            # Only the last reply (chronologically) can be deleted
            is_last_reply = (index == total_replies - 1)

            # ✅ FIXED: Convert profile_image_url to full URL
            profile_image_url = None
            if reply.user.profile_image_url:
                profile_image_url = storage.get_url(reply.user.profile_image_url)

            reply_list.append({
                "id": reply.id,
                "post_id": reply.post_id,
                "user_id": reply.user_id,
                "parent_comment_id": reply.parent_comment_id,
                "content": reply.content,
                "created_at": reply.created_at.isoformat(),
                "updated_at": reply.updated_at.isoformat() if reply.updated_at else None,
                "edited_at": reply.edited_at.isoformat() if reply.edited_at else None,
                "user": {
                    "id": reply.user.id,
                    "username": reply.user.username,
                    "display_name": reply.user.display_name,
                    "profile_image_url": profile_image_url  # ← Full URL now!
                },
                "can_delete": is_last_reply  # Only the last reply can be deleted
            })

        return reply_list

    async def edit_comment(
        self,
        comment_id: str,
        user_id: int,
        content: str
    ) -> Dict[str, Any]:
        """
        Edit a comment (owner only).

        Args:
            comment_id: ID of the comment to edit
            user_id: ID of the user attempting to edit
            content: New comment content (1-500 characters)

        Returns:
            Dict: Updated comment data with user information and full URLs

        Raises:
            NotFoundError: If comment doesn't exist
            PermissionDeniedError: If user is not the comment owner
            ValidationException: If content is invalid
        """
        from datetime import datetime, timezone

        # Validate content length
        self.validate_field_length(content.strip(), "content", max_length=500, min_length=1)

        # Get the comment
        comment = await self.get_by_id_or_404(Comment, comment_id, "Comment")

        # Verify ownership
        if comment.user_id != user_id:
            raise PermissionDeniedError(
                "Cannot edit other user's comment",
                "Comment",
                "edit"
            )

        # Get user for response
        user = await self.get_by_id_or_404(User, user_id, "User")

        # Update the comment
        comment.content = content.strip()
        comment.edited_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(comment)

        logger.info(f"Edited comment {comment_id} by user {user_id}")

        # Get reply count for this comment
        from sqlalchemy import func
        reply_count_query = select(func.count(Comment.id)).where(
            Comment.parent_comment_id == comment_id
        )
        result = await self.db.execute(reply_count_query)
        reply_count = result.scalar() or 0

        # ✅ FIXED: Convert profile_image_url to full URL
        profile_image_url = None
        if user.profile_image_url:
            profile_image_url = storage.get_url(user.profile_image_url)

        # Return updated comment data
        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "user_id": comment.user_id,
            "parent_comment_id": comment.parent_comment_id,
            "content": comment.content,
            "created_at": comment.created_at.isoformat(),
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
            "edited_at": comment.edited_at.isoformat() if comment.edited_at else None,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "profile_image_url": profile_image_url  # ← Full URL now!
            },
            "is_reply": comment.parent_comment_id is not None,
            "reply_count": reply_count
        }

    async def get_comment_reply_count(self, comment_id: str) -> int:
        """
        Get the number of replies for a comment.

        Args:
            comment_id: ID of the comment

        Returns:
            int: Number of replies
        """
        from sqlalchemy import func

        reply_count_query = select(func.count(Comment.id)).where(
            Comment.parent_comment_id == comment_id
        )
        result = await self.db.execute(reply_count_query)
        return result.scalar() or 0

    async def _bulk_delete_comments_by_condition(self, condition, commit: bool = False) -> int:
        """
        Delete comments using a set-based SQL DELETE condition.

        Args:
            condition: SQLAlchemy condition expression for filtering comments to delete
            commit: Whether to commit after deletion

        Returns:
            int: Number of rows deleted
        """
        result = await self.db.execute(delete(Comment).where(condition))
        deleted_count = result.rowcount or 0
        if commit:
            await self.db.commit()
        return deleted_count

    async def delete_comments_for_post(self, post_id: str, commit: bool = False) -> int:
        """
        Delete all comments (top-level + replies) for a post in one set-based query.

        Args:
            post_id: ID of the post whose comments should be deleted
            commit: Whether to commit after deletion

        Returns:
            int: Number of deleted comments
        """
        return await self._bulk_delete_comments_by_condition(Comment.post_id == post_id, commit=commit)

    async def delete_comment(self, comment_id: str, user_id: int) -> bool:
        """
        Delete a comment (owner only).

        Deletion rules:
        - Top-level comments: Deleting parent deletes all direct replies
        - Replies: Cannot be deleted if there are sibling replies created after this one
          (only the chronologically last reply in a thread can be deleted)

        Args:
            comment_id: ID of the comment to delete
            user_id: ID of the user attempting to delete

        Returns:
            bool: True if deleted successfully

        Raises:
            NotFoundError: If comment doesn't exist
            PermissionDeniedError: If user is not the comment owner
            BusinessLogicError: If deletion is blocked due to replies or later siblings
        """
        comment = await self.get_by_id_or_404(Comment, comment_id, "Comment")

        # Verify ownership
        if comment.user_id != user_id:
            raise PermissionDeniedError(
                "Cannot delete other user's comment",
                "Comment",
                "delete"
            )

        from sqlalchemy import func

        # Check deletion constraints based on comment type
        if comment.parent_comment_id is None:
            # Top-level comment: delete parent and direct replies in one operation.
            delete_condition = or_(
                Comment.id == comment_id,
                Comment.parent_comment_id == comment_id
            )
        else:
            # Reply: Check for later sibling replies (same parent, created after this one)
            later_siblings_query = select(func.count(Comment.id)).where(
                Comment.parent_comment_id == comment.parent_comment_id,
                Comment.created_at > comment.created_at
            )
            result = await self.db.execute(later_siblings_query)
            later_siblings_count = result.scalar() or 0

            if later_siblings_count > 0:
                raise BusinessLogicError(
                    "This reply has later replies in the thread and cannot be deleted.",
                    "reply_has_later_siblings"
                )
            delete_condition = Comment.id == comment_id

        deleted_count = await self._bulk_delete_comments_by_condition(delete_condition, commit=False)

        # Get the post to update comments_count
        post = await self.get_by_id(Post, comment.post_id)
        if post:
            post.comments_count = max(0, (post.comments_count or 0) - deleted_count)

        await self.db.commit()
        if post:
            await self.db.refresh(post)

        logger.info(f"Deleted comment {comment_id} by user {user_id} (removed {deleted_count} rows)")
        return True

    async def get_comment_count(self, post_id: str) -> int:
        """
        Get total comment count for a post (including replies).
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Total number of comments and replies
        """
        from sqlalchemy import func
        
        query = select(func.count(Comment.id)).where(Comment.post_id == post_id)
        result = await self.db.execute(query)
        count = result.scalar() or 0
        
        return count
