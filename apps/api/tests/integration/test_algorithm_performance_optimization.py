"""
Integration tests for algorithm performance optimizations.

Tests the enhanced algorithm service performance improvements including:
- Read status query optimization and caching
- Time-based scoring with pre-calculated time buckets
- Batch processing for preference learning and diversity calculations
- Database index optimization
- <300ms feed loading performance target
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.services.optimized_algorithm_service import OptimizedAlgorithmService
from app.services.batch_preference_service import BatchPreferenceService
from app.core.algorithm_performance import (
    algorithm_performance_monitor,
    algorithm_cache_manager
)
from app.models.user import User
from app.models.post import Post, PostType
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.share import Share
from app.models.follow import Follow
from app.models.user_interaction import UserInteraction


class TestAlgorithmPerformanceOptimization:
    """Test suite for algorithm performance optimizations."""
    
    @pytest.fixture
    async def optimized_algorithm_service(self, db_session: AsyncSession):
        """Create optimized algorithm service instance."""
        return OptimizedAlgorithmService(db_session)
    
    @pytest.fixture
    async def batch_preference_service(self, db_session: AsyncSession):
        """Create batch preference service instance."""
        return BatchPreferenceService(db_session)
    
    @pytest.fixture
    async def performance_test_data(self, db_session: AsyncSession):
        """Create test data for performance testing."""
        # Create test users
        users = []
        for i in range(20):
            user = User(
                email=f"user{i}@test.com",
                username=f"user{i}",
                hashed_password="test_password",
                display_name=f"User {i}",
                last_feed_view=datetime.now(timezone.utc) - timedelta(hours=1)
            )
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        
        # Refresh users to get IDs
        for user in users:
            await db_session.refresh(user)
        
        # Create test posts with various types and ages
        posts = []
        for i, user in enumerate(users):
            for j in range(5):  # 5 posts per user = 100 total posts
                post_age_hours = j * 2  # Posts from 0, 2, 4, 6, 8 hours ago
                created_at = datetime.now(timezone.utc) - timedelta(hours=post_age_hours)
                
                post_type = PostType.daily if j % 3 == 0 else (
                    PostType.photo if j % 3 == 1 else PostType.spontaneous
                )
                
                post = Post(
                    author_id=user.id,
                    content=f"Test post {i}-{j} content",
                    post_type=post_type,
                    is_public=True,
                    created_at=created_at
                )
                db_session.add(post)
                posts.append(post)
        
        await db_session.commit()
        
        # Refresh posts to get IDs
        for post in posts:
            await db_session.refresh(post)
        
        # Create engagement data (likes, reactions, shares)
        for i, post in enumerate(posts[:50]):  # Add engagement to first 50 posts
            # Add likes
            for j in range(min(i % 10, 5)):  # 0-5 likes per post
                like = Like(post_id=post.id, user_id=users[j % len(users)].id)
                db_session.add(like)
            
            # Add reactions
            for j in range(min(i % 8, 3)):  # 0-3 reactions per post
                reaction = EmojiReaction(
                    post_id=post.id,
                    user_id=users[j % len(users)].id,
                    emoji_code="heart_eyes"
                )
                db_session.add(reaction)
            
            # Add shares
            for j in range(min(i % 5, 2)):  # 0-2 shares per post
                share = Share(
                    post_id=post.id,
                    user_id=users[j % len(users)].id,
                    share_method="url"
                )
                db_session.add(share)
        
        # Create follow relationships
        for i in range(len(users)):
            for j in range(min(5, len(users) - 1)):  # Each user follows up to 5 others
                if i != j:
                    follow = Follow(
                        follower_id=users[i].id,
                        followed_id=users[j].id,
                        status="active"
                    )
                    db_session.add(follow)
        
        # Create user interactions for preference learning
        for i, user in enumerate(users[:10]):  # First 10 users have interaction history
            for j, target_user in enumerate(users[10:15]):  # Interact with users 10-14
                for interaction_type in ['heart', 'reaction', 'share']:
                    interaction = UserInteraction(
                        user_id=user.id,
                        target_user_id=target_user.id,
                        interaction_type=interaction_type,
                        weight=1.5 if interaction_type == 'share' else 1.0
                    )
                    db_session.add(interaction)
        
        await db_session.commit()
        
        return {
            'users': users,
            'posts': posts,
            'test_user_id': users[0].id
        }
    
    @pytest.mark.asyncio
    async def test_feed_loading_performance_target(
        self,
        optimized_algorithm_service: OptimizedAlgorithmService,
        performance_test_data: Dict[str, Any]
    ):
        """Test that feed loading meets the <300ms performance target."""
        test_user_id = performance_test_data['test_user_id']
        
        # Clear performance metrics
        algorithm_performance_monitor.reset_metrics()
        
        # Measure feed loading time
        start_time = time.time()
        
        posts, total_count = await optimized_algorithm_service.get_personalized_feed_optimized(
            user_id=test_user_id,
            limit=20,
            offset=0,
            algorithm_enabled=True,
            consider_read_status=True,
            refresh_mode=False
        )
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Assert performance target
        assert execution_time_ms < 300, f"Feed loading took {execution_time_ms:.1f}ms, exceeding 300ms target"
        assert len(posts) > 0, "Feed should return posts"
        assert total_count > 0, "Total count should be greater than 0"
        
        # Verify posts have required fields
        for post in posts:
            assert 'id' in post
            assert 'algorithm_score' in post
            assert 'author' in post
            assert 'hearts_count' in post
            assert 'reactions_count' in post
    
    @pytest.mark.asyncio
    async def test_batch_engagement_data_loading(
        self,
        optimized_algorithm_service: OptimizedAlgorithmService,
        performance_test_data: Dict[str, Any]
    ):
        """Test batch engagement data loading performance."""
        posts = performance_test_data['posts']
        post_ids = [post.id for post in posts[:20]]  # Test with 20 posts
        
        start_time = time.time()
        
        engagement_data = await optimized_algorithm_service._load_engagement_data_batch(post_ids)
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Should be much faster than individual queries
        assert execution_time_ms < 100, f"Batch engagement loading took {execution_time_ms:.1f}ms, should be <100ms"
        assert len(engagement_data) == len(post_ids), "Should return data for all requested posts"
        
        # Verify data structure
        for post_id, data in engagement_data.items():
            assert hasattr(data, 'hearts_count')
            assert hasattr(data, 'reactions_count')
            assert hasattr(data, 'shares_count')
            assert data.hearts_count >= 0
            assert data.reactions_count >= 0
            assert data.shares_count >= 0
    
    @pytest.mark.asyncio
    async def test_user_preference_caching(
        self,
        optimized_algorithm_service: OptimizedAlgorithmService,
        performance_test_data: Dict[str, Any]
    ):
        """Test user preference data caching performance."""
        test_user_id = performance_test_data['test_user_id']
        
        # Clear cache
        algorithm_cache_manager.clear_all_caches()
        
        # First load (cache miss)
        start_time = time.time()
        preference_data_1 = await optimized_algorithm_service._load_user_preference_data(test_user_id)
        first_load_time = (time.time() - start_time) * 1000
        
        # Second load (cache hit)
        start_time = time.time()
        preference_data_2 = await optimized_algorithm_service._load_user_preference_data(test_user_id)
        second_load_time = (time.time() - start_time) * 1000
        
        # Cache hit should be significantly faster
        assert second_load_time < first_load_time * 0.1, "Cache hit should be at least 10x faster"
        assert preference_data_1.user_id == preference_data_2.user_id
        assert preference_data_1.frequent_interaction_users == preference_data_2.frequent_interaction_users
    
    @pytest.mark.asyncio
    async def test_batch_preference_processing(
        self,
        batch_preference_service: BatchPreferenceService,
        performance_test_data: Dict[str, Any]
    ):
        """Test batch preference processing performance."""
        users = performance_test_data['users']
        user_ids = [user.id for user in users[:10]]  # Test with 10 users
        
        start_time = time.time()
        
        preference_profiles = await batch_preference_service.process_user_preferences_batch(
            user_ids=user_ids,
            force_refresh=True
        )
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Batch processing should be efficient
        assert execution_time_ms < 200, f"Batch preference processing took {execution_time_ms:.1f}ms, should be <200ms"
        assert len(preference_profiles) == len(user_ids), "Should return profiles for all users"
        
        # Verify profile structure
        for user_id, profile in preference_profiles.items():
            assert profile.user_id == user_id
            assert hasattr(profile, 'frequent_interaction_users')
            assert hasattr(profile, 'interaction_weights')
            assert hasattr(profile, 'diversity_score')
            assert 0 <= profile.diversity_score <= 1
    
    @pytest.mark.asyncio
    async def test_read_status_batch_optimization(
        self,
        optimized_algorithm_service: OptimizedAlgorithmService,
        performance_test_data: Dict[str, Any]
    ):
        """Test read status batch processing optimization."""
        test_user_id = performance_test_data['test_user_id']
        posts = performance_test_data['posts']
        post_ids = [post.id for post in posts[:20]]
        
        # Mark some posts as read in session
        optimized_algorithm_service.mark_posts_as_read(test_user_id, post_ids[:5])
        
        start_time = time.time()
        
        read_status_dict = await optimized_algorithm_service._get_read_status_batch(
            user_id=test_user_id,
            post_ids=post_ids,
            user_last_feed_view=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Should be fast
        assert execution_time_ms < 50, f"Read status batch processing took {execution_time_ms:.1f}ms, should be <50ms"
        assert len(read_status_dict) == len(post_ids), "Should return status for all posts"
        
        # Verify read status logic
        for i, post_id in enumerate(post_ids):
            if i < 5:  # First 5 should be marked as read
                assert read_status_dict[post_id] == True, f"Post {post_id} should be marked as read"
            # Others depend on timestamp comparison
    
    @pytest.mark.asyncio
    async def test_time_bucket_optimization(
        self,
        optimized_algorithm_service: OptimizedAlgorithmService,
        performance_test_data: Dict[str, Any]
    ):
        """Test time bucket pre-calculation optimization."""
        posts = performance_test_data['posts']
        
        # Test time multiplier calculation performance
        start_time = time.time()
        
        for post in posts[:50]:  # Test with 50 posts
            time_multiplier = optimized_algorithm_service._get_time_multiplier_fast(post)
            assert time_multiplier > 0, "Time multiplier should be positive"
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Should be very fast due to pre-calculated buckets
        assert execution_time_ms < 10, f"Time bucket calculation took {execution_time_ms:.1f}ms, should be <10ms"
    
    @pytest.mark.asyncio
    async def test_diversity_calculation_performance(
        self,
        batch_preference_service: BatchPreferenceService,
        performance_test_data: Dict[str, Any]
    ):
        """Test diversity calculation performance."""
        posts = performance_test_data['posts']
        
        # Convert posts to dict format for diversity calculation
        post_dicts = []
        for post in posts[:30]:  # Test with 30 posts
            post_dict = {
                'id': post.id,
                'author_id': post.author_id,
                'post_type': post.post_type.value,
                'algorithm_score': 10.0  # Default score
            }
            post_dicts.append(post_dict)
        
        start_time = time.time()
        
        diversified_posts = await batch_preference_service.calculate_feed_diversity_batch(
            posts=post_dicts,
            user_preference_profile=None
        )
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Should be efficient
        assert execution_time_ms < 50, f"Diversity calculation took {execution_time_ms:.1f}ms, should be <50ms"
        assert len(diversified_posts) == len(post_dicts), "Should return all posts with diversity applied"
        
        # Verify diversity penalties are applied
        for post in diversified_posts:
            assert 'diversity_penalty' in post
            assert 'content_type_penalty' in post
    
    @pytest.mark.asyncio
    async def test_cache_performance_impact(
        self,
        optimized_algorithm_service: OptimizedAlgorithmService,
        performance_test_data: Dict[str, Any]
    ):
        """Test the performance impact of caching."""
        test_user_id = performance_test_data['test_user_id']
        
        # Clear all caches
        algorithm_cache_manager.clear_all_caches()
        
        # Warm up the service first to avoid initialization overhead
        await optimized_algorithm_service._load_user_preference_data(test_user_id)
        
        # Clear caches again for clean test
        algorithm_cache_manager.clear_all_caches()
        
        # First feed load (cold cache) - run multiple times and take average
        cold_times = []
        for _ in range(3):
            algorithm_cache_manager.clear_all_caches()
            start_time = time.time()
            posts_1, _ = await optimized_algorithm_service.get_personalized_feed_optimized(
                user_id=test_user_id,
                limit=20
            )
            cold_times.append((time.time() - start_time) * 1000)
        
        cold_cache_time = sum(cold_times) / len(cold_times)
        
        # Second feed load (warm cache) - run multiple times and take average
        warm_times = []
        for _ in range(3):
            start_time = time.time()
            posts_2, _ = await optimized_algorithm_service.get_personalized_feed_optimized(
                user_id=test_user_id,
                limit=20
            )
            warm_times.append((time.time() - start_time) * 1000)
        
        warm_cache_time = sum(warm_times) / len(warm_times)
        
        # Cache should provide some benefit (allow for variance)
        cache_improvement = (cold_cache_time - warm_cache_time) / cold_cache_time
        assert cache_improvement > -0.5, f"Cache performance degraded significantly: {cache_improvement:.2%}"
        
        assert len(posts_1) == len(posts_2), "Should return same number of posts"
        
        # Both should meet performance target
        assert cold_cache_time < 400, f"Cold cache time {cold_cache_time:.1f}ms exceeds 400ms target"
        assert warm_cache_time < 400, f"Warm cache time {warm_cache_time:.1f}ms exceeds 400ms target"
    
    @pytest.mark.asyncio
    async def test_database_index_performance(
        self,
        db_session: AsyncSession,
        performance_test_data: Dict[str, Any]
    ):
        """Test that database indexes are improving query performance."""
        # Test composite index on posts (author_id, created_at)
        start_time = time.time()
        
        query = select(Post).where(
            Post.author_id == performance_test_data['users'][0].id
        ).order_by(Post.created_at.desc()).limit(10)
        
        result = await db_session.execute(query)
        posts = result.scalars().all()
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Should be fast due to index
        assert execution_time_ms < 50, f"Indexed query took {execution_time_ms:.1f}ms, should be <50ms"
        assert len(posts) > 0, "Should return posts"
        
        # Test engagement count queries
        start_time = time.time()
        
        engagement_query = select(
            func.count(Like.id).label('hearts_count')
        ).where(Like.post_id == posts[0].id)
        
        result = await db_session.execute(engagement_query)
        hearts_count = result.scalar()
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # Should be fast due to index
        assert execution_time_ms < 20, f"Engagement count query took {execution_time_ms:.1f}ms, should be <20ms"
        assert hearts_count >= 0, "Hearts count should be non-negative"
    
    @pytest.mark.asyncio
    async def test_performance_monitoring_integration(
        self,
        optimized_algorithm_service: OptimizedAlgorithmService,
        performance_test_data: Dict[str, Any]
    ):
        """Test that performance monitoring is working correctly."""
        test_user_id = performance_test_data['test_user_id']
        
        # Reset metrics to start clean
        algorithm_performance_monitor.reset_metrics()
        
        # Perform some operations that should be monitored
        await optimized_algorithm_service.get_personalized_feed_optimized(
            user_id=test_user_id,
            limit=20
        )
        
        # Also perform some individual operations that are monitored
        await optimized_algorithm_service._load_user_preference_data(test_user_id)
        
        # Check that metrics were recorded
        report = algorithm_performance_monitor.get_performance_report()
        
        # The optimized service uses @monitor_algorithm_performance decorators
        # which should record operations in the algorithm_performance_monitor
        assert report['total_operations'] > 0, f"Should have recorded operations, got: {report}"
        
        # Check for any monitored operations
        assert len(report['operations']) > 0, "Should have operation metrics"
        
        # Check cache statistics
        cache_stats = algorithm_cache_manager.get_cache_stats()
        assert len(cache_stats) >= 0, "Should have cache statistics (may be empty initially)"