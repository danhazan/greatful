"""
Tests for notification integration with reactions.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.reaction_service import ReactionService
from app.services.notification_service import NotificationService
from app.models.user import User
from app.models.post import Post
from app.models.notification import Notification


class TestNotificationIntegration:
    """Test notification creation when reactions are added."""

    @pytest.mark.asyncio
    async def test_reaction_creates_notification(self, db_session: AsyncSession):
        """Test that adding a reaction creates a notification for the post author."""
        # Create two users - one post author, one reactor
        author = User(
            email="author@example.com",
            username="author",
            hashed_password="hashed_password"
        )
        reactor = User(
            email="reactor@example.com", 
            username="reactor",
            hashed_password="hashed_password"
        )
        
        db_session.add(author)
        db_session.add(reactor)
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(reactor)

        # Create a post by the author
        post = Post(
            id="test-post-1",
            author_id=author.id,
            content="Test gratitude post",
            post_type="daily"
        )
        db_session.add(post)
        await db_session.commit()

        # Add a reaction from the reactor
        reaction_service = ReactionService(db_session)
        reaction_data = await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        assert reaction_data is not None
        assert reaction_data["emoji_code"] == "heart_eyes"

        # Check that a notification was created for the author
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        notification = notifications[0]
        assert notification.type == "emoji_reaction"
        assert notification.user_id == author.id
        assert "reactor" in notification.message
        assert "😍" in notification.message
        assert notification.data["post_id"] == post.id
        assert notification.data["emoji_code"] == "heart_eyes"
        assert notification.data["reactor_username"] == "reactor"
        assert not notification.read

    @pytest.mark.asyncio
    async def test_self_reaction_no_notification(self, db_session: AsyncSession):
        """Test that reacting to your own post doesn't create a notification."""
        # Create a user
        user = User(
            email="user@example.com",
            username="user",
            hashed_password="hashed_password"
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create a post by the user
        post = Post(
            id="test-post-2",
            author_id=user.id,
            content="Test gratitude post",
            post_type="daily"
        )
        db_session.add(post)
        await db_session.commit()

        # Add a reaction from the same user (self-reaction)
        reaction_service = ReactionService(db_session)
        reaction_data = await reaction_service.add_reaction(
            user_id=user.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        assert reaction_data is not None
        assert reaction_data["emoji_code"] == "heart_eyes"

        # Check that no notification was created
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=user.id
        )

        assert len(notifications) == 0

    @pytest.mark.asyncio
    async def test_reaction_update_creates_notification(self, db_session: AsyncSession):
        """Test that updating a reaction creates a new notification."""
        # Create two users - one post author, one reactor
        author = User(
            email="author2@example.com",
            username="author2",
            hashed_password="hashed_password"
        )
        reactor = User(
            email="reactor2@example.com", 
            username="reactor2",
            hashed_password="hashed_password"
        )
        
        db_session.add(author)
        db_session.add(reactor)
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(reactor)

        # Create a post by the author
        post = Post(
            id="test-post-3",
            author_id=author.id,
            content="Test gratitude post",
            post_type="daily"
        )
        db_session.add(post)
        await db_session.commit()

        # Add initial reaction
        reaction_service = ReactionService(db_session)
        await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        # Update the reaction to a different emoji
        updated_reaction_data = await reaction_service.add_reaction(
            user_id=reactor.id,
            post_id=post.id,
            emoji_code="fire"
        )

        assert updated_reaction_data["emoji_code"] == "fire"

        # Check that notifications were created with new batching behavior
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        # With new batching system, reaction updates create separate notifications
        # This is expected behavior as each reaction change is a distinct event
        assert len(notifications) == 2
        
        # Check both notifications are for emoji reactions
        for notification in notifications:
            assert notification.type == "emoji_reaction"

    @pytest.mark.asyncio
    async def test_multiple_users_reactions_create_multiple_notifications(self, db_session: AsyncSession):
        """Test that reactions from multiple users create separate notifications."""
        # Create one author and two reactors
        author = User(
            email="author3@example.com",
            username="author3",
            hashed_password="hashed_password"
        )
        reactor1 = User(
            email="reactor3@example.com", 
            username="reactor3",
            hashed_password="hashed_password"
        )
        reactor2 = User(
            email="reactor4@example.com", 
            username="reactor4",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([author, reactor1, reactor2])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(reactor1)
        await db_session.refresh(reactor2)

        # Create a post by the author
        post = Post(
            id="test-post-4",
            author_id=author.id,
            content="Test gratitude post",
            post_type="daily"
        )
        db_session.add(post)
        await db_session.commit()

        # Add reactions from both reactors
        reaction_service = ReactionService(db_session)
        await reaction_service.add_reaction(
            user_id=reactor1.id,
            post_id=post.id,
            emoji_code="heart_eyes"
        )

        await reaction_service.add_reaction(
            user_id=reactor2.id,
            post_id=post.id,
            emoji_code="pray"
        )

        # Check that notifications were created with new batching behavior
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        # With new batching system, should have 1 batch notification with 2 children
        assert len(notifications) == 1
        
        # Check the batch notification
        batch_notification = notifications[0]
        assert batch_notification.type == "emoji_reaction"
        assert batch_notification.user_id == author.id
        assert not batch_notification.read
        assert batch_notification.is_batch == True
        assert batch_notification.batch_count == 2