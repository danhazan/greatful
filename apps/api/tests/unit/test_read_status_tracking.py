"""
Unit tests for read status tracking functionality.
"""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.algorithm_service import AlgorithmService
from app.models.user import User
from app.models.post import Post, PostType


class TestReadStatusTracking:
    """Test read status tracking functionality."""

    @pytest.fixture
    async def algorithm_service(self, db_session: AsyncSession):
        """Create AlgorithmService instance for testing."""
        return AlgorithmService(db_session)

    @pytest.fixture
    async def sample_user(self, db_session: AsyncSession):
        """Create a sample user for testing."""
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def sample_posts(self, db_session: AsyncSession, sample_user):
        """Create sample posts for testing."""
        posts = []
        for i in range(5):
            post = Post(
                id=f"test-post-{i}",
                author_id=sample_user.id,
                content=f"Test post {i}",
                post_type=PostType.daily,
                is_public=True
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        for post in posts:
            await db_session.refresh(post)
        return posts

    async def test_mark_posts_as_read(self, algorithm_service, sample_user, sample_posts):
        """Test marking posts as read."""
        user_id = sample_user.id
        post_ids = [post.id for post in sample_posts[:3]]
        
        # Initially no posts should be read
        assert len(algorithm_service.get_read_posts(user_id)) == 0
        
        # Mark posts as read
        algorithm_service.mark_posts_as_read(user_id, post_ids)
        
        # Verify posts are marked as read
        read_posts = algorithm_service.get_read_posts(user_id)
        assert len(read_posts) == 3
        assert all(post_id in read_posts for post_id in post_ids)

    async def test_is_post_read(self, algorithm_service, sample_user, sample_posts):
        """Test checking if individual posts are read."""
        user_id = sample_user.id
        post_id = sample_posts[0].id
        
        # Initially post should not be read
        assert not algorithm_service.is_post_read(user_id, post_id)
        
        # Mark post as read
        algorithm_service.mark_posts_as_read(user_id, [post_id])
        
        # Now post should be read
        assert algorithm_service.is_post_read(user_id, post_id)
        
        # Other posts should still not be read
        assert not algorithm_service.is_post_read(user_id, sample_posts[1].id)

    async def test_get_read_status_for_posts(self, algorithm_service, sample_user, sample_posts):
        """Test getting read status for multiple posts."""
        user_id = sample_user.id
        all_post_ids = [post.id for post in sample_posts]
        read_post_ids = all_post_ids[:2]
        
        # Mark some posts as read
        algorithm_service.mark_posts_as_read(user_id, read_post_ids)
        
        # Get read status for all posts
        read_status = algorithm_service.get_read_status_for_posts(user_id, all_post_ids)
        
        # Verify correct read status
        assert len(read_status) == len(all_post_ids)
        for post_id in read_post_ids:
            assert read_status[post_id] is True
        for post_id in all_post_ids[2:]:
            assert read_status[post_id] is False

    async def test_clear_read_status(self, algorithm_service, sample_user, sample_posts):
        """Test clearing all read status for a user."""
        user_id = sample_user.id
        post_ids = [post.id for post in sample_posts]
        
        # Mark all posts as read
        algorithm_service.mark_posts_as_read(user_id, post_ids)
        assert len(algorithm_service.get_read_posts(user_id)) == len(post_ids)
        
        # Clear read status
        algorithm_service.clear_read_status(user_id)
        
        # Verify all posts are now unread
        assert len(algorithm_service.get_read_posts(user_id)) == 0
        for post_id in post_ids:
            assert not algorithm_service.is_post_read(user_id, post_id)

    async def test_read_status_summary(self, algorithm_service, sample_user, sample_posts):
        """Test getting read status summary."""
        user_id = sample_user.id
        
        # Initially should have no reads
        summary = algorithm_service.get_read_status_summary(user_id)
        assert summary["read_count"] == 0
        assert len(summary["recent_reads"]) == 0
        
        # Mark some posts as read
        post_ids = [post.id for post in sample_posts[:3]]
        algorithm_service.mark_posts_as_read(user_id, post_ids)
        
        # Check updated summary
        summary = algorithm_service.get_read_status_summary(user_id)
        assert summary["read_count"] == 3
        assert len(summary["recent_reads"]) == 3
        
        # Verify recent reads structure
        for recent_read in summary["recent_reads"]:
            assert "post_id" in recent_read
            assert "read_at" in recent_read
            assert recent_read["post_id"] in post_ids

    async def test_read_status_isolation_between_users(self, algorithm_service, db_session):
        """Test that read status is isolated between different users."""
        # Create two users
        user1 = User(username="user1", email="user1@example.com", hashed_password="hash")
        user2 = User(username="user2", email="user2@example.com", hashed_password="hash")
        db_session.add(user1)
        db_session.add(user2)
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        # Create a post
        post = Post(
            id="shared-post",
            author_id=user1.id,
            content="Shared post",
            post_type=PostType.daily,
            is_public=True
        )
        db_session.add(post)
        await db_session.commit()
        
        # User1 marks post as read
        algorithm_service.mark_posts_as_read(user1.id, [post.id])
        
        # Verify isolation
        assert algorithm_service.is_post_read(user1.id, post.id)
        assert not algorithm_service.is_post_read(user2.id, post.id)
        
        # User2 marks post as read
        algorithm_service.mark_posts_as_read(user2.id, [post.id])
        
        # Both should now have it as read
        assert algorithm_service.is_post_read(user1.id, post.id)
        assert algorithm_service.is_post_read(user2.id, post.id)
        
        # Clear user1's read status
        algorithm_service.clear_read_status(user1.id)
        
        # Only user1's status should be cleared
        assert not algorithm_service.is_post_read(user1.id, post.id)
        assert algorithm_service.is_post_read(user2.id, post.id)

    async def test_read_status_affects_scoring(self, algorithm_service, sample_user, sample_posts):
        """Test that read status affects post scoring."""
        user_id = sample_user.id
        post = sample_posts[0]
        
        # Calculate initial score (unread)
        unread_score = await algorithm_service.calculate_post_score(
            post, user_id, hearts_count=5, reactions_count=3, shares_count=1, consider_read_status=True
        )
        
        # Mark post as read
        algorithm_service.mark_posts_as_read(user_id, [post.id])
        
        # Calculate score after reading
        read_score = await algorithm_service.calculate_post_score(
            post, user_id, hearts_count=5, reactions_count=3, shares_count=1, consider_read_status=True
        )
        
        # Read score should be lower than unread score
        assert read_score < unread_score
        
        # Calculate score without considering read status
        score_without_read_status = await algorithm_service.calculate_post_score(
            post, user_id, hearts_count=5, reactions_count=3, shares_count=1, consider_read_status=False
        )
        
        # Score without read status should equal original unread score
        assert abs(score_without_read_status - unread_score) < 0.01

    async def test_read_status_in_personalized_feed(self, algorithm_service, sample_user, sample_posts):
        """Test that read status affects personalized feed ranking."""
        user_id = sample_user.id
        
        # Get initial feed
        initial_feed, _ = await algorithm_service.get_personalized_feed(
            user_id, limit=10, algorithm_enabled=True, consider_read_status=True
        )
        
        # Mark first few posts as read
        read_post_ids = [post['id'] for post in initial_feed[:2]]
        algorithm_service.mark_posts_as_read(user_id, read_post_ids)
        
        # Get updated feed
        updated_feed, _ = await algorithm_service.get_personalized_feed(
            user_id, limit=10, algorithm_enabled=True, consider_read_status=True
        )
        
        # Verify read posts are marked correctly
        for post in updated_feed:
            if post['id'] in read_post_ids:
                assert post.get('is_read', False) is True
            else:
                assert post.get('is_read', False) is False

    async def test_read_status_disabled_in_feed(self, algorithm_service, sample_user, sample_posts):
        """Test feed behavior when read status consideration is disabled."""
        user_id = sample_user.id
        
        # Mark some posts as read
        algorithm_service.mark_posts_as_read(user_id, [sample_posts[0].id])
        
        # Get feed with read status consideration disabled
        feed_without_read_status, _ = await algorithm_service.get_personalized_feed(
            user_id, limit=10, algorithm_enabled=True, consider_read_status=False
        )
        
        # Get feed with read status consideration enabled
        feed_with_read_status, _ = await algorithm_service.get_personalized_feed(
            user_id, limit=10, algorithm_enabled=True, consider_read_status=True
        )
        
        # Both feeds should return posts, but potentially in different orders
        assert len(feed_without_read_status) > 0
        assert len(feed_with_read_status) > 0
        
        # When disabled, is_read should be False for all posts
        for post in feed_without_read_status:
            assert post.get('is_read', False) is False

    async def test_edge_cases(self, algorithm_service, sample_user):
        """Test edge cases for read status tracking."""
        user_id = sample_user.id
        
        # Test with empty post list
        algorithm_service.mark_posts_as_read(user_id, [])
        assert len(algorithm_service.get_read_posts(user_id)) == 0
        
        # Test with non-existent user
        non_existent_user_id = 99999
        assert len(algorithm_service.get_read_posts(non_existent_user_id)) == 0
        assert not algorithm_service.is_post_read(non_existent_user_id, "any-post-id")
        
        # Test with duplicate post IDs
        algorithm_service.mark_posts_as_read(user_id, ["post-1", "post-1", "post-2"])
        read_posts = algorithm_service.get_read_posts(user_id)
        assert len(read_posts) == 2
        assert "post-1" in read_posts
        assert "post-2" in read_posts

    async def test_read_status_persistence_simulation(self, algorithm_service, sample_user, sample_posts):
        """Test simulated persistence behavior (in-memory cache)."""
        user_id = sample_user.id
        post_ids = [post.id for post in sample_posts[:3]]
        
        # Mark posts as read
        algorithm_service.mark_posts_as_read(user_id, post_ids)
        
        # Verify they are read
        for post_id in post_ids:
            assert algorithm_service.is_post_read(user_id, post_id)
        
        # Simulate session reset by creating new service instance
        new_algorithm_service = AlgorithmService(algorithm_service.db)
        
        # Read status should be lost (in-memory only)
        for post_id in post_ids:
            assert not new_algorithm_service.is_post_read(user_id, post_id)
        
        # This demonstrates the need for localStorage or user preferences for persistence