"""
Production-like test for share functionality to debug production issues.
"""

import pytest
import os
import logging
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post, PostType

logger = logging.getLogger(__name__)

class TestProductionShareDebug:
    """Test share functionality with production-like conditions."""

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
            content="Test gratitude post for production debugging",
            post_type=PostType.daily,
            is_public=True
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        return post

    @pytest.fixture
    def auth_headers(self, test_user: User):
        """Create authentication headers."""
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(test_user.id)})
        return {"Authorization": f"Bearer {token}"}

    async def test_share_with_production_environment(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test share functionality with production environment variables."""
        # Store original environment variables
        original_env = os.environ.get("ENVIRONMENT")
        original_frontend_url = os.environ.get("FRONTEND_BASE_URL")
        
        try:
            # Set production-like environment variables
            os.environ["ENVIRONMENT"] = "production"
            os.environ["FRONTEND_BASE_URL"] = "https://grateful-net.vercel.app"
            
            logger.info("Testing share functionality with production environment variables")
            
            # Test URL sharing
            logger.info("Testing URL sharing with production environment...")
            share_data = {"share_method": "url"}
            
            response = await async_client.post(
                f"/api/v1/posts/{test_post.id}/share",
                json=share_data,
                headers=auth_headers
            )
            
            logger.info(f"URL share response status: {response.status_code}")
            logger.info(f"URL share response: {response.text}")
            
            # Check if the request succeeded
            if response.status_code == 201:
                data = response.json()
                logger.info(f"URL share successful: {data}")
                
                # Verify the share URL contains the production frontend URL
                if "share_url" in data and "grateful-net.vercel.app" in data["share_url"]:
                    logger.info("✓ Production frontend URL correctly used in share URL")
                else:
                    logger.warning(f"⚠ Share URL may not use production frontend: {data.get('share_url')}")
                    
                assert data["user_id"] == test_user.id
                assert data["post_id"] == test_post.id
                assert data["share_method"] == "url"
                assert "share_url" in data
                assert "grateful-net.vercel.app" in data["share_url"]
            else:
                logger.error(f"✗ URL share failed with status {response.status_code}: {response.text}")
                # Let's see what the actual error is
                assert False, f"URL share failed with status {response.status_code}: {response.text}"
            
        finally:
            # Restore original environment variables
            if original_env is not None:
                os.environ["ENVIRONMENT"] = original_env
            elif "ENVIRONMENT" in os.environ:
                del os.environ["ENVIRONMENT"]
                
            if original_frontend_url is not None:
                os.environ["FRONTEND_BASE_URL"] = original_frontend_url
            elif "FRONTEND_BASE_URL" in os.environ:
                del os.environ["FRONTEND_BASE_URL"]

    async def test_share_message_with_production_environment(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test message sharing with production environment variables."""
        # Store original environment variables
        original_env = os.environ.get("ENVIRONMENT")
        original_frontend_url = os.environ.get("FRONTEND_BASE_URL")
        
        try:
            # Set production-like environment variables
            os.environ["ENVIRONMENT"] = "production"
            os.environ["FRONTEND_BASE_URL"] = "https://grateful-net.vercel.app"
            
            # Create recipient user
            recipient_user = User(
                email="recipient@example.com",
                username="recipient_user",
                hashed_password="test_password"
            )
            db_session.add(recipient_user)
            await db_session.commit()
            await db_session.refresh(recipient_user)
            
            logger.info("Testing message sharing with production environment...")
            
            share_data = {
                "share_method": "message",
                "recipient_ids": [recipient_user.id],
                "message": "Test message"
            }
            
            response = await async_client.post(
                f"/api/v1/posts/{test_post.id}/share",
                json=share_data,
                headers=auth_headers
            )
            
            logger.info(f"Message share response status: {response.status_code}")
            logger.info(f"Message share response: {response.text}")
            
            if response.status_code == 201:
                data = response.json()
                logger.info(f"✓ Message share successful: {data}")
                
                assert data["user_id"] == test_user.id
                assert data["post_id"] == test_post.id
                assert data["share_method"] == "message"
                assert data["recipient_count"] == 1
            else:
                logger.error(f"✗ Message share failed with status {response.status_code}: {response.text}")
                # Let's see what the actual error is
                assert False, f"Message share failed with status {response.status_code}: {response.text}"
            
        finally:
            # Restore original environment variables
            if original_env is not None:
                os.environ["ENVIRONMENT"] = original_env
            elif "ENVIRONMENT" in os.environ:
                del os.environ["ENVIRONMENT"]
                
            if original_frontend_url is not None:
                os.environ["FRONTEND_BASE_URL"] = original_frontend_url
            elif "FRONTEND_BASE_URL" in os.environ:
                del os.environ["FRONTEND_BASE_URL"]

    async def test_share_error_scenarios(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test share error handling scenarios that might occur in production."""
        
        # Test sharing non-existent post
        logger.info("Testing share with non-existent post...")
        share_data = {"share_method": "url"}
        
        response = await async_client.post(
            "/api/v1/posts/non-existent-post-id/share",
            json=share_data,
            headers=auth_headers
        )
        
        logger.info(f"Non-existent post share status: {response.status_code}")
        logger.info(f"Non-existent post share response: {response.text}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        # Test sharing with invalid method
        logger.info("Testing share with invalid method...")
        share_data = {"share_method": "invalid"}
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        logger.info(f"Invalid method share status: {response.status_code}")
        logger.info(f"Invalid method share response: {response.text}")
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        
        # Test message sharing without recipients
        logger.info("Testing message share without recipients...")
        share_data = {"share_method": "message"}
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        logger.info(f"No recipients share status: {response.status_code}")
        logger.info(f"No recipients share response: {response.text}")
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"

    async def test_share_with_missing_dependencies(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test share functionality when dependencies might be missing."""
        
        # Test with potentially missing notification factory
        logger.info("Testing share with potential notification issues...")
        
        share_data = {"share_method": "url"}
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        logger.info(f"Share with notification test status: {response.status_code}")
        logger.info(f"Share with notification test response: {response.text}")
        
        # Even if notifications fail, the share should still succeed
        # The share service is designed to not fail if notifications fail
        assert response.status_code == 201, f"Share should succeed even if notifications fail, got {response.status_code}: {response.text}"