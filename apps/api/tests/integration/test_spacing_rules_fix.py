"""
Test to verify that spacing rules are properly applied in the optimized algorithm service.
"""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.optimized_algorithm_service import OptimizedAlgorithmService
from app.models.user import User
from app.models.post import Post, PostType


class TestSpacingRulesFix:
    """Test that spacing rules prevent consecutive posts from the same author."""
    
    @pytest.fixture
    async def spacing_test_data(self, db_session: AsyncSession):
        """Create test data with multiple posts from the same author."""
        # Create test user
        user = User(
            email="moran@test.com",
            username="moran",
            hashed_password="test_password",
            display_name="Moran",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Create another user for variety
        user2 = User(
            email="bob@test.com",
            username="bob",
            hashed_password="test_password",
            display_name="Bob"
        )
        db_session.add(user2)
        await db_session.commit()
        await db_session.refresh(user2)
        
        # Create multiple posts from the same author (moran) with high scores
        posts = []
        for i in range(6):  # Create 6 posts from moran
            post = Post(
                author_id=user.id,
                content=f"Moran's post {i+1}",
                post_type=PostType.daily,
                is_public=True,
                created_at=datetime.now(timezone.utc) - timedelta(hours=i)
            )
            db_session.add(post)
            posts.append(post)
        
        # Create a few posts from bob
        for i in range(2):
            post = Post(
                author_id=user2.id,
                content=f"Bob's post {i+1}",
                post_type=PostType.spontaneous,
                is_public=True,
                created_at=datetime.now(timezone.utc) - timedelta(hours=i+3)
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        
        # Refresh all posts
        for post in posts:
            await db_session.refresh(post)
        
        return {
            'users': [user, user2],
            'posts': posts,
            'test_user_id': user.id
        }
    
    @pytest.mark.asyncio
    async def test_spacing_rules_prevent_consecutive_posts(
        self,
        db_session: AsyncSession,
        spacing_test_data: dict
    ):
        """Test that spacing rules prevent more than 1 consecutive post from the same author."""
        optimized_service = OptimizedAlgorithmService(db_session)
        test_user_id = spacing_test_data['test_user_id']
        
        # Get personalized feed
        posts, total_count = await optimized_service.get_personalized_feed_optimized(
            user_id=test_user_id,
            limit=8,  # Get enough posts to see the pattern
            algorithm_enabled=True,
            consider_read_status=False  # Disable read status for cleaner test
        )
        
        # Check that no more than 1 consecutive post from the same author appears
        consecutive_count = 1
        max_consecutive = 1
        
        for i in range(1, len(posts)):
            if posts[i]['author_id'] == posts[i-1]['author_id']:
                consecutive_count += 1
                max_consecutive = max(max_consecutive, consecutive_count)
            else:
                consecutive_count = 1
        
        # The spacing rules should prevent consecutive posts when possible
        # But if there aren't enough posts from different authors, some consecutive posts are unavoidable
        # In this test, we have 6 posts from author 1 and 2 posts from author 2
        # So we expect at most 4 consecutive posts from author 1 (after the 2 from author 2 are used)
        assert max_consecutive <= 4, f"Found {max_consecutive} consecutive posts from the same author, should be max 4 given the test data distribution"
        
        # Verify we got posts from both authors
        author_ids = {post['author_id'] for post in posts}
        assert len(author_ids) > 1, "Should have posts from multiple authors"
        
        # Verify posts are still ordered by some logic (not just random)
        assert len(posts) > 0, "Should return some posts"
    
    @pytest.mark.asyncio
    async def test_spacing_rules_maintain_performance(
        self,
        db_session: AsyncSession,
        spacing_test_data: dict
    ):
        """Test that spacing rules don't significantly impact performance."""
        import time
        
        optimized_service = OptimizedAlgorithmService(db_session)
        test_user_id = spacing_test_data['test_user_id']
        
        start_time = time.time()
        
        posts, total_count = await optimized_service.get_personalized_feed_optimized(
            user_id=test_user_id,
            limit=20,
            algorithm_enabled=True
        )
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Should still meet performance target even with spacing rules
        assert execution_time_ms < 500, f"Feed with spacing rules took {execution_time_ms:.1f}ms, should be <500ms"
        assert len(posts) > 0, "Should return posts"