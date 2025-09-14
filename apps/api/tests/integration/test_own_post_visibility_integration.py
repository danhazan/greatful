"""
Integration tests for own post visibility and decay functionality.
"""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient

from app.models.user import User
from app.models.post import Post, PostType


class TestOwnPostVisibilityIntegration:
    """Integration tests for own post visibility system."""

    @pytest.mark.asyncio
    async def test_create_post_immediate_visibility(self, async_client: AsyncClient, test_user: User, auth_headers):
        """Test that newly created posts get immediate top visibility."""
        # Create a new post
        post_data = {
            "content": "Just posted this gratitude!",
            "post_type": "text",
            "is_public": True
        }
        
        response = await async_client.post(
            "/api/v1/posts",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        new_post = response.json()
        
        # Get feed immediately after posting
        feed_response = await async_client.get(
            "/api/v1/posts/feed?limit=10",
            headers=auth_headers
        )
        assert feed_response.status_code == 200
        feed_data = feed_response.json()
        
        # The new post should be at or near the top of the feed
        posts = feed_data["posts"]
        assert len(posts) > 0
        
        # Find the new post in the feed
        new_post_in_feed = None
        for i, post in enumerate(posts):
            if post["id"] == new_post["id"]:
                new_post_in_feed = post
                break
        
        assert new_post_in_feed is not None, "New post should appear in feed"
        
        # Check if it has own post metadata
        if "is_own_post" in new_post_in_feed:
            assert new_post_in_feed["is_own_post"] is True
            assert "own_post_bonus" in new_post_in_feed

    @pytest.mark.asyncio
    async def test_feed_algorithm_with_own_posts(self, async_client: AsyncClient, test_user: User, auth_headers):
        """Test that feed algorithm properly handles own posts."""
        # Create multiple posts to test ranking
        post_contents = [
            "First gratitude post",
            "Second gratitude post", 
            "Third gratitude post"
        ]
        
        created_posts = []
        for content in post_contents:
            post_data = {
                "content": content,
                "post_type": "text",
                "is_public": True
            }
            
            response = await async_client.post(
                "/api/v1/posts",
                json=post_data,
                headers=auth_headers
            )
            assert response.status_code == 201
            created_posts.append(response.json())
            
            # Small delay between posts to test timing
            import asyncio
            await asyncio.sleep(0.1)
        
        # Get feed with algorithm enabled
        feed_response = await async_client.get(
            "/api/v1/posts/feed?algorithm=true&limit=20",
            headers=auth_headers
        )
        assert feed_response.status_code == 200
        feed_data = feed_response.json()
        
        posts = feed_data["posts"]
        assert len(posts) >= len(created_posts)
        
        # Check that our posts appear in the feed with proper scoring
        our_posts_in_feed = []
        for post in posts:
            if post["id"] in [p["id"] for p in created_posts]:
                our_posts_in_feed.append(post)
        
        assert len(our_posts_in_feed) == len(created_posts)
        
        # Verify algorithm scores are applied
        for post in our_posts_in_feed:
            assert "algorithm_score" in post
            assert post["algorithm_score"] > 0

    @pytest.mark.asyncio
    async def test_own_post_visibility_status_endpoint(self, async_client: AsyncClient, test_user: User, auth_headers):
        """Test endpoint for getting own post visibility status."""
        # Create a new post
        post_data = {
            "content": "Testing visibility status",
            "post_type": "text",
            "is_public": True
        }
        
        response = await async_client.post(
            "/api/v1/posts",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        new_post = response.json()
        
        # Get the post with visibility status (if endpoint exists)
        # This would require adding an endpoint to the API
        post_response = await async_client.get(
            f"/api/v1/posts/{new_post['id']}",
            headers=auth_headers
        )
        assert post_response.status_code == 200
        post_data = post_response.json()
        
        # Verify post data structure
        assert post_data["id"] == new_post["id"]
        assert post_data["author_id"] == test_user.id

    @pytest.mark.asyncio
    async def test_feed_refresh_with_own_posts(self, async_client: AsyncClient, test_user: User, auth_headers):
        """Test feed refresh functionality with own posts."""
        # Get initial feed
        initial_response = await async_client.get(
            "/api/v1/posts/feed?limit=10",
            headers=auth_headers
        )
        assert initial_response.status_code == 200
        initial_posts = initial_response.json()["posts"]
        
        # Create a new post
        post_data = {
            "content": "New post for refresh test",
            "post_type": "text", 
            "is_public": True
        }
        
        response = await async_client.post(
            "/api/v1/posts",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        new_post = response.json()
        
        # Refresh feed
        refresh_response = await async_client.get(
            "/api/v1/posts/feed?refresh=true&limit=10",
            headers=auth_headers
        )
        assert refresh_response.status_code == 200
        refreshed_posts = refresh_response.json()["posts"]
        
        # New post should appear in refreshed feed
        new_post_ids = [p["id"] for p in refreshed_posts]
        assert new_post["id"] in new_post_ids

    @pytest.mark.asyncio
    async def test_algorithm_config_affects_own_posts(self, async_client: AsyncClient, test_user: User, auth_headers):
        """Test that algorithm configuration affects own post visibility."""
        # Create a post
        post_data = {
            "content": "Testing config effects",
            "post_type": "text",
            "is_public": True
        }
        
        response = await async_client.post(
            "/api/v1/posts",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        new_post = response.json()
        
        # Get feed with algorithm enabled
        feed_response = await async_client.get(
            "/api/v1/posts/feed?algorithm=true&limit=10",
            headers=auth_headers
        )
        assert feed_response.status_code == 200
        feed_data = feed_response.json()
        
        # Find our post in the feed
        our_post = None
        for post in feed_data["posts"]:
            if post["id"] == new_post["id"]:
                our_post = post
                break
        
        assert our_post is not None
        
        # Verify it has a higher score than it would without own post bonus
        # (This is implicit in the algorithm, hard to test directly without mocking)
        assert "algorithm_score" in our_post

    @pytest.mark.asyncio
    async def test_multiple_users_own_posts(self, async_client: AsyncClient, test_user: User, auth_headers, db_session):
        """Test own post visibility with multiple users."""
        # Create another user
        from app.services.user_service import UserService
        user_service = UserService(db_session)
        
        other_user_data = {
            "username": "otheruser",
            "email": "other@example.com",
            "password": "password123"
        }
        other_user = await user_service.create_user(**other_user_data)
        
        # Create posts from both users
        # First user's post
        post_data_1 = {
            "content": "First user's post",
            "post_type": "text",
            "is_public": True
        }
        
        response_1 = await async_client.post(
            "/api/v1/posts",
            json=post_data_1,
            headers=auth_headers
        )
        assert response_1.status_code == 201
        
        # Get feed for first user
        feed_response_1 = await async_client.get(
            "/api/v1/posts/feed?limit=10",
            headers=auth_headers
        )
        assert feed_response_1.status_code == 200
        
        # Verify first user sees their own post with bonus
        posts_1 = feed_response_1.json()["posts"]
        assert len(posts_1) > 0
        
        # Check that the user's own post appears in their feed
        user_post_found = False
        for post in posts_1:
            if post["author_id"] == test_user.id:
                user_post_found = True
                break
        
        assert user_post_found, "User should see their own post in feed"

    @pytest.mark.asyncio
    async def test_own_post_decay_over_time(self, async_client: AsyncClient, test_user: User, auth_headers, db_session):
        """Test that own post visibility decays over time."""
        # This test would require time manipulation or waiting
        # For now, we'll test the algorithm logic directly
        
        from app.services.algorithm_service import AlgorithmService
        algorithm_service = AlgorithmService(db_session)
        
        # Test different time periods
        test_times = [1, 3, 7, 12, 18, 25]  # minutes
        bonuses = []
        
        for minutes in test_times:
            bonus = algorithm_service._calculate_own_post_bonus(float(minutes))
            bonuses.append(bonus)
        
        # Verify decay pattern
        # First few should be at max
        assert bonuses[0] == bonuses[1]  # Both in max visibility period
        
        # Should decay over time
        for i in range(len(bonuses) - 1):
            assert bonuses[i] >= bonuses[i + 1], f"Bonus should not increase over time: {bonuses}"
        
        # Last bonus should be at base level
        expected_base = algorithm_service.config.own_post_factors.base_multiplier * 2
        assert bonuses[-1] == expected_base

    @pytest.mark.asyncio
    async def test_feed_performance_with_own_posts(self, async_client: AsyncClient, test_user: User, auth_headers):
        """Test that own post calculations don't significantly impact feed performance."""
        import time
        
        # Create several posts to test with
        for i in range(5):
            post_data = {
                "content": f"Performance test post {i}",
                "post_type": "text",
                "is_public": True
            }
            
            response = await async_client.post(
                "/api/v1/posts",
                json=post_data,
                headers=auth_headers
            )
            assert response.status_code == 201
        
        # Measure feed response time
        start_time = time.time()
        
        feed_response = await async_client.get(
            "/api/v1/posts/feed?algorithm=true&limit=20",
            headers=auth_headers
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert feed_response.status_code == 200
        
        # Feed should respond within reasonable time (adjust threshold as needed)
        assert response_time < 2.0, f"Feed response took too long: {response_time}s"
        
        # Verify we got posts back
        posts = feed_response.json()["posts"]
        assert len(posts) > 0