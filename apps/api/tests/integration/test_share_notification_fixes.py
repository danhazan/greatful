"""
Integration tests for share notification fixes.
Tests for:
1. Share notifications show correct sharer username, not 'Unknown User'
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post
from app.services.share_service import ShareService
from app.services.notification_service import NotificationService


class TestShareNotificationFixes:
    
    @pytest.mark.asyncio
    async def test_share_notification_shows_correct_sharer_username(
        self,
        db_session: AsyncSession
    ):
        """Test that share notifications show correct sharer username, not 'Unknown User'."""
        
        # Create test users
        sharer = User(
            username="share_sender",
            email="sharer@example.com",
            hashed_password="hashed_password"
        )
        recipient = User(
            username="share_recipient", 
            email="recipient@example.com",
            hashed_password="hashed_password"
        )
        post_author = User(
            username="post_author",
            email="author@example.com", 
            hashed_password="hashed_password"
        )
        
        db_session.add_all([sharer, recipient, post_author])
        await db_session.commit()
        await db_session.refresh(sharer)
        await db_session.refresh(recipient)
        await db_session.refresh(post_author)
        
        # Create a test post
        post = Post(
            id="test-post-123",
            content="Test post for sharing",
            author_id=post_author.id,
            post_type="spontaneous"
        )
        db_session.add(post)
        await db_session.commit()
        
        # Share the post via message
        share_service = ShareService(db_session)
        await share_service.share_via_message(
            sender_id=sharer.id,
            post_id=post.id,
            recipient_ids=[recipient.id]
        )
        
        # Verify notification was created with correct username
        from app.repositories.notification_repository import NotificationRepository
        notification_repo = NotificationRepository(db_session)
        notifications = await notification_repo.get_user_notifications(recipient.id, limit=10)
        
        assert len(notifications) == 1
        notification = notifications[0]
        
        # Verify notification shows correct sharer username (not "Unknown User")
        assert notification.type == "post_shared"
        assert notification.title == "Post Sent"
        assert "share_sender sent you a post" in notification.message
        assert "Unknown User" not in notification.message
        
        # Verify data field contains sharer_username
        assert notification.data is not None
        assert notification.data.get("sharer_username") == "share_sender"
        assert notification.data.get("share_method") == "message"
        assert notification.data.get("post_id") == post.id