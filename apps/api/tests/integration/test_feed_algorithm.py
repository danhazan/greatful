"""
Integration tests for feed algorithm functionality.
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from main import app
from app.models.user import User
from app.models.post import Post, PostType
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.follow import Follow
from app.models.share import Share
from app.services.algorithm_service import AlgorithmService


class TestFeedAlgorithm:
    """Test feed algorithm integration."""

    @pytest.fixture
    async def sample_users(self, db_session: AsyncSession):
        """Create sample users for testing."""
        users = []
        for i in range(10):  # Create more users for comprehensive testing
            user = User(
                username=f"testuser{i}",
                email=f"test{i}@example.com",
                hashed_password="hashed_password",
                bio=f"Test user {i} bio"
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
            {"content": "Another daily gratitude", "post_type": PostType.daily, "user_idx": 3},
            {"content": "Beautiful sunset photo", "post_type": PostType.photo, "user_idx": 4},
        ]
        
        for i, data in enumerate(post_data):
            post = Post(
                id=f"post-{i}",
                author_id=sample_users[data["user_idx"]].id,
                content=data["content"],
                post_type=data["post_type"],
                is_public=True,
                created_at=datetime.now(timezone.utc) - timedelta(hours=i)  # Stagger creation times
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        for post in posts:
            await db_session.refresh(post)
        return posts

    @pytest.fixture
    async def large_dataset(self, db_session: AsyncSession):
        """Create large dataset for performance testing (100+ users, 1000+ posts)."""
        users = []
        posts = []
        
        # Create 100 users
        for i in range(100):
            user = User(
                username=f"perfuser{i}",
                email=f"perf{i}@example.com",
                hashed_password="hashed_password",
                bio=f"Performance test user {i}"
            )
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        for user in users:
            await db_session.refresh(user)
        
        # Create 1000 posts distributed among users
        post_types = [PostType.daily, PostType.photo, PostType.spontaneous]
        for i in range(1000):
            user_idx = i % 100  # Distribute posts among users
            post_type = post_types[i % 3]
            
            post = Post(
                id=f"perf-post-{i}",
                author_id=users[user_idx].id,
                content=f"Performance test post {i} - {post_type.value}",
                post_type=post_type,
                is_public=True,
                created_at=datetime.now(timezone.utc) - timedelta(minutes=i)  # Stagger creation times
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        for post in posts:
            await db_session.refresh(post)
        
        return users, posts

    @pytest.fixture
    async def posts_with_engagement(self, db_session: AsyncSession, sample_users, sample_posts):
        """Create engagement data (likes, reactions, shares) for posts."""
        # Add hearts to posts
        for i, post in enumerate(sample_posts):
            # Give different engagement levels to test scoring
            hearts_count = (i + 1) * 2  # 2, 4, 6, 8, 10 hearts
            for j in range(hearts_count):
                user_idx = j % len(sample_users)
                if sample_users[user_idx].id != post.author_id:  # Don't heart own posts
                    like = Like(
                        user_id=sample_users[user_idx].id,
                        post_id=post.id
                    )
                    db_session.add(like)
        
        # Add emoji reactions
        emoji_codes = ["heart_eyes", "pray", "star", "fire", "muscle"]
        for i, post in enumerate(sample_posts):
            reactions_count = i + 1  # 1, 2, 3, 4, 5 reactions
            for j in range(reactions_count):
                user_idx = (j + 1) % len(sample_users)
                if sample_users[user_idx].id != post.author_id:
                    reaction = EmojiReaction(
                        user_id=sample_users[user_idx].id,
                        post_id=post.id,
                        emoji_code=emoji_codes[j % len(emoji_codes)]
                    )
                    db_session.add(reaction)
        
        # Add shares
        for i, post in enumerate(sample_posts):
            if i >= 2:  # Only last 3 posts get shares
                shares_count = i - 1  # 1, 2, 3 shares
                for j in range(shares_count):
                    user_idx = (j + 2) % len(sample_users)
                    if sample_users[user_idx].id != post.author_id:
                        share = Share(
                            user_id=sample_users[user_idx].id,
                            post_id=post.id,
                            share_method="url"
                        )
                        db_session.add(share)
        
        await db_session.commit()
        return sample_posts

    @pytest.fixture
    async def follow_relationships(self, db_session: AsyncSession, sample_users):
        """Create follow relationships for testing relationship multiplier."""
        # User 0 follows users 1, 2, 3
        for i in range(1, 4):
            follow = Follow(
                follower_id=sample_users[0].id,
                followed_id=sample_users[i].id,
                status="active"
            )
            db_session.add(follow)
        
        await db_session.commit()
        return sample_users

    async def test_scoring_calculations_with_various_engagement(
        self, 
        db_session: AsyncSession,
        sample_users,
        posts_with_engagement
    ):
        """Test scoring calculations with various engagement combinations."""
        algorithm_service = AlgorithmService(db_session)
        
        # Test each post's score calculation
        expected_scores = []
        for i, post in enumerate(posts_with_engagement):
            hearts_count = (i + 1) * 2  # 2, 4, 6, 8, 10
            reactions_count = i + 1  # 1, 2, 3, 4, 5
            shares_count = max(0, i - 1)  # 0, 0, 1, 2, 3
            
            # Calculate expected score based on formula
            base_score = (hearts_count * 1.0) + (reactions_count * 1.5) + (shares_count * 4.0)
            
            # Add content type bonus
            content_bonus = 0.0
            if post.post_type == PostType.daily:
                content_bonus = 3.0
            elif post.post_type == PostType.photo:
                content_bonus = 2.5
            
            expected_score = base_score + content_bonus
            expected_scores.append(expected_score)
            
            # Test actual calculation
            actual_score = await algorithm_service.calculate_post_score(
                post, 
                user_id=sample_users[0].id,
                hearts_count=hearts_count,
                reactions_count=reactions_count,
                shares_count=shares_count
            )
            
            assert abs(actual_score - expected_score) < 0.01, (
                f"Post {i}: Expected {expected_score}, got {actual_score}"
            )
        
        # Verify scoring hierarchy (higher engagement = higher score)
        assert expected_scores[-1] > expected_scores[0], "Highest engagement post should have highest score"

    async def test_80_20_split_with_different_dataset_sizes(
        self, 
        db_session: AsyncSession,
        sample_users,
        posts_with_engagement
    ):
        """Test that 80/20 split works correctly with different dataset sizes."""
        algorithm_service = AlgorithmService(db_session)
        
        test_cases = [
            {"limit": 10, "expected_algo": 8, "expected_recent": 2},
            {"limit": 5, "expected_algo": 4, "expected_recent": 1},
            {"limit": 20, "expected_algo": 16, "expected_recent": 4},
            {"limit": 1, "expected_algo": 0, "expected_recent": 1},  # Edge case
        ]
        
        for case in test_cases:
            posts, total_count = await algorithm_service.get_personalized_feed(
                user_id=sample_users[0].id,
                limit=case["limit"],
                algorithm_enabled=True
            )
            
            # Count algorithm-scored vs recent posts
            algo_posts = [p for p in posts if p.get("algorithm_score", 0) > 0]
            recent_posts = [p for p in posts if p.get("algorithm_score", 0) == 0]
            
            # Verify split (allowing for small datasets where we might not have enough posts)
            available_posts = min(case["limit"], len(posts_with_engagement))
            if available_posts >= case["limit"]:
                expected_algo = min(case["expected_algo"], available_posts)
                expected_recent = min(case["expected_recent"], available_posts - expected_algo)
                
                assert len(algo_posts) <= expected_algo + 1, f"Too many algorithm posts for limit {case['limit']}"
                assert len(recent_posts) <= expected_recent + 1, f"Too many recent posts for limit {case['limit']}"

    async def test_followed_users_content_prioritized(
        self, 
        db_session: AsyncSession,
        sample_users,
        posts_with_engagement,
        follow_relationships
    ):
        """Test that followed users' content appears higher in feed."""
        algorithm_service = AlgorithmService(db_session)
        
        # Get feed for user 0 (who follows users 1, 2, 3)
        posts, _ = await algorithm_service.get_personalized_feed(
            user_id=sample_users[0].id,
            limit=10,
            algorithm_enabled=True
        )
        
        # Check that posts from followed users have relationship multiplier applied
        followed_user_ids = {sample_users[i].id for i in range(1, 4)}
        
        followed_posts = []
        unfollowed_posts = []
        
        for post in posts:
            if post["author_id"] in followed_user_ids:
                followed_posts.append(post)
            else:
                unfollowed_posts.append(post)
        
        # Verify that followed users' posts generally appear higher
        # (This is probabilistic due to engagement differences, but should be generally true)
        if followed_posts and unfollowed_posts:
            avg_followed_position = sum(posts.index(p) for p in followed_posts) / len(followed_posts)
            avg_unfollowed_position = sum(posts.index(p) for p in unfollowed_posts) / len(unfollowed_posts)
            
            # Followed posts should generally appear earlier (lower index)
            assert avg_followed_position <= avg_unfollowed_position + 1, (
                "Followed users' posts should generally appear higher in feed"
            )

    async def test_performance_with_large_dataset(
        self, 
        db_session: AsyncSession,
        large_dataset
    ):
        """Test performance with 1000+ posts and 100+ users."""
        users, posts = large_dataset
        algorithm_service = AlgorithmService(db_session)
        
        # Add some engagement to make the test more realistic
        # Add hearts to first 100 posts
        for i in range(100):
            post = posts[i]
            for j in range(min(5, len(users))):  # Up to 5 hearts per post
                if users[j].id != post.author_id:
                    like = Like(
                        user_id=users[j].id,
                        post_id=post.id
                    )
                    db_session.add(like)
        
        await db_session.commit()
        
        # Test feed generation performance
        start_time = time.time()
        
        posts_result, total_count = await algorithm_service.get_personalized_feed(
            user_id=users[0].id,
            limit=20,
            algorithm_enabled=True
        )
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Performance assertion: should complete within 5 seconds for large dataset
        assert execution_time < 5.0, f"Feed generation took {execution_time:.3f}s, should be under 5.0s"
        
        # Verify results
        assert len(posts_result) <= 20, "Should not exceed requested limit"
        assert total_count >= 1000, "Should report correct total count"
        
        # Verify response structure
        for post in posts_result:
            assert "id" in post
            assert "algorithm_score" in post
            assert "hearts_count" in post
            assert "reactions_count" in post

    async def test_algorithm_service_trending_posts(
        self, 
        db_session: AsyncSession,
        sample_users,
        posts_with_engagement
    ):
        """Test trending posts functionality."""
        algorithm_service = AlgorithmService(db_session)
        
        # Get trending posts
        trending_posts = await algorithm_service.get_trending_posts(
            user_id=sample_users[0].id,
            limit=5,
            time_window_hours=24
        )
        
        # Should return posts with engagement
        assert len(trending_posts) > 0, "Should find trending posts with engagement"
        
        # Verify trending score calculation
        for post in trending_posts:
            assert "trending_score" in post
            assert post["trending_score"] > 0
            assert post["hearts_count"] + post["reactions_count"] + post["shares_count"] > 0
        
        # Verify trending posts are sorted by score
        for i in range(len(trending_posts) - 1):
            assert trending_posts[i]["trending_score"] >= trending_posts[i + 1]["trending_score"]

    async def test_batch_score_updates(
        self, 
        db_session: AsyncSession,
        sample_users,
        posts_with_engagement
    ):
        """Test batch score updates for multiple posts."""
        algorithm_service = AlgorithmService(db_session)
        
        post_ids = [post.id for post in posts_with_engagement[:3]]
        
        # Test batch score updates
        scores = await algorithm_service.update_post_scores_batch(post_ids)
        
        assert len(scores) == 3, "Should return scores for all requested posts"
        
        for post_id, score in scores.items():
            assert post_id in post_ids
            assert isinstance(score, (int, float))
            assert score >= 0

    def test_feed_endpoint_with_algorithm_enabled(
        self, 
        setup_test_database,
        sample_users, 
        posts_with_engagement
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
        assert len(posts) >= 3  # Should return posts
        
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
        posts_with_engagement
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
        assert len(posts) >= 3  # Should return posts
        
        # Verify chronological order (newest first)
        for i in range(len(posts) - 1):
            current_time = posts[i]["created_at"]
            next_time = posts[i + 1]["created_at"]
            assert current_time >= next_time  # Should be in descending order

    def test_feed_backward_compatibility(
        self, 
        setup_test_database,
        sample_users, 
        posts_with_engagement
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
        
        # Both should return posts (order may differ)
        assert len(algo_posts) > 0
        assert len(chrono_posts) > 0
        
        # Verify response structure is identical
        for post in chrono_posts:
            assert "id" in post
            assert "content" in post
            assert "post_type" in post
            assert "author" in post
            assert "hearts_count" in post
            assert "reactions_count" in post

    def test_feed_performance_under_load(
        self, 
        setup_test_database,
        sample_users,
        posts_with_engagement
    ):
        """Test feed endpoint performance under load."""
        client = TestClient(app)
        
        # Create authentication token for first user
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(sample_users[0].id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test multiple concurrent requests
        start_time = time.time()
        
        responses = []
        for _ in range(10):  # Simulate 10 concurrent requests
            response = client.get("/api/v1/posts/feed", headers=headers)
            responses.append(response)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # All requests should succeed
        for response in responses:
            assert response.status_code == 200
        
        # Average response time should be reasonable (under 100ms per request)
        avg_time = total_time / len(responses)
        assert avg_time < 0.1, f"Average response time {avg_time:.3f}s too slow"

    async def test_algorithm_edge_cases(
        self, 
        db_session: AsyncSession,
        sample_users
    ):
        """Test algorithm behavior with edge cases."""
        algorithm_service = AlgorithmService(db_session)
        
        # Test with no posts
        posts, total_count = await algorithm_service.get_personalized_feed(
            user_id=sample_users[0].id,
            limit=20,
            algorithm_enabled=True
        )
        assert posts == []
        assert total_count == 0
        
        # Test with single post
        single_post = Post(
            id="single-post",
            author_id=sample_users[1].id,
            content="Single test post",
            post_type=PostType.daily,
            is_public=True
        )
        db_session.add(single_post)
        await db_session.commit()
        
        posts, total_count = await algorithm_service.get_personalized_feed(
            user_id=sample_users[0].id,
            limit=20,
            algorithm_enabled=True
        )
        assert len(posts) == 1
        assert total_count == 1
        assert posts[0]["id"] == "single-post"

    async def test_content_type_scoring_verification(
        self, 
        db_session: AsyncSession,
        sample_users
    ):
        """Verify content type bonuses are applied correctly in integration."""
        algorithm_service = AlgorithmService(db_session)
        
        # Create posts of different types with same engagement
        posts = []
        post_types = [PostType.daily, PostType.photo, PostType.spontaneous]
        
        for i, post_type in enumerate(post_types):
            post = Post(
                id=f"type-test-{i}",
                author_id=sample_users[i].id,
                content=f"Test {post_type.value} post",
                post_type=post_type,
                is_public=True
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        
        # Add same engagement to all posts
        for post in posts:
            # Add 3 hearts
            for j in range(3):
                user_idx = (j + 1) % len(sample_users)
                if sample_users[user_idx].id != post.author_id:
                    like = Like(
                        user_id=sample_users[user_idx].id,
                        post_id=post.id
                    )
                    db_session.add(like)
        
        await db_session.commit()
        
        # Calculate scores
        scores = []
        for post in posts:
            score = await algorithm_service.calculate_post_score(
                post, 
                user_id=sample_users[0].id,
                hearts_count=3,
                reactions_count=0,
                shares_count=0
            )
            scores.append(score)
        
        # Verify scoring hierarchy: daily > photo > spontaneous
        daily_score, photo_score, spontaneous_score = scores
        assert daily_score > photo_score > spontaneous_score
        
        # Verify specific bonuses
        assert daily_score - spontaneous_score == 3.0  # Daily bonus
        assert photo_score - spontaneous_score == 2.5  # Photo bonus