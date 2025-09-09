"""
Integration test to verify the character limit fix.
Tests that the 200-character limit for spontaneous posts has been removed
and the universal 5000-character limit is enforced.
"""

import pytest
from httpx import Client
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import create_access_token


class TestCharacterLimitFix:
    """Test that character limits have been properly updated."""

    @pytest.mark.asyncio
    async def test_spontaneous_post_accepts_long_content(self, client: Client, db_session: AsyncSession):
        """Test that spontaneous posts can now accept content longer than 200 characters."""
        # Create test user
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create access token
        token = create_access_token({"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Test content that's longer than the old 200-character limit
        # but shorter than the new 5000-character limit
        long_content = "a" * 500  # 500 characters - would have failed before, should pass now
        
        post_data = {
            "content": long_content,
            "post_type_override": "spontaneous",  # Explicitly set as spontaneous
            "is_public": True
        }

        response = client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        # Should succeed with 201 Created
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["content"] == long_content
        assert response_data["post_type"] == "spontaneous"

    @pytest.mark.asyncio
    async def test_universal_5000_character_limit_enforced(self, client: Client, db_session: AsyncSession):
        """Test that the universal 5000-character limit is still enforced."""
        # Create test user
        user = User(
            email="test2@example.com",
            username="testuser2",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create access token
        token = create_access_token({"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Test content that exceeds the 5000-character limit
        very_long_content = "a" * 5001  # 5001 characters - should fail
        
        post_data = {
            "content": very_long_content,
            "post_type_override": "spontaneous",
            "is_public": True
        }

        response = client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        # Should fail with 422 Validation Error
        assert response.status_code == 422
        error_data = response.json()
        assert "Content too long" in error_data["detail"]
        assert "5000" in error_data["detail"]

    @pytest.mark.asyncio
    async def test_daily_post_accepts_long_content(self, client: Client, db_session: AsyncSession):
        """Test that daily posts can accept long content up to 5000 characters."""
        # Create test user
        user = User(
            email="test3@example.com",
            username="testuser3",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create access token
        token = create_access_token({"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Test content that's close to the 5000-character limit
        long_content = "a" * 4999  # 4999 characters - should pass
        
        post_data = {
            "content": long_content,
            "post_type_override": "daily",
            "is_public": True
        }

        response = client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        # Should succeed with 201 Created
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["content"] == long_content
        assert response_data["post_type"] == "daily"

    @pytest.mark.asyncio
    async def test_auto_detection_still_works(self, client: Client, db_session: AsyncSession):
        """Test that automatic post type detection still works with new limits."""
        # Create test user
        user = User(
            email="test4@example.com",
            username="testuser4",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create access token
        token = create_access_token({"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Test short content (should be detected as spontaneous)
        short_content = "Grateful for coffee this morning!"
        
        post_data = {
            "content": short_content,
            "is_public": True
            # No post_type_override - let it auto-detect
        }

        response = client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        # Should succeed and be detected as spontaneous
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["content"] == short_content
        assert response_data["post_type"] == "spontaneous"

        # Test longer content (should be detected as daily)
        long_content = "Today I'm incredibly grateful for the opportunity to spend time with my family and friends. We had such a wonderful time together, sharing stories and creating memories that will last a lifetime."
        
        post_data = {
            "content": long_content,
            "is_public": True
            # No post_type_override - let it auto-detect
        }

        response = client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        # Should succeed and be detected as daily
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["content"] == long_content
        assert response_data["post_type"] == "daily"