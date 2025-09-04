"""
Integration tests for like and reaction notification batching.
Tests the complete flow from API endpoints to notification creation and batching.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.notification import Notification
from app.services.notification_service import NotificationService


class TestLikeReactionBatchingIntegration:
    """Integration tests for like and reaction notification batching."""

    @pytest.mark.asyncio
    async def test_like_then_reaction_creates_combined_batch(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that a like followed by a reaction creates a combined batch."""
        # Create test users
        author = User(username="author", email="author@test.com", hashed_password="hash")
        liker = User(username="liker", email="liker@test.com", hashed_password="hash")
        reactor = User(username="reactor", email="reactor@test.com", hashed_password="hash")
        
        db_session.add_all([author, liker, reactor])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(liker)
        await db_session.refresh(reactor)

        # Create a test post
        post = Post(
            id="test-post-123",
            author_id=author.id,
            content="Test gratitude post",
            post_type="daily"
        )
        db_session.add(post)
        await db_session.commit()

        # First, add a like
        like_response = await async_client.post(
            f"/api/v1/posts/{post.id}/heart",
            headers={"Authorization": f"Bearer {self._create_token(liker.id)}"}
        )
        assert like_response.status_code == 201

        # Then, add a reaction from a different user
        reaction_response = await async_client.post(
            f"/api/v1/posts/{post.id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers={"Authorization": f"Bearer {self._create_token(reactor.id)}"}
        )
        assert reaction_response.status_code == 201

        # Check notifications - should have 1 combined batch notification
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        batch_notification = notifications[0]
        
        # Verify it's a combined batch
        assert batch_notification.type == "post_interaction"
        assert batch_notification.is_batch == True
        assert batch_notification.batch_count == 2
        assert "💜" in batch_notification.title  # Purple heart styling
        assert "engaged with your post" in batch_notification.message

    @pytest.mark.asyncio
    async def test_reaction_then_like_creates_combined_batch(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that a reaction followed by a like creates a combined batch."""
        # Create test users
        author = User(username="author2", email="author2@test.com", hashed_password="hash")
        reactor = User(username="reactor2", email="reactor2@test.com", hashed_password="hash")
        liker = User(username="liker2", email="liker2@test.com", hashed_password="hash")
        
        db_session.add_all([author, reactor, liker])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(reactor)
        await db_session.refresh(liker)

        # Create a test post
        post = Post(
            id="test-post-456",
            author_id=author.id,
            content="Another test post",
            post_type="photo"
        )
        db_session.add(post)
        await db_session.commit()

        # First, add a reaction
        reaction_response = await async_client.post(
            f"/api/v1/posts/{post.id}/reactions",
            json={"emoji_code": "pray"},
            headers={"Authorization": f"Bearer {self._create_token(reactor.id)}"}
        )
        assert reaction_response.status_code == 201

        # Then, add a like from a different user
        like_response = await async_client.post(
            f"/api/v1/posts/{post.id}/heart",
            headers={"Authorization": f"Bearer {self._create_token(liker.id)}"}
        )
        assert like_response.status_code == 201

        # Check notifications - should have 1 combined batch notification
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        batch_notification = notifications[0]
        
        # Verify it's a combined batch
        assert batch_notification.type == "post_interaction"
        assert batch_notification.is_batch == True
        assert batch_notification.batch_count == 2
        assert "💜" in batch_notification.title  # Purple heart styling
        assert "engaged with your post" in batch_notification.message

    @pytest.mark.asyncio
    async def test_multiple_likes_and_reactions_batch_together(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that multiple likes and reactions all batch together."""
        # Create test users
        author = User(username="author3", email="author3@test.com", hashed_password="hash")
        user1 = User(username="user1", email="user1@test.com", hashed_password="hash")
        user2 = User(username="user2", email="user2@test.com", hashed_password="hash")
        user3 = User(username="user3", email="user3@test.com", hashed_password="hash")
        user4 = User(username="user4", email="user4@test.com", hashed_password="hash")
        
        db_session.add_all([author, user1, user2, user3, user4])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        await db_session.refresh(user3)
        await db_session.refresh(user4)

        # Create a test post
        post = Post(
            id="test-post-789",
            author_id=author.id,
            content="Popular test post",
            post_type="spontaneous"
        )
        db_session.add(post)
        await db_session.commit()

        # Add mix of likes and reactions
        # Like from user1
        await async_client.post(
            f"/api/v1/posts/{post.id}/heart",
            headers={"Authorization": f"Bearer {self._create_token(user1.id)}"}
        )

        # Reaction from user2
        await async_client.post(
            f"/api/v1/posts/{post.id}/reactions",
            json={"emoji_code": "fire"},
            headers={"Authorization": f"Bearer {self._create_token(user2.id)}"}
        )

        # Another like from user3
        await async_client.post(
            f"/api/v1/posts/{post.id}/heart",
            headers={"Authorization": f"Bearer {self._create_token(user3.id)}"}
        )

        # Another reaction from user4
        await async_client.post(
            f"/api/v1/posts/{post.id}/reactions",
            json={"emoji_code": "clap"},
            headers={"Authorization": f"Bearer {self._create_token(user4.id)}"}
        )

        # Check notifications - should have 1 combined batch notification
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        batch_notification = notifications[0]
        
        # Verify it's a combined batch with all 4 interactions
        assert batch_notification.type == "post_interaction"
        assert batch_notification.is_batch == True
        assert batch_notification.batch_count == 4
        assert "💜" in batch_notification.title  # Purple heart styling
        assert "4 people engaged with your post" in batch_notification.message

    @pytest.mark.asyncio
    async def test_like_notification_has_purple_heart_styling(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that like notifications include purple heart styling."""
        # Create test users
        author = User(username="author4", email="author4@test.com", hashed_password="hash")
        liker = User(username="liker4", email="liker4@test.com", hashed_password="hash")
        
        db_session.add_all([author, liker])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(liker)

        # Create a test post
        post = Post(
            id="test-post-purple",
            author_id=author.id,
            content="Test post for purple heart",
            post_type="daily"
        )
        db_session.add(post)
        await db_session.commit()

        # Add a like
        like_response = await async_client.post(
            f"/api/v1/posts/{post.id}/heart",
            headers={"Authorization": f"Bearer {self._create_token(liker.id)}"}
        )
        assert like_response.status_code == 201

        # Check notification has purple heart styling
        notifications = await NotificationService.get_user_notifications(
            db=db_session,
            user_id=author.id
        )

        assert len(notifications) == 1
        notification = notifications[0]
        
        # Verify purple heart styling
        assert "💜" in notification.title
        assert notification.type == "like"

    def _create_token(self, user_id: int) -> str:
        """Helper to create JWT token for testing."""
        from app.core.security import create_access_token
        return create_access_token(data={"sub": str(user_id)})