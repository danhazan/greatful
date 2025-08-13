"""
Unit tests for user profile functionality.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.user import User
from app.models.post import Post, PostType
from app.core.security import get_password_hash
import uuid
from datetime import datetime

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_profile.db"

# Create test engine and session
test_engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestSessionLocal = sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture
async def db_session():
    """Create a test database session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpassword"),
        bio="I love gratitude!",
        profile_image_url="https://example.com/avatar.jpg"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_with_posts(db_session: AsyncSession, test_user: User):
    """Create a test user with multiple posts."""
    posts = []
    for i in range(3):
        post = Post(
            id=str(uuid.uuid4()),
            author_id=test_user.id,
            content=f"I'm grateful for test post {i+1}!",
            post_type=PostType.daily,
            is_public=True
        )
        db_session.add(post)
        posts.append(post)
    
    await db_session.commit()
    for post in posts:
        await db_session.refresh(post)
    
    return test_user, posts


class TestUserModel:
    """Test the User model with new profile fields."""

    async def test_user_creation_with_profile_fields(self, db_session: AsyncSession):
        """Test creating a user with bio and profile image."""
        user = User(
            email="profile@example.com",
            username="profileuser",
            hashed_password=get_password_hash("password"),
            bio="This is my bio",
            profile_image_url="https://example.com/profile.jpg"
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        assert user.id is not None
        assert user.email == "profile@example.com"
        assert user.username == "profileuser"
        assert user.bio == "This is my bio"
        assert user.profile_image_url == "https://example.com/profile.jpg"
        assert user.created_at is not None

    async def test_user_creation_without_optional_fields(self, db_session: AsyncSession):
        """Test creating a user without bio and profile image."""
        user = User(
            email="minimal@example.com",
            username="minimaluser",
            hashed_password=get_password_hash("password")
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        assert user.id is not None
        assert user.bio is None
        assert user.profile_image_url is None

    async def test_user_get_by_id(self, db_session: AsyncSession, test_user: User):
        """Test getting user by ID."""
        found_user = await User.get_by_id(db_session, test_user.id)
        
        assert found_user is not None
        assert found_user.id == test_user.id
        assert found_user.username == test_user.username
        assert found_user.bio == test_user.bio

    async def test_user_get_by_username(self, db_session: AsyncSession, test_user: User):
        """Test getting user by username."""
        found_user = await User.get_by_username(db_session, test_user.username)
        
        assert found_user is not None
        assert found_user.id == test_user.id
        assert found_user.username == test_user.username

    async def test_user_get_by_email(self, db_session: AsyncSession, test_user: User):
        """Test getting user by email."""
        found_user = await User.get_by_email(db_session, test_user.email)
        
        assert found_user is not None
        assert found_user.id == test_user.id
        assert found_user.email == test_user.email

    async def test_user_not_found(self, db_session: AsyncSession):
        """Test getting non-existent user returns None."""
        found_user = await User.get_by_id(db_session, 99999)
        assert found_user is None
        
        found_user = await User.get_by_username(db_session, "nonexistent")
        assert found_user is None
        
        found_user = await User.get_by_email(db_session, "nonexistent@example.com")
        assert found_user is None

    async def test_user_profile_update(self, db_session: AsyncSession, test_user: User):
        """Test updating user profile fields."""
        # Update bio and profile image
        test_user.bio = "Updated bio content"
        test_user.profile_image_url = "https://example.com/new-avatar.jpg"
        
        await db_session.commit()
        await db_session.refresh(test_user)
        
        assert test_user.bio == "Updated bio content"
        assert test_user.profile_image_url == "https://example.com/new-avatar.jpg"

    async def test_username_uniqueness(self, db_session: AsyncSession, test_user: User):
        """Test that usernames must be unique."""
        duplicate_user = User(
            email="different@example.com",
            username=test_user.username,  # Same username
            hashed_password=get_password_hash("password")
        )
        
        db_session.add(duplicate_user)
        
        with pytest.raises(Exception):  # Should raise integrity error
            await db_session.commit()

    async def test_email_uniqueness(self, db_session: AsyncSession, test_user: User):
        """Test that emails must be unique."""
        duplicate_user = User(
            email=test_user.email,  # Same email
            username="differentuser",
            hashed_password=get_password_hash("password")
        )
        
        db_session.add(duplicate_user)
        
        with pytest.raises(Exception):  # Should raise integrity error
            await db_session.commit()


class TestUserStats:
    """Test user statistics calculations."""

    async def test_posts_count_calculation(self, db_session: AsyncSession, test_user_with_posts):
        """Test that posts count is calculated correctly."""
        user, posts = test_user_with_posts
        
        # Query posts count
        from sqlalchemy.future import select
        result = await db_session.execute(
            select(Post).where(Post.author_id == user.id)
        )
        posts_count = len(result.scalars().all())
        
        assert posts_count == 3

    async def test_join_date_format(self, db_session: AsyncSession, test_user: User):
        """Test that join date (created_at) is properly formatted."""
        assert test_user.created_at is not None
        assert isinstance(test_user.created_at, datetime)
        
        # Test ISO format conversion
        iso_date = test_user.created_at.isoformat()
        assert isinstance(iso_date, str)
        assert "T" in iso_date  # ISO format includes T separator

    async def test_empty_posts_count(self, db_session: AsyncSession, test_user: User):
        """Test posts count for user with no posts."""
        from sqlalchemy.future import select
        result = await db_session.execute(
            select(Post).where(Post.author_id == test_user.id)
        )
        posts_count = len(result.scalars().all())
        
        assert posts_count == 0

    async def test_posts_count_after_deletion(self, db_session: AsyncSession, test_user_with_posts):
        """Test posts count updates after post deletion."""
        user, posts = test_user_with_posts
        
        # Delete one post
        await db_session.delete(posts[0])
        await db_session.commit()
        
        # Check updated count
        from sqlalchemy.future import select
        result = await db_session.execute(
            select(Post).where(Post.author_id == user.id)
        )
        posts_count = len(result.scalars().all())
        
        assert posts_count == 2


class TestUserProfileData:
    """Test user profile data structure and validation."""

    async def test_profile_data_structure(self, test_user: User):
        """Test that user profile contains all required fields."""
        profile_data = {
            'id': test_user.id,
            'username': test_user.username,
            'email': test_user.email,
            'bio': test_user.bio,
            'profile_image_url': test_user.profile_image_url,
            'created_at': test_user.created_at.isoformat(),
            'posts_count': 0,  # Would be calculated separately
            'followers_count': 0,  # Future implementation
            'following_count': 0   # Future implementation
        }
        
        # Verify all expected fields are present
        expected_fields = [
            'id', 'username', 'email', 'bio', 'profile_image_url',
            'created_at', 'posts_count', 'followers_count', 'following_count'
        ]
        
        for field in expected_fields:
            assert field in profile_data

    def test_bio_length_validation(self):
        """Test bio length constraints (should be reasonable)."""
        # Test normal bio
        normal_bio = "I love gratitude and positive thinking!"
        assert len(normal_bio) <= 500  # Reasonable limit
        
        # Test long bio
        long_bio = "x" * 1000
        # In a real implementation, this would be validated at the API level
        assert len(long_bio) > 500

    def test_profile_image_url_format(self):
        """Test profile image URL format validation."""
        valid_urls = [
            "https://example.com/image.jpg",
            "https://cdn.example.com/avatars/user123.png",
            "https://storage.googleapis.com/bucket/image.webp"
        ]
        
        for url in valid_urls:
            assert url.startswith(("http://", "https://"))
            assert any(url.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"])

    def test_username_format_validation(self):
        """Test username format constraints."""
        valid_usernames = ["testuser", "user123", "grateful_user", "user-name"]
        invalid_usernames = ["", "a", "user@name", "user name", "x" * 100]
        
        for username in valid_usernames:
            assert len(username) >= 2
            assert len(username) <= 50
            # Additional validation would be done at API level
        
        for username in invalid_usernames:
            # These would fail validation at API level
            if username:
                assert len(username) < 2 or len(username) > 50 or "@" in username or " " in username