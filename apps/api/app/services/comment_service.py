"""
CommentService for handling comment business logic.
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException, PermissionDeniedError
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
            Dict: Comment data with user information
            
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
        
        # Return comment data with user information
        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "user_id": comment.user_id,
            "parent_comment_id": comment.parent_comment_id,
            "content": comment.content,
            "created_at": comment.created_at.isoformat(),
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "profile_image_url": user.profile_image_url
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
            List[Dict]: List of comment dictionaries with user data
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
            comment_dict = {
                "id": comment.id,
                "post_id": comment.post_id,
                "user_id": comment.user_id,
                "parent_comment_id": comment.parent_comment_id,
                "content": comment.content,
                "created_at": comment.created_at.isoformat(),
                "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
                "user": {
                    "id": comment.user.id,
                    "username": comment.user.username,
                    "display_name": comment.user.display_name,
                    "profile_image_url": comment.user.profile_image_url
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
            List[Dict]: List of reply dictionaries with user data
        """
        query = select(Comment).where(
            Comment.parent_comment_id == comment_id
        ).options(
            selectinload(Comment.user)
        ).order_by(Comment.created_at.asc())
        
        result = await self.db.execute(query)
        replies = result.scalars().all()
        
        return [
            {
                "id": reply.id,
                "post_id": reply.post_id,
                "user_id": reply.user_id,
                "parent_comment_id": reply.parent_comment_id,
                "content": reply.content,
                "created_at": reply.created_at.isoformat(),
                "updated_at": reply.updated_at.isoformat() if reply.updated_at else None,
                "user": {
                    "id": reply.user.id,
                    "username": reply.user.username,
                    "display_name": reply.user.display_name,
                    "profile_image_url": reply.user.profile_image_url
                }
            }
            for reply in replies
        ]

    async def delete_comment(self, comment_id: str, user_id: int) -> bool:
        """
        Delete a comment (owner only).
        
        Args:
            comment_id: ID of the comment to delete
            user_id: ID of the user attempting to delete
            
        Returns:
            bool: True if deleted successfully
            
        Raises:
            NotFoundError: If comment doesn't exist
            PermissionDeniedError: If user is not the comment owner
        """
        comment = await self.get_by_id_or_404(Comment, comment_id, "Comment")
        
        # Verify ownership
        if comment.user_id != user_id:
            raise PermissionDeniedError(
                "Cannot delete other user's comment",
                "Comment",
                "delete"
            )
        
        # Count replies to decrement properly
        from sqlalchemy import func
        reply_count_query = select(func.count(Comment.id)).where(
            Comment.parent_comment_id == comment_id
        )
        result = await self.db.execute(reply_count_query)
        reply_count = result.scalar() or 0
        
        # Get the post to update comments_count
        post = await self.get_by_id(Post, comment.post_id)
        if post:
            # Decrement by 1 (the comment) + reply_count
            post.comments_count = max(0, (post.comments_count or 0) - (1 + reply_count))
            await self.db.commit()
            await self.db.refresh(post)
        
        # Delete the comment (cascade will handle replies)
        await self.delete_entity(comment)
        
        logger.info(f"Deleted comment {comment_id} by user {user_id}")
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
