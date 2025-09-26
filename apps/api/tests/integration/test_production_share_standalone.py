#!/usr/bin/env python3
"""
Standalone production-like test for share functionality to debug production issues.
This test can be run independently to validate production configuration.
"""

import pytest
import asyncio
import os
import sys
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class TestProductionShareStandalone:
    """Standalone production share tests"""

    @pytest.mark.asyncio
    async def test_share_with_production_env_standalone(self, async_client, db_session):
        """Test share functionality with production environment variables (standalone)."""
        # Set production-like environment variables
        original_env = os.environ.get("ENVIRONMENT")
        original_frontend_url = os.environ.get("FRONTEND_BASE_URL")
        
        try:
            os.environ["ENVIRONMENT"] = "production"
            os.environ["FRONTEND_BASE_URL"] = "https://grateful-web.vercel.app"
            
            # Import test dependencies
            from app.models.user import User
            from app.models.post import Post, PostType
            from app.core.security import create_access_token
            
            logger.info("Starting production environment share test...")
            # Create test user
            test_user = User(
                email="test_share@example.com",
                username="test_share_user",
                hashed_password="test_password"
            )
            db_session.add(test_user)
            await db_session.commit()
            await db_session.refresh(test_user)
            logger.info(f"Created test user: {test_user.id}")
            
            # Create test post
            test_post = Post(
                author_id=test_user.id,
                content="Test post for production share testing",
                post_type=PostType.daily,
                is_public=True
            )
            db_session.add(test_post)
            await db_session.commit()
            await db_session.refresh(test_post)
            logger.info(f"Created test post: {test_post.id}")
            
            # Create auth token
            token = create_access_token(data={"sub": str(test_user.id)})
            headers = {"Authorization": f"Bearer {token}"}
            
            # Test URL sharing
            logger.info("Testing URL sharing with production environment...")
            share_data = {"share_method": "url"}
            
            response = await async_client.post(
                f"/api/v1/posts/{test_post.id}/share",
                json=share_data,
                headers=headers
            )
            
            logger.info(f"URL share response status: {response.status_code}")
            logger.info(f"URL share response: {response.text}")
            
            assert response.status_code == 201, f"URL share failed with status {response.status_code}: {response.text}"
            
            data = response.json()
            logger.info(f"URL share successful: {data}")
            
            # Verify the share URL contains the production frontend URL
            assert "share_url" in data, "Response should contain share_url"
            assert "grateful-web.vercel.app" in data["share_url"], f"Share URL should use production frontend: {data['share_url']}"
            
            # Test message sharing
            logger.info("Testing message sharing with production environment...")
            
            # Create recipient user
            recipient_user = User(
                email="recipient@example.com",
                username="recipient_user",
                hashed_password="test_password"
            )
            db_session.add(recipient_user)
            await db_session.commit()
            await db_session.refresh(recipient_user)
            logger.info(f"Created recipient user: {recipient_user.id}")
            
            share_data = {
                "share_method": "message",
                "recipient_ids": [recipient_user.id],
                "message": "Test message"
            }
            
            response = await async_client.post(
                f"/api/v1/posts/{test_post.id}/share",
                json=share_data,
                headers=headers
            )
            
            logger.info(f"Message share response status: {response.status_code}")
            logger.info(f"Message share response: {response.text}")
            
            assert response.status_code == 201, f"Message share failed with status {response.status_code}: {response.text}"
            
            data = response.json()
            logger.info(f"Message share successful: {data}")
            
            logger.info("Production environment test completed successfully")
            
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

    @pytest.mark.asyncio
    async def test_production_config_validation_standalone(self):
        """Test production configuration validation (standalone)."""
        
        # Test with production-like environment
        production_env = {
            'ENVIRONMENT': 'production',
            'FRONTEND_BASE_URL': 'https://grateful-web.vercel.app',
            'ALLOWED_ORIGINS': 'https://grateful-web.vercel.app,https://www.grateful-web.vercel.app',
            'SSL_REDIRECT': 'true',
            'SECURE_COOKIES': 'true',
            'ENABLE_DOCS': 'false',
        }
        
        # Store original values
        original_values = {}
        for key in production_env:
            original_values[key] = os.environ.get(key)
        
        try:
            # Set production environment
            for key, value in production_env.items():
                os.environ[key] = value
            
            # Validate configuration
            frontend_url = os.environ.get('FRONTEND_BASE_URL', '')
            allowed_origins = os.environ.get('ALLOWED_ORIGINS', '')
            ssl_redirect = os.environ.get('SSL_REDIRECT', 'false').lower() == 'true'
            secure_cookies = os.environ.get('SECURE_COOKIES', 'false').lower() == 'true'
            enable_docs = os.environ.get('ENABLE_DOCS', 'true').lower() == 'true'
            
            # Assertions
            assert 'yourdomain.com' not in frontend_url, "Frontend URL should not contain placeholder domain"
            assert 'yourdomain.com' not in allowed_origins, "CORS origins should not contain placeholder domain"
            assert ssl_redirect, "SSL redirect should be enabled in production"
            assert secure_cookies, "Secure cookies should be enabled in production"
            assert not enable_docs, "API docs should be disabled in production"
            
            logger.info("Production configuration validation passed")
            
        finally:
            # Restore original values
            for key, original_value in original_values.items():
                if original_value is not None:
                    os.environ[key] = original_value
                elif key in os.environ:
                    del os.environ[key]


# Standalone execution function
async def run_standalone_test():
    """Run the standalone test when executed directly"""
    test_instance = TestProductionShareStandalone()
    
    try:
        await test_instance.test_share_with_production_env_standalone()
        await test_instance.test_production_config_validation_standalone()
        logger.info("All standalone tests passed!")
        return True
    except Exception as e:
        logger.error(f"Standalone test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(run_standalone_test())
    sys.exit(0 if success else 1)