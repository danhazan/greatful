"""
Integration test for HTML stripping in mention notifications.
"""

import pytest
import json
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post
from app.services.mention_service import MentionService
from app.repositories.user_repository import UserRepository
from app.repositories.post_repository import PostRepository
from app.repositories.mention_repository import MentionRepository
from app.repositories.notification_repository import NotificationRepository


class TestMentionNotificationHtmlStripping:
    """Test that mention notifications properly strip HTML content."""

    @pytest.mark.asyncio
    async def test_mention_notification_strips_html_content(self, db_session: AsyncSession):
        """Test that HTML content is stripped from mention notifications."""
        # Create test users
        author = User(
            email="author@example.com",
            username="author_user",
            hashed_password="hashed_password"
        )
        mentioned_user = User(
            email="mentioned@example.com", 
            username="mentioned_user",
            hashed_password="hashed_password"
        )
        
        db_session.add(author)
        db_session.add(mentioned_user)
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(mentioned_user)

        # Create a post with HTML content including mentions
        html_content = 'Thanks <span class="mention" data-username="mentioned_user">@mentioned_user</span> for the <strong>amazing</strong> work on the <em>project</em>!'
        
        post = Post(
            id="test-post-123",
            author_id=author.id,
            content="Thanks @mentioned_user for the amazing work on the project!",  # Plain text version
            rich_content=html_content,  # HTML version
            post_type="daily"
        )
        
        db_session.add(post)
        await db_session.commit()

        # Process mentions using the service
        mention_service = MentionService(db_session)
        await mention_service.create_mentions(
            post_id=post.id,
            content=html_content,  # This contains HTML
            author_id=author.id
        )

        # Check that notification was created with stripped HTML
        notification_repo = NotificationRepository(db_session)
        notifications = await notification_repo.get_user_notifications(mentioned_user.id)
        
        assert len(notifications) == 1
        notification = notifications[0]
        
        # Verify notification content
        assert notification.type == "mention"
        assert notification.title == "You were mentioned"
        
        # The message should be clean without post content
        assert "author_user mentioned you in a post" in notification.message
        assert "<span" not in notification.message  # No HTML tags
        assert "<strong>" not in notification.message  # No HTML tags
        assert "<em>" not in notification.message  # No HTML tags
        # Should not contain post content anymore
        assert "Thanks" not in notification.message
        assert ":" not in notification.message.split("post")[1]  # No colon after "post"
        
        # Verify notification data no longer contains post_preview
        notification_data = notification.data  # Already a dict
        assert "post_preview" not in notification_data  # Post content removed from notifications

    @pytest.mark.asyncio
    async def test_mention_notification_handles_html_entities(self, db_session: AsyncSession):
        """Test that HTML entities are properly decoded in notifications."""
        # Create test users
        author = User(
            email="author2@example.com",
            username="author2",
            hashed_password="hashed_password"
        )
        mentioned_user = User(
            email="mentioned2@example.com",
            username="mentioned2", 
            hashed_password="hashed_password"
        )
        
        db_session.add(author)
        db_session.add(mentioned_user)
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(mentioned_user)

        # Create content with HTML entities
        html_content = '<span class="mention" data-username="mentioned2">@mentioned2</span> check this &lt;code&gt; example &amp; &quot;quotes&quot;'
        
        post = Post(
            id="test-post-456",
            author_id=author.id,
            content="@mentioned2 check this <code> example & \"quotes\"",
            rich_content=html_content,
            post_type="daily"
        )
        
        db_session.add(post)
        await db_session.commit()

        # Process mentions
        mention_service = MentionService(db_session)
        await mention_service.create_mentions(
            post_id=post.id,
            content=html_content,
            author_id=author.id
        )

        # Check notification content
        notification_repo = NotificationRepository(db_session)
        notifications = await notification_repo.get_user_notifications(mentioned_user.id)
        
        assert len(notifications) == 1
        notification = notifications[0]
        
        # Verify notification message is clean without post content
        assert "author2 mentioned you in a post" in notification.message
        # Should not contain HTML entities since post content is no longer included
        assert "&lt;" not in notification.message
        assert "&gt;" not in notification.message
        assert "&amp;" not in notification.message
        assert "&quot;" not in notification.message
        # Should not contain post content
        assert "check this" not in notification.message
        assert "<code>" not in notification.message