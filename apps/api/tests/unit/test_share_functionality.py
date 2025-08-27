"""
Tests for Share model and ShareService functionality.
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.share import Share, ShareMethod
from app.models.user import User
from app.models.post import Post, PostType
from app.services.share_service import ShareService
from app.repositories.share_repository import ShareRepository
from app.core.exceptions import ValidationException, BusinessLogicError, NotFoundError


class TestShareModel:
    """Test Share model functionality."""

    def test_share_model_creation(self):
        """Test Share model can be created with valid data."""
        share = Share(
            user_id=1,
            post_id="test-post-id",
            share_method=ShareMethod.url.value
        )
        
        assert share.user_id == 1
        assert share.post_id == "test-post-id"
        assert share.share_method == "url"
        assert share.is_url_share is True
        assert share.is_message_share is False
        assert share.recipient_count == 0

    def test_share_model_with_message_data(self):
        """Test Share model with message sharing data."""
        share = Share(
            user_id=1,
            post_id="test-post-id",
            share_method=ShareMethod.message.value,
            message_content="Check out this amazing post!"
        )
        
        # Set recipient IDs using the property
        share.recipient_ids_list = [2, 3, 4]
        
        assert share.share_method == "message"
        assert share.is_message_share is True
        assert share.is_url_share is False
        assert share.recipient_count == 3
        assert share.recipient_ids_list == [2, 3, 4]
        assert share.message_content == "Check out this amazing post!"

    def test_share_method_validation(self):
        """Test share method validation."""
        assert Share.is_valid_share_method("url") is True
        assert Share.is_valid_share_method("message") is True
        assert Share.is_valid_share_method("invalid") is False
        assert Share.is_valid_share_method("") is False


class TestShareRepository:
    """Test ShareRepository functionality."""

    @pytest.fixture
    async def share_repo(self, db_session: AsyncSession):
        """Create ShareRepository instance."""
        return ShareRepository(db_session)

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession):
        """Create a test user."""
        user = User(
            email="testuser@example.com",
            username="testuser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def test_post(self, db_session: AsyncSession, test_user: User):
        """Create a test post."""
        post = Post(
            author_id=test_user.id,
            content="Test gratitude post",
            post_type=PostType.daily
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        return post

    async def test_create_url_share(
        self, 
        share_repo: ShareRepository, 
        test_user: User, 
        test_post: Post
    ):
        """Test creating a URL share."""
        share = await share_repo.create(
            user_id=test_user.id,
            post_id=test_post.id,
            share_method="url"
        )
        
        assert share.user_id == test_user.id
        assert share.post_id == test_post.id
        assert share.share_method == "url"
        assert share.is_url_share is True

    async def test_create_message_share(
        self, 
        share_repo: ShareRepository, 
        test_user: User, 
        test_post: Post
    ):
        """Test creating a message share."""
        share = await share_repo.create(
            user_id=test_user.id,
            post_id=test_post.id,
            share_method="message",
            message_content="Great post!"
        )
        
        # Set recipient IDs using the property
        share.recipient_ids_list = [2, 3]
        await share_repo.update(share)
        
        assert share.share_method == "message"
        assert share.recipient_ids_list == [2, 3]
        assert share.message_content == "Great post!"
        assert share.recipient_count == 2

    async def test_get_post_shares(
        self, 
        share_repo: ShareRepository, 
        test_user: User, 
        test_post: Post
    ):
        """Test getting shares for a post."""
        # Create multiple shares
        await share_repo.create(
            user_id=test_user.id,
            post_id=test_post.id,
            share_method="url"
        )
        message_share = await share_repo.create(
            user_id=test_user.id,
            post_id=test_post.id,
            share_method="message"
        )
        message_share.recipient_ids_list = [2]
        await share_repo.update(message_share)
        
        shares = await share_repo.get_post_shares(test_post.id)
        assert len(shares) == 2

    async def test_get_share_counts(
        self, 
        share_repo: ShareRepository, 
        test_user: User, 
        test_post: Post
    ):
        """Test getting share counts by method."""
        # Create shares of different methods
        await share_repo.create(
            user_id=test_user.id,
            post_id=test_post.id,
            share_method="url"
        )
        await share_repo.create(
            user_id=test_user.id,
            post_id=test_post.id,
            share_method="url"
        )
        message_share = await share_repo.create(
            user_id=test_user.id,
            post_id=test_post.id,
            share_method="message"
        )
        message_share.recipient_ids_list = [2]
        await share_repo.update(message_share)
        
        counts = await share_repo.get_share_counts_by_method(test_post.id)
        total = await share_repo.get_total_share_count(test_post.id)
        
        assert counts["url"] == 2
        assert counts["message"] == 1
        assert total == 3

    async def test_rate_limit_check(
        self, 
        share_repo: ShareRepository, 
        test_user: User, 
        test_post: Post
    ):
        """Test rate limit checking."""
        # Create some shares
        for _ in range(3):
            await share_repo.create(
                user_id=test_user.id,
                post_id=test_post.id,
                share_method="url"
            )
        
        rate_limit = await share_repo.check_user_rate_limit(
            test_user.id, hours=1, max_shares=20
        )
        
        assert rate_limit["current_count"] == 3
        assert rate_limit["max_allowed"] == 20
        assert rate_limit["remaining"] == 17
        assert rate_limit["is_exceeded"] is False


class TestShareService:
    """Test ShareService functionality."""

    @pytest.fixture
    async def share_service(self, db_session: AsyncSession):
        """Create ShareService instance."""
        return ShareService(db_session)

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession):
        """Create a test user."""
        user = User(
            email="testuser@example.com",
            username="testuser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def test_recipient(self, db_session: AsyncSession):
        """Create a test recipient user."""
        user = User(
            email="recipient@example.com",
            username="recipient",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def test_post(self, db_session: AsyncSession, test_user: User):
        """Create a test post."""
        post = Post(
            author_id=test_user.id,
            content="Test gratitude post for sharing",
            post_type=PostType.daily,
            is_public=True
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        return post

    async def test_generate_share_url(
        self, 
        share_service: ShareService, 
        test_post: Post
    ):
        """Test generating share URL."""
        url = await share_service.generate_share_url(test_post.id)
        
        assert f"/post/{test_post.id}" in url
        assert url.startswith("http")

    async def test_generate_share_url_nonexistent_post(
        self, 
        share_service: ShareService
    ):
        """Test generating share URL for nonexistent post."""
        with pytest.raises(NotFoundError):
            await share_service.generate_share_url("nonexistent-post-id")

    async def test_share_via_url(
        self, 
        share_service: ShareService, 
        test_user: User, 
        test_post: Post
    ):
        """Test sharing via URL."""
        result = await share_service.share_via_url(test_user.id, test_post.id)
        
        assert result["user_id"] == test_user.id
        assert result["post_id"] == test_post.id
        assert result["share_method"] == "url"
        assert "share_url" in result
        assert f"/post/{test_post.id}" in result["share_url"]

    async def test_share_via_message(
        self, 
        share_service: ShareService, 
        test_user: User, 
        test_recipient: User, 
        test_post: Post
    ):
        """Test sharing via message."""
        result = await share_service.share_via_message(
            sender_id=test_user.id,
            post_id=test_post.id,
            recipient_ids=[test_recipient.id],
            message="Check this out!"
        )
        
        assert result["user_id"] == test_user.id
        assert result["post_id"] == test_post.id
        assert result["share_method"] == "message"
        assert result["recipient_count"] == 1
        assert result["message_content"] == "Check this out!"

    async def test_share_via_message_validation_errors(
        self, 
        share_service: ShareService, 
        test_user: User, 
        test_post: Post
    ):
        """Test message sharing validation errors."""
        # No recipients
        with pytest.raises(ValidationException, match="At least one recipient is required"):
            await share_service.share_via_message(
                sender_id=test_user.id,
                post_id=test_post.id,
                recipient_ids=[],
                message="Test"
            )
        
        # Too many recipients
        with pytest.raises(ValidationException, match="Maximum 5 recipients allowed"):
            await share_service.share_via_message(
                sender_id=test_user.id,
                post_id=test_post.id,
                recipient_ids=[1, 2, 3, 4, 5, 6],
                message="Test"
            )
        
        # Message too long
        with pytest.raises(ValidationException, match="Message cannot exceed 200 characters"):
            await share_service.share_via_message(
                sender_id=test_user.id,
                post_id=test_post.id,
                recipient_ids=[1],
                message="x" * 201
            )

    async def test_rate_limit_enforcement(
        self, 
        share_service: ShareService, 
        test_user: User, 
        test_post: Post,
        monkeypatch
    ):
        """Test rate limit enforcement."""
        # Mock rate limit check to return exceeded
        async def mock_check_rate_limit(user_id):
            return {
                "current_count": 20,
                "max_allowed": 20,
                "remaining": 0,
                "is_exceeded": True,
                "reset_time": datetime.utcnow() + timedelta(hours=1)
            }
        
        monkeypatch.setattr(share_service, "check_rate_limit", mock_check_rate_limit)
        
        with pytest.raises(BusinessLogicError, match="Share rate limit exceeded"):
            await share_service.share_via_url(test_user.id, test_post.id)

    async def test_get_share_counts(
        self, 
        share_service: ShareService, 
        test_user: User, 
        test_post: Post
    ):
        """Test getting share counts."""
        # Create some shares
        await share_service.share_via_url(test_user.id, test_post.id)
        
        counts = await share_service.get_share_counts(test_post.id)
        
        assert counts["total"] == 1
        assert counts["url_shares"] == 1
        assert counts["message_shares"] == 0

    async def test_check_rate_limit(
        self, 
        share_service: ShareService, 
        test_user: User
    ):
        """Test rate limit checking."""
        rate_limit = await share_service.check_rate_limit(test_user.id)
        
        assert "current_count" in rate_limit
        assert "max_allowed" in rate_limit
        assert "remaining" in rate_limit
        assert "is_exceeded" in rate_limit
        assert rate_limit["max_allowed"] == 20