"""
Integration tests for feed algorithm functionality.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from main import app
from app.models.user import User
from app.models.post import Post, PostType
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.follow import Follow


class TestFeedAlgorithm:
    """Test feed algorithm integration."""

    @pytest.fixture
    async def sample_users(self, db_session: AsyncSession):
        """Create sample users for testing."""
        users = []
        for i in range(3):
            user = User(
                username=f"testuser{i}",
                email=f"test{i}@example.com",
                hashed_password="hashed_password"
            )
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        for user in users:
            await db_session.refresh(user)
        return users

    @pytest.fixture
    async def sample_posts(self, db_session: AsyncSession, sample_users):
        """Create sample posts with different engagement levels."""
        posts = []
        
        # Create posts with different types and engagement
        post_data = [
            {"content": "Daily gratitude post", "post_type": PostType.daily, "user_idx": 0},
            {"content": "Photo post with image", "post_type": PostType.photo, "user_idx": 1},
            {"content": "Spontaneous thought", "post_type": PostType.spontaneous, "user_idx": 2},
        ]
        
        for i, data in enumerate(post_data):
            post = Post(
                id=f"post-{i}",
                author_id=sample_users[data["user_idx"]].id,
                content=data["content"],
                post_type=data["post_type"],
                is_public=True
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        for post in posts:
            await db_session.refresh(post)
        return posts

    def test_feed_endpoint_with_algorithm_enabled(
        self, 
        setup_test_database,
        sample_users, 
        sample_posts
    ):
        """Test feed endpoint with algorithm enabled (default)."""
        client = TestClient(app)
        
        # Create authentication token for first user
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(sample_users[0].id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test feed with algorithm enabled (default)
        response = client.get("/api/v1/posts/feed", headers=headers)
        assert response.status_code == 200
        
        posts = response.json()
        assert isinstance(posts, list)
        assert len(posts) == 3  # Should return all 3 posts
        
        # Verify response structure
        for post in posts:
            assert "id" in post
            assert "content" in post
            assert "post_type" in post
            assert "author" in post
            assert "hearts_count" in post
            assert "reactions_count" in post
            assert "created_at" in post

    def test_feed_endpoint_with_algorithm_disabled(
        self, 
        setup_test_database,
        sample_users, 
        sample_posts
    ):
        """Test feed endpoint with algorithm disabled (chronological order)."""
        client = TestClient(app)
        
        # Create authentication token for first user
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(sample_users[0].id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test feed with algorithm disabled
        response = client.get("/api/v1/posts/feed?algorithm=false", headers=headers)
        assert response.status_code == 200
        
        posts = response.json()
        assert isinstance(posts, list)
        assert len(posts) == 3  # Should return all 3 posts
        
        # Verify chronological order (newest first)
        for i in range(len(posts) - 1):
            current_time = posts[i]["created_at"]
            next_time = posts[i + 1]["created_at"]
            assert current_time >= next_time  # Should be in descending order

    def test_feed_backward_compatibility(
        self, 
        setup_test_database,
        sample_users, 
        sample_posts
    ):
        """Test that existing feed behavior is preserved when algorithm=false."""
        client = TestClient(app)
        
        # Create authentication token for first user
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(sample_users[0].id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get both algorithm and chronological feeds
        algo_response = client.get("/api/v1/posts/feed?algorithm=true", headers=headers)
        chrono_response = client.get("/api/v1/posts/feed?algorithm=false", headers=headers)
        
        assert algo_response.status_code == 200
        assert chrono_response.status_code == 200
        
        algo_posts = algo_response.json()
        chrono_posts = chrono_response.json()
        
        # Both should return the same posts (just potentially different order)
        assert len(algo_posts) == len(chrono_posts)
        
        # Verify response structure is identical
        for post in chrono_posts:
            assert "id" in post
            assert "content" in post
            assert "post_type" in post
            assert "author" in post
            assert "hearts_count" in post
            assert "reactions_count" in post