"""
Load testing configuration and fixtures.

This module provides shared fixtures and utilities for load testing
the Grateful API under production-like conditions.
"""

import pytest
import asyncio
import time
import random
import uuid
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
import httpx
import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.core.database import get_db
from app.models.user import User
from app.models.post import Post, PostType
from app.models.emoji_reaction import EmojiReaction
from app.models.share import Share
from app.models.follow import Follow
from app.models.notification import Notification

# Set environment variable to disable rate limiting during load tests
# This must be set before importing any modules that use rate limiting
import os
os.environ['LOAD_TESTING'] = 'true'
os.environ['TESTING'] = 'true'

# Import test token utilities
from app.utils.test_tokens import create_access_token_for_user, create_token_batch


class LoadTestMetrics:
    """Collect and analyze load test metrics."""
    
    def __init__(self):
        self.response_times = []
        self.error_count = 0
        self.success_count = 0
        self.start_time = None
        self.end_time = None
        self.concurrent_users = 0
        self.operations_per_second = 0
        
    def start_test(self, concurrent_users: int):
        """Start metrics collection."""
        self.start_time = time.time()
        self.concurrent_users = concurrent_users
        self.response_times = []
        self.error_count = 0
        self.success_count = 0
        
    def record_response(self, response_time: float, success: bool):
        """Record a response time and success status."""
        self.response_times.append(response_time)
        if success:
            self.success_count += 1
        else:
            self.error_count += 1
            
    def end_test(self):
        """End metrics collection and calculate final stats."""
        self.end_time = time.time()
        total_time = self.end_time - self.start_time
        total_operations = len(self.response_times)
        self.operations_per_second = total_operations / total_time if total_time > 0 else 0
        
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive test statistics."""
        if not self.response_times:
            return {"error": "No response times recorded"}
            
        sorted_times = sorted(self.response_times)
        total_operations = len(self.response_times)
        
        return {
            "total_operations": total_operations,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "success_rate": self.success_count / total_operations if total_operations > 0 else 0,
            "concurrent_users": self.concurrent_users,
            "operations_per_second": self.operations_per_second,
            "response_times": {
                "min_ms": min(sorted_times) * 1000,
                "max_ms": max(sorted_times) * 1000,
                "avg_ms": sum(sorted_times) / len(sorted_times) * 1000,
                "p50_ms": sorted_times[len(sorted_times) // 2] * 1000,
                "p95_ms": sorted_times[int(len(sorted_times) * 0.95)] * 1000,
                "p99_ms": sorted_times[int(len(sorted_times) * 0.99)] * 1000,
            },
            "test_duration_seconds": self.end_time - self.start_time if self.end_time and self.start_time else 0
        }


class LoadTestDataGenerator:
    """Generate large datasets for load testing."""
    
    @staticmethod
    async def cleanup_existing_test_data(db_session: AsyncSession):
        """Clean up existing load test data to prevent conflicts."""
        print("Cleaning up existing load test data...")
        
        # Delete in reverse dependency order
        await db_session.execute(text("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_%@%')"))
        await db_session.execute(text("DELETE FROM follows WHERE follower_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_%@%') OR followed_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_%@%')"))
        await db_session.execute(text("DELETE FROM shares WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_%@%')"))
        await db_session.execute(text("DELETE FROM emoji_reactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_%@%')"))
        await db_session.execute(text("DELETE FROM mentions WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_%@%'))"))
        await db_session.execute(text("DELETE FROM posts WHERE author_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_%@%')"))
        await db_session.execute(text("DELETE FROM users WHERE email LIKE 'loadtest_%@%'"))
        
        await db_session.commit()
        print("Cleanup completed")
    
    @staticmethod
    async def create_large_dataset(
        db_session: AsyncSession,
        num_users: int = 1000,
        posts_per_user: int = 10,
        interactions_per_post: int = 5
    ) -> Dict[str, List]:
        """Create a large dataset for load testing."""
        print(f"Creating load test dataset: {num_users} users, {posts_per_user} posts per user...")
        
        # Clean up existing test data first
        await LoadTestDataGenerator.cleanup_existing_test_data(db_session)
        
        # Generate unique identifier for this test run
        test_run_id = str(uuid.uuid4())[:8]
        timestamp = int(time.time())
        
        # Create users in batches
        users = []
        batch_size = 50  # Smaller batches to avoid memory issues
        
        for batch_start in range(0, num_users, batch_size):
            batch_end = min(batch_start + batch_size, num_users)
            batch_users = []
            
            for i in range(batch_start, batch_end):
                user = User(
                    email=f"loadtest_{test_run_id}_{timestamp}_{i}@test.com",
                    username=f"loadtest_{test_run_id}_{i}",
                    hashed_password="test_password_hash",
                    display_name=f"Load Test User {i}",
                    bio=f"Bio for load test user {i}",
                    last_feed_view=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24))
                )
                batch_users.append(user)
                
            db_session.add_all(batch_users)
            
            try:
                await db_session.commit()
                
                # Refresh to get IDs
                for user in batch_users:
                    await db_session.refresh(user)
                    users.append(user)
                    
                print(f"Created users {batch_start}-{batch_end-1}")
            except Exception as e:
                print(f"Error creating user batch {batch_start}-{batch_end-1}: {e}")
                await db_session.rollback()
                raise
        
        # Create posts in batches
        posts = []
        for batch_start in range(0, len(users), batch_size):
            batch_end = min(batch_start + batch_size, len(users))
            batch_posts = []
            
            for user in users[batch_start:batch_end]:
                for j in range(posts_per_user):
                    post_age_hours = random.randint(1, 168)  # 1 hour to 1 week old
                    created_at = datetime.now(timezone.utc) - timedelta(hours=post_age_hours)
                    
                    post_types = [PostType.daily, PostType.photo, PostType.spontaneous]
                    post_type = random.choice(post_types)
                    
                    content_length = random.randint(50, 500)
                    content = f"Load test post content for user {user.username}. " * (content_length // 50)
                    content = content[:content_length]
                    
                    post = Post(
                        author_id=user.id,
                        content=content,
                        post_type=post_type,
                        is_public=True,
                        created_at=created_at,
                        hearts_count=0,
                        reactions_count=0,
                        shares_count=0
                    )
                    batch_posts.append(post)
                    
            db_session.add_all(batch_posts)
            
            try:
                await db_session.commit()
                
                # Refresh to get IDs
                for post in batch_posts:
                    await db_session.refresh(post)
                    posts.append(post)
                    
                print(f"Created posts for users {batch_start}-{batch_end-1}")
            except Exception as e:
                print(f"Error creating post batch {batch_start}-{batch_end-1}: {e}")
                await db_session.rollback()
                raise
        
        # Create interactions (likes, reactions, shares) in batches
        # First, collect post data to avoid lazy loading issues
        post_data = []
        for post in posts:
            try:
                post_data.append({
                    'id': post.id,
                    'author_id': post.author_id,
                    'post_object': post  # Keep reference for updating counts
                })
            except Exception as e:
                print(f"Error accessing post data: {e}")
                # Create minimal post data for load testing
                post_data.append({
                    'id': f"post_{len(post_data)}",
                    'author_id': 1,
                    'post_object': None
                })
        
        interactions = []
        for batch_start in range(0, len(post_data), batch_size):
            batch_end = min(batch_start + batch_size, len(post_data))
            batch_interactions = []
            
            for post_info in post_data[batch_start:batch_end]:
                # Use stored post data to avoid lazy loading issues
                post_id = post_info['id']
                post_author_id = post_info['author_id']
                post_object = post_info['post_object']
                
                # Random number of interactions per post
                num_interactions = random.randint(0, interactions_per_post)
                interacting_users = random.sample(users, min(num_interactions, len(users)))
                
                for user in interacting_users:
                    # Avoid self-interaction
                    if user.id == post_author_id:
                        continue
                        
                    interaction_type = random.choice(['like', 'reaction', 'share'])
                    
                    try:
                        if interaction_type == 'like':
                            heart = EmojiReaction(post_id=post_id, user_id=user.id, emoji_code='heart')
                            batch_interactions.append(heart)
                            post_object.hearts_count += 1
                            
                        elif interaction_type == 'reaction':
                            # Use only valid emoji codes from database constraint
                            emoji_codes = ['heart', 'heart_eyes', 'hug', 'pray', 'muscle', 'grateful', 'praise', 'clap']
                            emoji_code = random.choice(emoji_codes)
                            reaction = EmojiReaction(
                                post_id=post_id,
                                user_id=user.id,
                                emoji_code=emoji_code
                            )
                            batch_interactions.append(reaction)
                            post_object.reactions_count += 1
                            
                        elif interaction_type == 'share':
                            share_method = random.choice(['url', 'message'])
                            share_data = {
                                'post_id': post_id,
                                'user_id': user.id,
                                'share_method': share_method
                            }
                            
                            # For message shares, add recipient_user_ids to satisfy constraint
                            if share_method == 'message':
                                # Pick 1-3 random users as recipients
                                num_recipients = random.randint(1, 3)
                                potential_recipients = [u for u in users if u.id != user.id and u.id != post_author_id]
                                if potential_recipients:
                                    recipients = random.sample(potential_recipients, min(num_recipients, len(potential_recipients)))
                                    share_data['recipient_user_ids'] = [r.id for r in recipients]
                                    share_data['message_content'] = f"Check out this post from user {post_author_id}!"
                                else:
                                    # If no recipients available, make it a URL share instead
                                    share_data['share_method'] = 'url'
                            
                            share = Share(**share_data)
                            batch_interactions.append(share)
                            post_object.shares_count += 1
                    except Exception as e:
                        print(f"Error creating {interaction_type} interaction: {e}")
                        continue
                        
            if batch_interactions:
                db_session.add_all(batch_interactions)
                
                try:
                    await db_session.commit()
                    print(f"Created interactions for posts {batch_start}-{batch_end-1}")
                except Exception as e:
                    print(f"Error creating interaction batch {batch_start}-{batch_end-1}: {e}")
                    await db_session.rollback()
                    # Continue with next batch
        
        # Create follow relationships
        follows = []
        follow_users = users[:min(100, len(users))]  # Limit to first 100 users to avoid too many relationships
        
        for user in follow_users:
            # Each user follows 3-10 other users
            num_follows = random.randint(3, 10)
            potential_follows = [u for u in users if u.id != user.id]
            following_users = random.sample(potential_follows, min(num_follows, len(potential_follows)))
            
            for followed_user in following_users:
                try:
                    follow = Follow(
                        follower_id=user.id,
                        followed_id=followed_user.id,
                        status="active"
                    )
                    follows.append(follow)
                except Exception as e:
                    print(f"Error creating follow relationship: {e}")
                    continue
                    
        if follows:
            db_session.add_all(follows)
            
            try:
                await db_session.commit()
                print(f"Created {len(follows)} follow relationships")
            except Exception as e:
                print(f"Error creating follow relationships: {e}")
                await db_session.rollback()
                follows = []  # Clear follows if failed
        
        # Create notifications
        notifications = []
        notification_users = users[:min(50, len(users))]  # Create notifications for first 50 users
        
        for user in notification_users:
            num_notifications = random.randint(5, 20)
            for i in range(num_notifications):
                notification_types = ['heart', 'emoji_reaction', 'share', 'mention', 'follow']
                notification_type = random.choice(notification_types)
                
                try:
                    notification = Notification(
                        user_id=user.id,
                        type=notification_type,
                        title=f"Test {notification_type} notification",
                        message=f"Load test notification {i} for user {user.username}",
                        read=random.choice([True, False]),
                        created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 72))
                    )
                    notifications.append(notification)
                except Exception as e:
                    print(f"Error creating notification: {e}")
                    continue
                    
        if notifications:
            db_session.add_all(notifications)
            
            try:
                await db_session.commit()
                print(f"Created {len(notifications)} notifications")
            except Exception as e:
                print(f"Error creating notifications: {e}")
                await db_session.rollback()
                notifications = []  # Clear notifications if failed
        
        print(f"Dataset creation completed: {len(users)} users, {len(posts)} posts, {len(follows)} follows, {len(notifications)} notifications")
        
        return {
            'users': users,
            'posts': posts,
            'follows': follows,
            'notifications': notifications
        }


@pytest.fixture(scope="function")
async def load_test_engine():
    """Create a separate database engine for load testing."""
    from app.core.database import DATABASE_URL
    engine = create_async_engine(
        DATABASE_URL,
        pool_size=50,  # Larger pool for load testing
        max_overflow=100,
        pool_timeout=60,
        pool_recycle=3600,
        echo=False  # Disable SQL logging for performance
    )
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def load_test_session(load_test_engine):
    """Create a database session for load testing."""
    async_session = sessionmaker(
        load_test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session


@pytest.fixture(scope="function")
async def large_dataset(load_test_session):
    """Create a dataset for load testing (scaled for environment)."""
    config = get_load_test_config()
    
    # Scale dataset based on environment
    num_users = max(config["concurrent_users"], 10)  # At least 10 users
    posts_per_user = 2  # Keep it simple
    
    # Clean up any existing test data first
    await LoadTestDataGenerator.cleanup_existing_test_data(load_test_session)
    
    # Create real users in the database
    users = []
    for i in range(num_users):
        user = User(
            email=f"loadtest_user_{i}@test.com",
            username=f"loadtest_user_{i}",
            hashed_password="test_password_hash",
            display_name=f"Load Test User {i}",
            bio=f"Bio for load test user {i}",
            last_feed_view=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24))
        )
        load_test_session.add(user)
        users.append(user)
    
    await load_test_session.commit()
    
    # Refresh users to get their IDs
    for user in users:
        await load_test_session.refresh(user)
    
    # Create real posts in the database
    posts = []
    for user in users:
        for j in range(posts_per_user):
            post = Post(
                author_id=user.id,
                content=f"Load test post content for user {user.username}. Post number {j}.",
                post_type=PostType.spontaneous,
                is_public=True,
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24)),
                hearts_count=0,
                reactions_count=0,
                shares_count=0
            )
            load_test_session.add(post)
            posts.append(post)
    
    await load_test_session.commit()
    
    # Refresh posts to get their IDs
    for post in posts:
        await load_test_session.refresh(post)
    
    print(f"Created dataset for {os.getenv('ENVIRONMENT', 'development')}: {len(users)} users, {len(posts)} posts")
    
    return {
        'users': users,
        'posts': posts,
        'follows': [],
        'notifications': []
    }


@pytest.fixture
def load_test_metrics():
    """Provide load test metrics collector."""
    return LoadTestMetrics()


def get_load_test_config():
    """Get load test configuration based on environment."""
    environment = os.getenv("ENVIRONMENT", "development")
    
    if environment == "production":
        return {
            "concurrent_users": 100,
            "requests_per_user": 20,
            "timeout": 60.0,
            "max_connections": 100
        }
    elif environment == "staging":
        return {
            "concurrent_users": 50,
            "requests_per_user": 10,
            "timeout": 30.0,
            "max_connections": 50
        }
    else:  # development
        return {
            "concurrent_users": 5,  # Much more reasonable for dev
            "requests_per_user": 3,
            "timeout": 15.0,
            "max_connections": 10
        }


async def check_server_availability(base_url: str = "http://localhost:8000") -> bool:
    """Check if the server is available for load testing."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/health")
            return response.status_code == 200
    except Exception:
        return False


@pytest.fixture
async def http_client():
    """Create HTTP client for load testing."""
    base_url = "http://localhost:8000"
    config = get_load_test_config()
    
    # Check if server is available
    if not await check_server_availability(base_url):
        pytest.skip(f"Server not available at {base_url}. Start the server with: uvicorn main:app --reload")
    
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=config["timeout"],
        limits=httpx.Limits(
            max_connections=config["max_connections"], 
            max_keepalive_connections=min(config["max_connections"] // 2, 10)
        )
    ) as client:
        yield client


@pytest.fixture
def concurrent_executor():
    """Provide thread pool executor for concurrent operations."""
    with ThreadPoolExecutor(max_workers=100) as executor:
        yield executor


class ConcurrentTestRunner:
    """Run concurrent operations for load testing."""
    
    def __init__(self, http_client: httpx.AsyncClient, metrics: LoadTestMetrics):
        self.http_client = http_client
        self.metrics = metrics
        
    async def run_concurrent_requests(
        self,
        request_func,
        concurrent_users: int,
        requests_per_user: int,
        **kwargs
    ) -> Dict[str, Any]:
        """Run concurrent requests and collect metrics."""
        # Quick server availability check
        try:
            response = await self.http_client.get("/health")
            if response.status_code != 200:
                raise Exception(f"Server health check failed: {response.status_code}")
        except Exception as e:
            raise Exception(f"Server not available: {e}. Start the server with: uvicorn main:app --reload")
        
        self.metrics.start_test(concurrent_users)
        
        # Create tasks for concurrent execution
        tasks = []
        for user_id in range(concurrent_users):
            for request_id in range(requests_per_user):
                task = asyncio.create_task(
                    self._execute_request(request_func, user_id, request_id, **kwargs)
                )
                tasks.append(task)
        
        # Execute all tasks concurrently
        await asyncio.gather(*tasks, return_exceptions=True)
        
        self.metrics.end_test()
        return self.metrics.get_stats()
        
    async def _execute_request(self, request_func, user_id: int, request_id: int, **kwargs):
        """Execute a single request and record metrics."""
        start_time = time.time()
        success = False
        
        try:
            await request_func(self.http_client, user_id, request_id, **kwargs)
            success = True
        except Exception as e:
            import traceback
            error_details = f"{type(e).__name__}: {str(e)}"
            if not str(e):  # If error message is empty, get more details
                error_details = f"{type(e).__name__}: {traceback.format_exc()}"
            print(f"Request failed for user {user_id}, request {request_id}: {error_details}")
            success = False
        finally:
            response_time = time.time() - start_time
            self.metrics.record_response(response_time, success)


@pytest.fixture
def concurrent_test_runner(http_client, load_test_metrics):
    """Provide concurrent test runner."""
    return ConcurrentTestRunner(http_client, load_test_metrics)


@pytest.fixture
def load_test_tokens(large_dataset):
    """Generate real JWT tokens for all test users."""
    users = large_dataset['users']
    user_ids = [user.id for user in users]
    
    # Create tokens with 24-hour expiration for load testing
    tokens = create_token_batch(user_ids, expires_in=60 * 60 * 24)
    
    print(f"Generated {len(tokens)} JWT tokens for load testing")
    return tokens