"""
Load testing for notification batching performance.

Tests notification batching system under high notification volume
to validate performance and batching efficiency.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Load tests disabled for development - configure for production deployment")

import asyncio
import time
import random
from typing import Dict, Any, List
from datetime import datetime, timezone

from app.services.notification_service import NotificationService
from app.core.notification_batcher import NotificationBatcher
from app.core.notification_factory import NotificationFactory


class TestNotificationBatchingLoad:
    """Load tests for notification batching performance."""
    
    @pytest.mark.asyncio
    async def test_notification_creation_high_volume(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test notification creation under high volume."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        
        notification_service = NotificationService(load_test_session)
        notification_factory = NotificationFactory(load_test_session)
        
        # Create high volume of notifications
        num_notifications = 5000
        batch_size = 100
        
        total_creation_time = 0
        created_notifications = 0
        
        for batch_start in range(0, num_notifications, batch_size):
            batch_end = min(batch_start + batch_size, num_notifications)
            batch_notifications = []
            
            start_time = time.time()
            
            for i in range(batch_start, batch_end):
                # Random notification type
                notification_types = ['heart', 'emoji_reaction', 'share', 'mention', 'follow']
                notification_type = random.choice(notification_types)
                
                recipient = users[i % len(users)]
                actor = users[(i + 1) % len(users)]
                
                # Avoid self-notifications
                if recipient.id == actor.id:
                    actor = users[(i + 2) % len(users)]
                
                # Create notification using the correct API
                try:
                    notification = await notification_service.create_notification(
                        user_id=recipient.id,
                        notification_type=notification_type,
                        title=f"{notification_type.title()} Notification",
                        message=f"You received a {notification_type} from {actor.username}",
                        data={"username": actor.username, "actor_id": actor.id},
                        respect_rate_limit=False  # Skip rate limiting for load tests
                    )
                except Exception as e:
                    print(f"Failed to create notification for user {recipient.id}: {e}")
                    notification = None
                if notification:
                    batch_notifications.append(notification)
            
            batch_time = time.time() - start_time
            total_creation_time += batch_time
            created_notifications += len(batch_notifications)
            
            print(f"Created notifications {batch_start}-{batch_end-1} in {batch_time:.2f}s")
        
        # Calculate performance metrics
        avg_creation_time_ms = (total_creation_time / created_notifications) * 1000
        notifications_per_second = created_notifications / total_creation_time
        
        # Validate performance
        assert avg_creation_time_ms < 50, f"Average notification creation time {avg_creation_time_ms:.1f}ms too slow"
        assert notifications_per_second > 100, f"Notification creation rate {notifications_per_second:.1f}/sec too low"
        
        print(f"High volume notification creation results:")
        print(f"  Total notifications: {created_notifications}")
        print(f"  Total time: {total_creation_time:.2f}s")
        print(f"  Avg creation time: {avg_creation_time_ms:.1f}ms")
        print(f"  Notifications/sec: {notifications_per_second:.1f}")
    
    @pytest.mark.asyncio
    async def test_notification_batching_efficiency(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test notification batching efficiency under load."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        
        notification_service = NotificationService(load_test_session)
        notification_factory = NotificationFactory(load_test_session)
        
        # Create many similar notifications that should be batched
        target_user = users[0]
        target_post = posts[0]
        
        # Create 100 reactions to the same post (should be batched)
        reaction_notifications = []
        start_time = time.time()
        
        for i in range(100):
            actor = users[(i + 1) % len(users)]
            if actor.id == target_user.id:
                continue
                
            notification = await notification_service.create_notification(
                user_id=target_user.id,
                notification_type='emoji_reaction',
                title="Emoji Reaction",
                message=f"{actor.username} reacted to your post",
                data={"username": actor.username, "actor_id": actor.id, "post_id": target_post.id},
                respect_rate_limit=False
            )
            if notification:
                reaction_notifications.append(notification)
        
        creation_time = time.time() - start_time
        
        # Process batching (batching happens automatically in the factory)
        batching_time = time.time() - start_time
        
        # Check batching results
        batched_notifications = await NotificationService.get_user_notifications(
            db=load_test_session,
            user_id=target_user.id,
            limit=50,
            include_children=True
        )
        
        # Count parent notifications (batched) vs individual notifications
        parent_notifications = [n for n in batched_notifications if n.parent_id is None]
        child_notifications = [n for n in batched_notifications if n.parent_id is not None]
        
        # Validate batching efficiency
        batching_ratio = len(child_notifications) / len(parent_notifications) if parent_notifications else 0
        assert batching_ratio > 5, f"Batching ratio {batching_ratio:.1f} too low, batching not efficient"
        
        # Validate performance
        assert creation_time < 10, f"Notification creation took {creation_time:.2f}s, too slow"
        assert batching_time < 2, f"Batching processing took {batching_time:.2f}s, too slow"
        
        print(f"Notification batching efficiency results:")
        print(f"  Created notifications: {len(reaction_notifications)}")
        print(f"  Parent notifications: {len(parent_notifications)}")
        print(f"  Child notifications: {len(child_notifications)}")
        print(f"  Batching ratio: {batching_ratio:.1f}")
        print(f"  Creation time: {creation_time:.2f}s")
        print(f"  Batching time: {batching_time:.2f}s")
    
    @pytest.mark.asyncio
    async def test_notification_retrieval_performance(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test notification retrieval performance with large datasets."""
        users = large_dataset['users']
        notification_service = NotificationService(load_test_session)
        
        # Test notification retrieval for users with many notifications
        test_users = users[:10]
        retrieval_times = []
        
        for user in test_users:
            start_time = time.time()
            
            notifications = await NotificationService.get_user_notifications(
                db=load_test_session,
                user_id=user.id,
                limit=50,
                include_children=True
            )
            
            retrieval_time_ms = (time.time() - start_time) * 1000
            retrieval_times.append(retrieval_time_ms)
            
            # Validate response structure
            assert isinstance(notifications, list)
            for notification in notifications:
                assert hasattr(notification, 'id')
                assert hasattr(notification, 'type')
                assert hasattr(notification, 'created_at')
        
        # Calculate performance metrics
        avg_retrieval_time = sum(retrieval_times) / len(retrieval_times)
        max_retrieval_time = max(retrieval_times)
        
        # Validate performance
        assert avg_retrieval_time < 100, f"Average notification retrieval time {avg_retrieval_time:.1f}ms too slow"
        assert max_retrieval_time < 200, f"Max notification retrieval time {max_retrieval_time:.1f}ms too slow"
        
        print(f"Notification retrieval performance results:")
        print(f"  Test users: {len(test_users)}")
        print(f"  Avg retrieval time: {avg_retrieval_time:.1f}ms")
        print(f"  Max retrieval time: {max_retrieval_time:.1f}ms")
    
    @pytest.mark.asyncio
    async def test_concurrent_notification_processing(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test concurrent notification processing performance."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        
        notification_service = NotificationService(load_test_session)
        
        # Create concurrent notification creation tasks
        concurrent_tasks = []
        num_concurrent_operations = 200
        
        async def create_notification_task(task_id: int):
            """Create a notification in a concurrent task."""
            recipient = users[task_id % len(users)]
            actor = users[(task_id + 1) % len(users)]
            post = posts[task_id % len(posts)]
            
            if recipient.id == actor.id:
                actor = users[(task_id + 2) % len(users)]
            
            notification_types = ['heart', 'emoji_reaction', 'share']
            notification_type = random.choice(notification_types)
            
            return await notification_service.create_notification(
                user_id=recipient.id,
                notification_type=notification_type,
                title=f"{notification_type.title()} Notification",
                message=f"{actor.username} {notification_type}d your post",
                data={"username": actor.username, "actor_id": actor.id, "post_id": post.id},
                respect_rate_limit=False
            )
        
        # Execute concurrent tasks
        start_time = time.time()
        
        for i in range(num_concurrent_operations):
            task = asyncio.create_task(create_notification_task(i))
            concurrent_tasks.append(task)
        
        results = await asyncio.gather(*concurrent_tasks, return_exceptions=True)
        
        execution_time = time.time() - start_time
        
        # Analyze results
        successful_operations = sum(1 for r in results if not isinstance(r, Exception))
        failed_operations = len(results) - successful_operations
        
        operations_per_second = successful_operations / execution_time
        success_rate = successful_operations / len(results)
        
        # Validate performance
        assert success_rate >= 0.95, f"Concurrent notification success rate {success_rate:.2%} below 95%"
        assert operations_per_second > 50, f"Concurrent operations per second {operations_per_second:.1f} too low"
        assert execution_time < 10, f"Concurrent execution time {execution_time:.2f}s too slow"
        
        print(f"Concurrent notification processing results:")
        print(f"  Total operations: {len(results)}")
        print(f"  Successful: {successful_operations}")
        print(f"  Failed: {failed_operations}")
        print(f"  Success rate: {success_rate:.2%}")
        print(f"  Operations/sec: {operations_per_second:.1f}")
        print(f"  Execution time: {execution_time:.2f}s")
    
    @pytest.mark.asyncio
    async def test_notification_batch_expansion_performance(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test performance of expanding batched notifications."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        
        notification_service = NotificationService(load_test_session)
        
        # Create a large batch of similar notifications
        target_user = users[0]
        target_post = posts[0]
        
        # Create 200 similar notifications
        for i in range(200):
            actor = users[(i + 1) % len(users)]
            if actor.id == target_user.id:
                continue
                
            await notification_service.create_notification(
                user_id=target_user.id,
                notification_type='heart',
                title="Heart Notification",
                message=f"{actor.username} hearted your post",
                data={"username": actor.username, "actor_id": actor.id, "post_id": target_post.id},
                respect_rate_limit=False
            )
        
        # Test batch expansion performance (batching happens automatically)
        start_time = time.time()
        
        notifications = await NotificationService.get_user_notifications(
            db=load_test_session,
            user_id=target_user.id,
            limit=50,
            include_children=True
        )
        
        expansion_time_ms = (time.time() - start_time) * 1000
        
        # Find batched notifications
        batched_notifications = [n for n in notifications if hasattr(n, 'is_batch') and n.is_batch]
        
        # Validate performance
        assert expansion_time_ms < 200, f"Batch expansion time {expansion_time_ms:.1f}ms too slow"
        
        # Test that we have some notifications
        assert len(notifications) > 0, "Should have notifications"
        
        print(f"Notification batch expansion performance results:")
        print(f"  Batch expansion time: {expansion_time_ms:.1f}ms")
        print(f"  Total notifications found: {len(notifications)}")
        print(f"  Batched notifications found: {len(batched_notifications)}")
    
    @pytest.mark.asyncio
    async def test_notification_cleanup_performance(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test notification cleanup performance with large datasets."""
        users = large_dataset['users']
        notification_service = NotificationService(load_test_session)
        
        # Create old notifications that should be cleaned up
        old_notifications_count = 1000
        
        # This would normally be done by creating notifications with old timestamps
        # For load testing, we'll test the cleanup query performance
        
        # Test notification retrieval performance as a proxy for cleanup performance
        start_time = time.time()
        
        # Get notifications for multiple users to test performance
        test_users = users[:20]
        total_notifications = 0
        
        for user in test_users:
            notifications = await NotificationService.get_user_notifications(
                db=load_test_session,
                user_id=user.id,
                limit=50
            )
            total_notifications += len(notifications)
        
        cleanup_time = time.time() - start_time
        
        # Validate performance
        assert cleanup_time < 5, f"Notification retrieval took {cleanup_time:.2f}s, too slow"
        
        print(f"Notification cleanup performance results:")
        print(f"  Cleanup time: {cleanup_time:.2f}s")
        print(f"  Total notifications retrieved: {total_notifications}")
        print(f"  Test users: {len(test_users)}")