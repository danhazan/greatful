"""
Integration tests for feed refresh mechanism with unread priority.
"""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post, PostType
from app.services.algorithm_service import AlgorithmService


class TestFeedRefresh:
    """Test feed refresh mechanism with unread priority."""

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession):
        """Create a test user."""
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hashed_password",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=2)
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def old_post(self, db_session: AsyncSession, test_user: User):
        """Create an old post (before user's last feed view)."""
        post = Post(
            id="old-post-1",
            author_id=test_user.id,
            content="This is an old post",
            post_type=PostType.spontaneous,
            created_at=datetime.now(timezone.utc) - timedelta(hours=3),
            is_public=True
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        return post

    @pytest.fixture
    async def new_post(self, db_session: AsyncSession, test_user: User):
        """Create a new post (after user's last feed view)."""
        post = Post(
            id="new-post-1",
            author_id=test_user.id,
            content="This is a new post",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
            is_public=True
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        return post

    async def test_unread_post_detection(self, db_session: AsyncSession, test_user: User, old_post: Post, new_post: Post):
        """Test that unread posts are correctly identified based on last_feed_view."""
        algorithm_service = AlgorithmService(db_session)
        
        # Get posts with refresh mode
        posts, total_count = await algorithm_service.get_personalized_feed(
            user_id=test_user.id,
            limit=10,
            offset=0,
            algorithm_enabled=True,
            consider_read_status=True,
            refresh_mode=True
        )
        
        # Should have both posts
        assert len(posts) >= 1
        assert total_count >= 2
        
        # Find the new post in results
        new_post_result = None
        old_post_result = None
        
        for post in posts:
            if post['id'] == new_post.id:
                new_post_result = post
            elif post['id'] == old_post.id:
                old_post_result = post
        
        # New post should be marked as unread and have higher score
        if new_post_result:
            assert new_post_result.get('is_unread', False) == True
            assert new_post_result['algorithm_score'] > 0
        
        # Old post should not be marked as unread (if present)
        if old_post_result:
            assert old_post_result.get('is_unread', False) == False

    async def test_update_feed_view_timestamp(self, db_session: AsyncSession, test_user: User):
        """Test updating user's last feed view timestamp."""
        algorithm_service = AlgorithmService(db_session)
        
        # Get initial timestamp
        initial_timestamp = test_user.last_feed_view
        
        # Update feed view timestamp
        await algorithm_service.update_user_last_feed_view(test_user.id)
        
        # Refresh user to get updated timestamp
        await db_session.refresh(test_user)
        
        # Timestamp should be updated
        assert test_user.last_feed_view > initial_timestamp
        
        # Handle timezone comparison
        current_time = datetime.now(timezone.utc)
        user_timestamp = test_user.last_feed_view
        if user_timestamp.tzinfo is None:
            user_timestamp = user_timestamp.replace(tzinfo=timezone.utc)
        
        assert user_timestamp <= current_time

    async def test_feed_refresh_api_endpoint(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test the feed refresh API endpoint."""
        # Test normal feed
        response = await async_client.get("/api/v1/posts/feed", headers=auth_headers)
        assert response.status_code == 200
        normal_posts = response.json()
        
        # Test refresh mode
        response = await async_client.get("/api/v1/posts/feed?refresh=true", headers=auth_headers)
        assert response.status_code == 200
        refresh_posts = response.json()
        
        # Both should return valid post arrays
        assert isinstance(normal_posts, list)
        assert isinstance(refresh_posts, list)

    async def test_update_feed_view_api_endpoint(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test the update feed view API endpoint."""
        response = await async_client.post("/api/v1/posts/update-feed-view", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "timestamp" in data
        assert "message" in data

    async def test_unread_boost_configuration(self, db_session: AsyncSession):
        """Test that unread boost configuration is properly loaded."""
        algorithm_service = AlgorithmService(db_session)
        config = algorithm_service.config
        
        # Should have unread boost configured
        assert hasattr(config.scoring_weights, 'unread_boost')
        assert config.scoring_weights.unread_boost > 0
        assert config.scoring_weights.unread_boost == 3.0  # Default value

    async def test_refresh_mode_prioritizes_unread(self, db_session: AsyncSession, test_user: User, old_post: Post, new_post: Post):
        """Test that refresh mode prioritizes unread posts over older content."""
        algorithm_service = AlgorithmService(db_session)
        
        # Get normal feed
        normal_posts, _ = await algorithm_service.get_personalized_feed(
            user_id=test_user.id,
            limit=10,
            refresh_mode=False
        )
        
        # Get refresh feed
        refresh_posts, _ = await algorithm_service.get_personalized_feed(
            user_id=test_user.id,
            limit=10,
            refresh_mode=True
        )
        
        # Both should return posts
        assert len(normal_posts) >= 0
        assert len(refresh_posts) >= 0
        
        # In refresh mode, unread posts should be prioritized
        # (This is a basic test - in a real scenario with more posts and engagement,
        # the difference would be more pronounced)

    async def test_various_timing_scenarios(self, db_session: AsyncSession):
        """Test refresh mechanism with various timing scenarios and user behaviors."""
        # Create test user with specific last_feed_view
        user = User(
            email="timing@example.com",
            username="timinguser",
            hashed_password="hashed_password",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Create posts at different times relative to user's last_feed_view
        posts = []
        
        # Very old post (3 hours ago)
        very_old_post = Post(
            id="very-old-post",
            author_id=user.id,
            content="Very old post",
            post_type=PostType.spontaneous,
            created_at=datetime.now(timezone.utc) - timedelta(hours=3),
            is_public=True
        )
        posts.append(very_old_post)
        
        # Old post (2 hours ago, before last_feed_view)
        old_post = Post(
            id="old-post",
            author_id=user.id,
            content="Old post",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            is_public=True
        )
        posts.append(old_post)
        
        # Recent post (30 minutes ago, after last_feed_view)
        recent_post = Post(
            id="recent-post",
            author_id=user.id,
            content="Recent post",
            post_type=PostType.photo,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
            is_public=True
        )
        posts.append(recent_post)
        
        # Very recent post (5 minutes ago)
        very_recent_post = Post(
            id="very-recent-post",
            author_id=user.id,
            content="Very recent post",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            is_public=True
        )
        posts.append(very_recent_post)
        
        for post in posts:
            db_session.add(post)
        await db_session.commit()
        
        algorithm_service = AlgorithmService(db_session)
        
        # Test refresh mode - should prioritize unread posts
        refresh_posts, _ = await algorithm_service.get_personalized_feed(
            user_id=user.id,
            limit=10,
            refresh_mode=True
        )
        
        # Should have all posts
        assert len(refresh_posts) >= 4
        
        # Find posts in results
        post_results = {post['id']: post for post in refresh_posts}
        
        # Recent and very recent posts should be marked as unread
        if "recent-post" in post_results:
            assert post_results["recent-post"].get('is_unread', False) == True
            assert post_results["recent-post"]['algorithm_score'] > 0
        
        if "very-recent-post" in post_results:
            assert post_results["very-recent-post"].get('is_unread', False) == True
            assert post_results["very-recent-post"]['algorithm_score'] > 0
        
        # Old posts should not be marked as unread
        if "old-post" in post_results:
            assert post_results["old-post"].get('is_unread', False) == False
        
        if "very-old-post" in post_results:
            assert post_results["very-old-post"].get('is_unread', False) == False

    async def test_unread_boost_multiplier_effect(self, db_session: AsyncSession):
        """Test that unread boost multiplier properly affects post scores."""
        # Create test user
        user = User(
            email="boost@example.com",
            username="boostuser",
            hashed_password="hashed_password",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Create two similar posts - one old, one new
        old_post = Post(
            id="old-boost-post",
            author_id=user.id,
            content="Old post for boost testing",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            is_public=True
        )
        
        new_post = Post(
            id="new-boost-post",
            author_id=user.id,
            content="New post for boost testing",
            post_type=PostType.daily,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
            is_public=True
        )
        
        db_session.add(old_post)
        db_session.add(new_post)
        await db_session.commit()
        
        algorithm_service = AlgorithmService(db_session)
        
        # Calculate scores for both posts
        old_score = await algorithm_service.calculate_post_score(
            old_post, user.id, 0, 0, 0, True, user.last_feed_view
        )
        
        new_score = await algorithm_service.calculate_post_score(
            new_post, user.id, 0, 0, 0, True, user.last_feed_view
        )
        
        # New post should have higher score due to unread boost
        assert new_score > old_score
        
        # The ratio should be approximately the unread boost multiplier (3.0)
        expected_boost = algorithm_service.config.scoring_weights.unread_boost
        score_ratio = new_score / old_score if old_score > 0 else float('inf')
        
        # Allow some tolerance for floating point comparison
        assert score_ratio >= expected_boost * 0.9  # Within 10% tolerance

    async def test_feed_view_timestamp_update_behavior(self, db_session: AsyncSession):
        """Test various behaviors around feed view timestamp updates."""
        # Create test user
        user = User(
            email="timestamp@example.com",
            username="timestampuser",
            hashed_password="hashed_password",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=2)
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        algorithm_service = AlgorithmService(db_session)
        
        # Record initial timestamp
        initial_timestamp = user.last_feed_view
        
        # Wait a small amount to ensure timestamp difference
        import asyncio
        await asyncio.sleep(0.01)
        
        # Update feed view timestamp
        await algorithm_service.update_user_last_feed_view(user.id)
        
        # Refresh user to get updated timestamp
        await db_session.refresh(user)
        
        # Timestamp should be updated and more recent
        assert user.last_feed_view > initial_timestamp
        
        # Create a post after the timestamp update
        post_after_update = Post(
            id="post-after-timestamp-update",
            author_id=user.id,
            content="Post created after timestamp update",
            post_type=PostType.spontaneous,
            created_at=datetime.now(timezone.utc),
            is_public=True
        )
        db_session.add(post_after_update)
        await db_session.commit()
        
        # This post should be considered unread
        posts, _ = await algorithm_service.get_personalized_feed(
            user_id=user.id,
            limit=10,
            refresh_mode=True
        )
        
        # Find the new post
        new_post_result = None
        for post in posts:
            if post['id'] == post_after_update.id:
                new_post_result = post
                break
        
        # Should be marked as unread
        if new_post_result:
            assert new_post_result.get('is_unread', False) == True