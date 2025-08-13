"""
Integration tests for user profile API endpoints.
"""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.models.user import User
from app.models.post import Post, PostType
from app.core.security import create_access_token, get_password_hash
from main import app
import uuid

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_profile_api.db"

# Create test engine and session
test_engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestSessionLocal = sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    """Override database dependency for testing."""
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def setup_database():
    """Set up test database."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_user_data(setup_database):
    """Create test user with profile data."""
    async with TestSessionLocal() as session:
        user = User(
            email="profile@example.com",
            username="profileuser",
            hashed_password=get_password_hash("testpassword"),
            bio="I love gratitude and positive thinking!",
            profile_image_url="https://example.com/avatar.jpg"
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        # Create some posts for the user
        posts = []
        for i in range(2):
            post = Post(
                id=str(uuid.uuid4()),
                author_id=user.id,
                content=f"Grateful for test post {i+1}!",
                post_type=PostType.daily,
                is_public=True
            )
            session.add(post)
            posts.append(post)
        
        await session.commit()
        for post in posts:
            await session.refresh(post)
        
        token = create_access_token({"sub": str(user.id)})
        
        return {
            "user": user,
            "posts": posts,
            "token": token
        }


@pytest_asyncio.fixture
async def another_user_data(setup_database):
    """Create another test user for testing other user's profile."""
    async with TestSessionLocal() as session:
        user = User(
            email="other@example.com",
            username="otheruser",
            hashed_password=get_password_hash("testpassword"),
            bio="Another user's bio",
            profile_image_url="https://example.com/other-avatar.jpg"
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        return {"user": user}


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestGetMyProfile:
    """Test GET /api/v1/users/me/profile endpoint."""

    def test_get_my_profile_success(self, client: TestClient, test_user_data):
        """Test successfully getting current user's profile."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.get("/api/v1/users/me/profile", headers=headers)
        
        assert response.status_code == 200
        profile = response.json()
        
        # Check all required fields
        assert profile["id"] == data["user"].id
        assert profile["username"] == data["user"].username
        assert profile["email"] == data["user"].email
        assert profile["bio"] == data["user"].bio
        assert profile["profile_image_url"] == data["user"].profile_image_url
        assert "created_at" in profile
        assert profile["posts_count"] == 2  # We created 2 posts
        assert profile["followers_count"] == 0
        assert profile["following_count"] == 0

    def test_get_my_profile_unauthorized(self, client: TestClient):
        """Test getting profile without authentication."""
        response = client.get("/api/v1/users/me/profile")
        
        assert response.status_code == 403

    def test_get_my_profile_invalid_token(self, client: TestClient):
        """Test getting profile with invalid token."""
        headers = {"Authorization": "Bearer invalid-token"}
        
        response = client.get("/api/v1/users/me/profile", headers=headers)
        
        assert response.status_code == 401
        assert "Invalid authentication token" in response.json()["detail"]

    def test_get_my_profile_user_not_found(self, client: TestClient, setup_database):
        """Test getting profile for non-existent user."""
        # Create token for non-existent user
        token = create_access_token({"sub": "99999"})
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/v1/users/me/profile", headers=headers)
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    async def test_get_my_profile_with_no_posts(self, client: TestClient, setup_database):
        """Test getting profile for user with no posts."""
        async with TestSessionLocal() as session:
            user = User(
                email="noposts@example.com",
                username="nopostsuser",
                hashed_password=get_password_hash("testpassword")
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            
            token = create_access_token({"sub": str(user.id)})
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/users/me/profile", headers=headers)
        
        assert response.status_code == 200
        profile = response.json()
        assert profile["posts_count"] == 0


class TestUpdateMyProfile:
    """Test PUT /api/v1/users/me/profile endpoint."""

    def test_update_profile_success(self, client: TestClient, test_user_data):
        """Test successfully updating profile."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        update_data = {
            "username": "updateduser",
            "bio": "Updated bio content",
            "profile_image_url": "https://example.com/new-avatar.jpg"
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        profile = response.json()
        
        assert profile["username"] == "updateduser"
        assert profile["bio"] == "Updated bio content"
        assert profile["profile_image_url"] == "https://example.com/new-avatar.jpg"
        assert profile["id"] == data["user"].id  # ID should remain the same

    def test_update_profile_partial(self, client: TestClient, test_user_data):
        """Test updating only some profile fields."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        update_data = {"bio": "Only updating bio"}
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        profile = response.json()
        
        assert profile["bio"] == "Only updating bio"
        assert profile["username"] == data["user"].username  # Should remain unchanged
        assert profile["profile_image_url"] == data["user"].profile_image_url  # Should remain unchanged

    def test_update_profile_username_taken(self, client: TestClient, test_user_data, another_user_data):
        """Test updating username to one that's already taken."""
        data = test_user_data
        other_data = another_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        update_data = {"username": other_data["user"].username}
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 409
        assert "Username already taken" in response.json()["detail"]

    def test_update_profile_same_username(self, client: TestClient, test_user_data):
        """Test updating username to the same username (should succeed)."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        update_data = {"username": data["user"].username}
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        profile = response.json()
        assert profile["username"] == data["user"].username

    def test_update_profile_unauthorized(self, client: TestClient):
        """Test updating profile without authentication."""
        update_data = {"bio": "Unauthorized update"}
        
        response = client.put("/api/v1/users/me/profile", json=update_data)
        
        assert response.status_code == 403

    def test_update_profile_invalid_token(self, client: TestClient):
        """Test updating profile with invalid token."""
        headers = {"Authorization": "Bearer invalid-token"}
        update_data = {"bio": "Invalid token update"}
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 401

    def test_update_profile_empty_data(self, client: TestClient, test_user_data):
        """Test updating profile with empty data."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.put(
            "/api/v1/users/me/profile",
            json={},
            headers=headers
        )
        
        assert response.status_code == 200
        profile = response.json()
        # All fields should remain unchanged
        assert profile["username"] == data["user"].username
        assert profile["bio"] == data["user"].bio


class TestGetMyPosts:
    """Test GET /api/v1/users/me/posts endpoint."""

    def test_get_my_posts_success(self, client: TestClient, test_user_data):
        """Test successfully getting current user's posts."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.get("/api/v1/users/me/posts", headers=headers)
        
        assert response.status_code == 200
        posts = response.json()
        
        assert len(posts) == 2
        for post in posts:
            assert "id" in post
            assert "content" in post
            assert "post_type" in post
            assert "created_at" in post
            assert post["hearts_count"] == 0
            assert post["reactions_count"] == 0

    async def test_get_my_posts_empty(self, client: TestClient, setup_database):
        """Test getting posts for user with no posts."""
        async with TestSessionLocal() as session:
            user = User(
                email="noposts@example.com",
                username="nopostsuser",
                hashed_password=get_password_hash("testpassword")
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            
            token = create_access_token({"sub": str(user.id)})
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/users/me/posts", headers=headers)
        
        assert response.status_code == 200
        posts = response.json()
        assert len(posts) == 0

    def test_get_my_posts_unauthorized(self, client: TestClient):
        """Test getting posts without authentication."""
        response = client.get("/api/v1/users/me/posts")
        
        assert response.status_code == 403

    def test_get_my_posts_ordered_by_date(self, client: TestClient, test_user_data):
        """Test that posts are ordered by creation date (newest first)."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.get("/api/v1/users/me/posts", headers=headers)
        
        assert response.status_code == 200
        posts = response.json()
        
        # Posts should be ordered by created_at desc
        if len(posts) > 1:
            for i in range(len(posts) - 1):
                current_date = posts[i]["created_at"]
                next_date = posts[i + 1]["created_at"]
                assert current_date >= next_date


class TestGetUserProfile:
    """Test GET /api/v1/users/{user_id}/profile endpoint."""

    def test_get_user_profile_success(self, client: TestClient, test_user_data, another_user_data):
        """Test successfully getting another user's profile."""
        data = test_user_data
        other_data = another_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.get(
            f"/api/v1/users/{other_data['user'].id}/profile",
            headers=headers
        )
        
        assert response.status_code == 200
        profile = response.json()
        
        assert profile["id"] == other_data["user"].id
        assert profile["username"] == other_data["user"].username
        assert profile["email"] == other_data["user"].email  # Note: In production, don't expose email
        assert profile["bio"] == other_data["user"].bio
        assert profile["posts_count"] == 0  # Other user has no posts

    def test_get_user_profile_not_found(self, client: TestClient, test_user_data):
        """Test getting profile for non-existent user."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.get("/api/v1/users/99999/profile", headers=headers)
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    def test_get_user_profile_unauthorized(self, client: TestClient, another_user_data):
        """Test getting user profile without authentication."""
        other_data = another_user_data
        
        response = client.get(f"/api/v1/users/{other_data['user'].id}/profile")
        
        assert response.status_code == 403


class TestProfileDataIntegrity:
    """Test profile data integrity and consistency."""

    def test_profile_posts_count_consistency(self, client: TestClient, test_user_data):
        """Test that posts count in profile matches actual posts."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        # Get profile
        profile_response = client.get("/api/v1/users/me/profile", headers=headers)
        profile = profile_response.json()
        
        # Get posts
        posts_response = client.get("/api/v1/users/me/posts", headers=headers)
        posts = posts_response.json()
        
        # Counts should match
        assert profile["posts_count"] == len(posts)

    def test_profile_update_persistence(self, client: TestClient, test_user_data):
        """Test that profile updates persist correctly."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        # Update profile
        update_data = {
            "username": "persistentuser",
            "bio": "This should persist"
        }
        
        update_response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=headers
        )
        assert update_response.status_code == 200
        
        # Get profile again to verify persistence
        get_response = client.get("/api/v1/users/me/profile", headers=headers)
        profile = get_response.json()
        
        assert profile["username"] == "persistentuser"
        assert profile["bio"] == "This should persist"

    def test_profile_fields_data_types(self, client: TestClient, test_user_data):
        """Test that profile fields have correct data types."""
        data = test_user_data
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.get("/api/v1/users/me/profile", headers=headers)
        profile = response.json()
        
        # Check data types
        assert isinstance(profile["id"], int)
        assert isinstance(profile["username"], str)
        assert isinstance(profile["email"], str)
        assert isinstance(profile["created_at"], str)
        assert isinstance(profile["posts_count"], int)
        assert isinstance(profile["followers_count"], int)
        assert isinstance(profile["following_count"], int)
        
        # Optional fields can be None or string
        if profile["bio"] is not None:
            assert isinstance(profile["bio"], str)
        if profile["profile_image_url"] is not None:
            assert isinstance(profile["profile_image_url"], str)