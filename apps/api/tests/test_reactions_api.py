"""
Integration tests for emoji reactions API endpoints.
"""

import pytest
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
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

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


@pytest.fixture
async def setup_database():
    """Set up test database."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def test_user_and_post(setup_database):
    """Create test user and post."""
    async with TestSessionLocal() as session:
        # Create user
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password=get_password_hash("testpassword")
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        # Create post
        post = Post(
            id=str(uuid.uuid4()),
            author_id=user.id,
            content="I'm grateful for testing!",
            post_type=PostType.daily,
            is_public=True
        )
        session.add(post)
        await session.commit()
        await session.refresh(post)
        
        # Create access token
        token = create_access_token({"sub": str(user.id)})
        
        return {
            "user": user,
            "post": post,
            "token": token
        }


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestReactionsAPI:
    """Test the reactions API endpoints."""

    def test_add_reaction_success(self, client: TestClient, test_user_and_post):
        """Test successfully adding a reaction."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers=headers
        )
        
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["emoji_code"] == "heart_eyes"
        assert response_data["emoji_display"] == "😍"
        assert response_data["user_id"] == data["user"].id
        assert response_data["post_id"] == data["post"].id

    def test_add_reaction_invalid_emoji(self, client: TestClient, test_user_and_post):
        """Test adding reaction with invalid emoji."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "invalid_emoji"},
            headers=headers
        )
        
        assert response.status_code == 400
        assert "Invalid emoji code" in response.json()["detail"]

    def test_add_reaction_unauthorized(self, client: TestClient, test_user_and_post):
        """Test adding reaction without authentication."""
        data = test_user_and_post
        
        response = client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"}
        )
        
        assert response.status_code == 403  # No authorization header

    def test_update_existing_reaction(self, client: TestClient, test_user_and_post):
        """Test updating an existing reaction."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        # Add initial reaction
        response1 = client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers=headers
        )
        assert response1.status_code == 201
        reaction_id = response1.json()["id"]
        
        # Update to different emoji
        response2 = client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "pray"},
            headers=headers
        )
        assert response2.status_code == 201
        
        # Should be same reaction ID but different emoji
        response2_data = response2.json()
        assert response2_data["id"] == reaction_id
        assert response2_data["emoji_code"] == "pray"
        assert response2_data["emoji_display"] == "🙏"

    def test_remove_reaction_success(self, client: TestClient, test_user_and_post):
        """Test successfully removing a reaction."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        # Add reaction first
        client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers=headers
        )
        
        # Remove reaction
        response = client.delete(
            f"/api/v1/posts/{data['post'].id}/reactions",
            headers=headers
        )
        
        assert response.status_code == 204

    def test_remove_nonexistent_reaction(self, client: TestClient, test_user_and_post):
        """Test removing a reaction that doesn't exist."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.delete(
            f"/api/v1/posts/{data['post'].id}/reactions",
            headers=headers
        )
        
        assert response.status_code == 404
        assert "No reaction found" in response.json()["detail"]

    def test_get_post_reactions(self, client: TestClient, test_user_and_post):
        """Test getting all reactions for a post."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        # Add reaction
        client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers=headers
        )
        
        # Get reactions
        response = client.get(
            f"/api/v1/posts/{data['post'].id}/reactions",
            headers=headers
        )
        
        assert response.status_code == 200
        reactions = response.json()
        assert len(reactions) == 1
        assert reactions[0]["emoji_code"] == "heart_eyes"
        assert reactions[0]["user"]["username"] == data["user"].username

    def test_get_reaction_summary(self, client: TestClient, test_user_and_post):
        """Test getting reaction summary for a post."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        # Initially no reactions
        response = client.get(
            f"/api/v1/posts/{data['post'].id}/reactions/summary",
            headers=headers
        )
        
        assert response.status_code == 200
        summary = response.json()
        assert summary["total_count"] == 0
        assert summary["emoji_counts"] == {}
        assert summary["user_reaction"] is None
        
        # Add reaction
        client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers=headers
        )
        
        # Get summary again
        response = client.get(
            f"/api/v1/posts/{data['post'].id}/reactions/summary",
            headers=headers
        )
        
        assert response.status_code == 200
        summary = response.json()
        assert summary["total_count"] == 1
        assert summary["emoji_counts"]["heart_eyes"] == 1
        assert summary["user_reaction"] == "heart_eyes"

    def test_get_reactions_nonexistent_post(self, client: TestClient, test_user_and_post):
        """Test getting reactions for nonexistent post."""
        data = test_user_and_post
        headers = {"Authorization": f"Bearer {data['token']}"}
        
        response = client.get(
            "/api/v1/posts/nonexistent-post-id/reactions",
            headers=headers
        )
        
        # Should return empty list, not error
        assert response.status_code == 200
        assert response.json() == []

    def test_invalid_token(self, client: TestClient, test_user_and_post):
        """Test API calls with invalid token."""
        data = test_user_and_post
        headers = {"Authorization": "Bearer invalid-token"}
        
        response = client.post(
            f"/api/v1/posts/{data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers=headers
        )
        
        assert response.status_code == 401
        assert "Invalid authentication token" in response.json()["detail"]