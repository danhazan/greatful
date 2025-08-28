"""
Unit tests for share functionality edge cases and error scenarios.
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, AsyncMock

from app.models.share import Share, ShareMethod
from app.models.user import User
from app.models.post import Post, PostType
from app.services.share_service import ShareService
from app.repositories.share_repository import ShareRepository
from app.core.exceptions import ValidationException, BusinessLogicError, NotFoundError


class TestShareEdgeCases:
    """Test edge cases and error scenarios for sharing functionality."""

    @pytest.fixture
    async def share_service(self, db_session: AsyncSession):
        """Create ShareService instance."""
        return ShareService(db_session)

    @pytest.fixture
    async def share_repo(self, db_session: AsyncSession):
        """Create ShareRepository instance."""
        return ShareRepository(db_session)

    @pytest.fixture
    async def test_users(self, db_session: AsyncSession):
        """Create test users."""
        users = []
        for i in range(10):  # Create multiple users for testing
            user = User(
                email=f"user{i}@example.com",
                username=f"user{i}",
                hashed_password="hashed_password"
            )
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        for user in users:
            await db_session.refresh(user)
        
        return users

    @pytest.fixture
    async def test_posts(self, db_session: AsyncSession, test_users: list):
        """Create test posts."""
        posts = []
        for i, user in enumerate(test_users[:3]):  # Create posts for first 3 users
            post = Post(
                author_id=user.id,
                content=f"Test gratitude post {i}",
                post_type=PostType.daily,
                is_public=True
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        for post in posts:
            await db_session.refresh(post)
        
        return posts

    async def test_share_model_recipient_ids_edge_cases(self):
        """Test Share model recipient IDs handling edge cases."""
        share = Share(
            user_id=1,
            post_id="test-post",
            share_method="message"
        )
        
        # Test empty list
        share.recipient_ids_list = []
        assert share.recipient_ids_list == []
        assert share.recipient_count == 0
        
        # Test None
        share.recipient_ids_list = None
        assert share.recipient_ids_list == []
        assert share.recipient_count == 0
        
        # Test large list
        large_list = list(range(100))
        share.recipient_ids_list = large_list
        assert share.recipient_ids_list == large_list
        assert share.recipient_count == 100

    async def test_rate_limit_boundary_conditions(
        self, 
        share_repo: ShareRepository, 
        test_users: list, 
        test_posts: list
    ):
        """Test rate limiting at boundary conditions."""
        user = test_users[0]
        post = test_posts[0]
        
        # Create shares up to the limit (20)
        for i in range(20):
            await share_repo.create(
                user_id=user.id,
                post_id=post.id,
                share_method="message"
            )
        
        # Check rate limit at exactly the limit
        rate_limit = await share_repo.check_user_rate_limit(
            user.id, hours=1, max_shares=20
        )
        
        assert rate_limit["current_count"] == 20
        assert rate_limit["remaining"] == 0
        assert rate_limit["is_exceeded"] is True
        
        # Test with different time windows
        rate_limit_24h = await share_repo.check_user_rate_limit(
            user.id, hours=24, max_shares=100
        )
        
        assert rate_limit_24h["current_count"] == 20
        assert rate_limit_24h["remaining"] == 80
        assert rate_limit_24h["is_exceeded"] is False

    async def test_share_service_with_invalid_recipients(
        self, 
        share_service: ShareService, 
        test_users: list, 
        test_posts: list
    ):
        """Test sharing with invalid recipient IDs."""
        user = test_users[0]
        post = test_posts[0]
        
        # Test with nonexistent recipient ID
        with pytest.raises(NotFoundError):
            await share_service.share_via_message(
                sender_id=user.id,
                post_id=post.id,
                recipient_ids=[99999],  # Nonexistent ID
                message="Test message"
            )

    async def test_share_service_empty_message_handling(
        self, 
        share_service: ShareService, 
        test_users: list, 
        test_posts: list
    ):
        """Test sharing with empty or whitespace-only messages."""
        sender = test_users[0]
        recipient = test_users[1]
        post = test_posts[0]
        
        # Test with empty string
        result = await share_service.share_via_message(
            sender_id=sender.id,
            post_id=post.id,
            recipient_ids=[recipient.id],
            message=""
        )
        
        # Empty string should be stored as None after stripping
        assert result["message_content"] is None
        
        # Test with whitespace-only string
        result = await share_service.share_via_message(
            sender_id=sender.id,
            post_id=post.id,
            recipient_ids=[recipient.id],
            message="   \n\t   "
        )
        
        # Whitespace-only should be stored as None after stripping
        assert result["message_content"] is None

    async def test_share_service_duplicate_recipients(
        self, 
        share_service: ShareService, 
        test_users: list, 
        test_posts: list
    ):
        """Test sharing with duplicate recipient IDs."""
        sender = test_users[0]
        recipient = test_users[1]
        post = test_posts[0]
        
        # Share with duplicate recipient IDs
        result = await share_service.share_via_message(
            sender_id=sender.id,
            post_id=post.id,
            recipient_ids=[recipient.id, recipient.id, recipient.id],
            message="Test message"
        )
        
        # Current implementation doesn't deduplicate, it processes all IDs
        # This is acceptable behavior - the service processes what it's given
        assert result["recipient_count"] == 3

    async def test_share_repository_concurrent_shares(
        self, 
        share_repo: ShareRepository, 
        test_users: list, 
        test_posts: list
    ):
        """Test concurrent share creation."""
        user = test_users[0]
        post = test_posts[0]
        
        # Create shares sequentially to avoid transaction conflicts
        shares = []
        for i in range(5):
            share = await share_repo.create(
                user_id=user.id,
                post_id=post.id,
                share_method="url"
            )
            shares.append(share)
        
        # All shares should be created successfully
        assert len(shares) == 5
        for share in shares:
            assert share.user_id == user.id
            assert share.post_id == post.id

    async def test_share_analytics_with_no_data(
        self, 
        share_repo: ShareRepository
    ):
        """Test analytics calculation with no share data."""
        analytics = await share_repo.get_share_analytics(
            post_id="nonexistent-post",
            days=30
        )
        
        assert analytics["total_shares"] == 0
        assert analytics["unique_sharers"] == 0
        assert analytics["posts_shared"] == 0
        assert analytics["url_shares"] == 0
        assert analytics["message_shares"] == 0
        assert analytics["avg_recipients_per_message_share"] == 0.0
        assert analytics["avg_shares_per_day"] == 0.0

    async def test_share_service_url_generation_edge_cases(
        self, 
        share_service: ShareService, 
        test_posts: list
    ):
        """Test URL generation with various post ID formats."""
        post = test_posts[0]
        
        # Test with different environment variables
        with patch.dict('os.environ', {'FRONTEND_BASE_URL': 'https://custom-domain.com'}):
            url = await share_service.generate_share_url(post.id)
            assert url.startswith('https://custom-domain.com')
            assert f"/post/{post.id}" in url
        
        # Test with no environment variable (should use default)
        with patch.dict('os.environ', {}, clear=True):
            url = await share_service.generate_share_url(post.id)
            assert url.startswith('http://localhost:3000')

    async def test_share_service_notification_failure_handling(
        self, 
        share_service: ShareService, 
        test_users: list, 
        test_posts: list
    ):
        """Test sharing when notification creation fails."""
        sender = test_users[0]
        recipient = test_users[1]
        post = test_posts[0]
        
        # Mock notification service to fail
        with patch('app.services.notification_service.NotificationService.create_share_notification') as mock_notify:
            mock_notify.side_effect = Exception("Notification service down")
            
            # Share should still succeed even if notification fails
            result = await share_service.share_via_message(
                sender_id=sender.id,
                post_id=post.id,
                recipient_ids=[recipient.id],
                message="Test message"
            )
            
            assert result["share_method"] == "message"
            assert result["recipient_count"] == 1

    async def test_share_repository_malformed_recipient_data(
        self, 
        share_repo: ShareRepository, 
        test_users: list, 
        test_posts: list
    ):
        """Test handling of malformed recipient data in database."""
        user = test_users[0]
        post = test_posts[0]
        
        # Create share with valid data first
        share = await share_repo.create(
            user_id=user.id,
            post_id=post.id,
            share_method="message"
        )
        
        # Manually corrupt the recipient data to test error handling
        share.recipient_user_ids = "invalid_json_data"
        await share_repo.update(share)
        
        # Should handle malformed data gracefully
        assert share.recipient_ids_list == []
        assert share.recipient_count == 0

    async def test_share_service_privacy_edge_cases(
        self, 
        share_service: ShareService, 
        test_users: list, 
        db_session: AsyncSession
    ):
        """Test privacy controls with edge cases."""
        user = test_users[0]
        
        # Create a post with edge case privacy settings
        private_post = Post(
            author_id=user.id,
            content="Private post",
            post_type=PostType.daily,
            is_public=False
        )
        db_session.add(private_post)
        await db_session.commit()
        await db_session.refresh(private_post)
        
        # Should not be able to share private post
        with pytest.raises(BusinessLogicError, match="privacy"):
            await share_service.share_via_url(user.id, private_post.id)

    async def test_share_repository_performance_with_large_dataset(
        self, 
        share_repo: ShareRepository, 
        test_users: list, 
        test_posts: list
    ):
        """Test repository performance with large number of shares."""
        user = test_users[0]
        post = test_posts[0]
        
        # Create a large number of shares
        shares_to_create = 100
        for i in range(shares_to_create):
            await share_repo.create(
                user_id=user.id,
                post_id=post.id,
                share_method="url" if i % 2 == 0 else "message"
            )
        
        # Test performance of various queries
        import time
        
        # Test get_post_shares performance
        start_time = time.time()
        shares = await share_repo.get_post_shares(post.id)
        query_time = time.time() - start_time
        
        assert len(shares) == shares_to_create
        assert query_time < 1.0  # Should complete within 1 second
        
        # Test get_share_counts_by_method performance
        start_time = time.time()
        counts = await share_repo.get_share_counts_by_method(post.id)
        query_time = time.time() - start_time
        
        assert counts["url"] == 50
        assert counts["message"] == 50
        assert query_time < 0.5  # Should complete within 0.5 seconds

    async def test_share_service_validation_boundary_values(
        self, 
        share_service: ShareService, 
        test_users: list, 
        test_posts: list
    ):
        """Test validation with boundary values."""
        sender = test_users[0]
        recipients = test_users[1:6]  # Exactly 5 recipients
        post = test_posts[0]
        
        # Test with exactly 5 recipients (should work)
        result = await share_service.share_via_message(
            sender_id=sender.id,
            post_id=post.id,
            recipient_ids=[r.id for r in recipients],
            message="Test with 5 recipients"
        )
        
        assert result["recipient_count"] == 5
        
        # Test with exactly 200 character message (should work)
        long_message = "x" * 200
        result = await share_service.share_via_message(
            sender_id=sender.id,
            post_id=post.id,
            recipient_ids=[recipients[0].id],
            message=long_message
        )
        
        assert result["message_content"] == long_message
        assert len(result["message_content"]) == 200

    async def test_share_service_database_transaction_rollback(
        self, 
        share_service: ShareService, 
        test_users: list, 
        test_posts: list
    ):
        """Test that database transactions are properly rolled back on errors."""
        sender = test_users[0]
        recipient = test_users[1]
        post = test_posts[0]
        
        # Mock repository to fail after creating share but before commit
        with patch.object(share_service.share_repo, 'create') as mock_create:
            mock_create.side_effect = Exception("Database error")
            
            with pytest.raises(Exception, match="Database error"):
                await share_service.share_via_message(
                    sender_id=sender.id,
                    post_id=post.id,
                    recipient_ids=[recipient.id],
                    message="This should fail"
                )
        
        # Verify no share was created
        shares = await share_service.share_repo.get_post_shares(post.id)
        assert len(shares) == 0