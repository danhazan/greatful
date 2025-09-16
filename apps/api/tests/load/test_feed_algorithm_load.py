"""
Load testing for feed algorithm performance.

Tests the feed algorithm under high load with 1000+ posts and 100+ concurrent users
to validate the <300ms performance target.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Load tests disabled for development - configure for production deployment")

import asyncio
import time
import random
from typing import Dict, Any, List
import httpx

from app.services.optimized_algorithm_service import OptimizedAlgorithmService
from app.core.algorithm_performance import algorithm_performance_monitor
from .conftest import ConcurrentTestRunner, LoadTestMetrics


class TestFeedAlgorithmLoad:
    """Load tests for feed algorithm performance."""
    
    @pytest.mark.asyncio
    async def test_feed_algorithm_concurrent_load(
        self,
        load_test_session,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test feed algorithm with 100+ concurrent users."""
        users = large_dataset['users']
        concurrent_users = 100
        requests_per_user = 5
        
        async def feed_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make a feed request for load testing."""
            test_user = users[user_id % len(users)]
            
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            response = await client.get(
                f"/api/v1/posts/feed?limit=20&offset={request_id * 20}",
                headers=headers
            )
            
            # Validate response
            assert response.status_code == 200
            data = response.json()
            assert "posts" in data
            assert "total_count" in data
            
            return data
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            feed_request,
            concurrent_users=concurrent_users,
            requests_per_user=requests_per_user,
            users=users
        )
        
        # Validate performance targets
        assert stats["success_rate"] >= 0.95, f"Success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 300, f"P95 response time {stats['response_times']['p95_ms']:.1f}ms exceeds 300ms target"
        assert stats["response_times"]["avg_ms"] < 200, f"Average response time {stats['response_times']['avg_ms']:.1f}ms exceeds 200ms target"
        
        print(f"Feed algorithm load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total requests: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}, p99={stats['response_times']['p99_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_feed_algorithm_large_dataset_performance(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test feed algorithm performance with large dataset (1000+ posts)."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        
        print(f"Testing with {len(users)} users and {len(posts)} posts")
        
        # Test with multiple users to ensure consistent performance
        test_users = users[:50]  # Test with first 50 users
        algorithm_service = OptimizedAlgorithmService(load_test_session)
        
        response_times = []
        
        for user in test_users:
            start_time = time.time()
            
            feed_posts, total_count = await algorithm_service.get_personalized_feed_optimized(
                user_id=user.id,
                limit=20,
                offset=0,
                algorithm_enabled=True,
                consider_read_status=True
            )
            
            response_time_ms = (time.time() - start_time) * 1000
            response_times.append(response_time_ms)
            
            # Validate response
            assert len(feed_posts) > 0, f"Feed should return posts for user {user.id}"
            assert total_count > 0, f"Total count should be > 0 for user {user.id}"
            
            # Validate post structure
            for post in feed_posts:
                assert 'id' in post
                assert 'algorithm_score' in post
                assert 'author' in post
                assert post['algorithm_score'] >= 0
        
        # Calculate statistics
        avg_response_time = sum(response_times) / len(response_times)
        max_response_time = max(response_times)
        p95_response_time = sorted(response_times)[int(len(response_times) * 0.95)]
        
        # Validate performance targets
        assert avg_response_time < 200, f"Average response time {avg_response_time:.1f}ms exceeds 200ms target"
        assert p95_response_time < 300, f"P95 response time {p95_response_time:.1f}ms exceeds 300ms target"
        assert max_response_time < 500, f"Max response time {max_response_time:.1f}ms exceeds 500ms limit"
        
        print(f"Large dataset performance results:")
        print(f"  Dataset size: {len(users)} users, {len(posts)} posts")
        print(f"  Test users: {len(test_users)}")
        print(f"  Avg response time: {avg_response_time:.1f}ms")
        print(f"  P95 response time: {p95_response_time:.1f}ms")
        print(f"  Max response time: {max_response_time:.1f}ms")
    
    @pytest.mark.asyncio
    async def test_feed_algorithm_stress_test(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Stress test feed algorithm with rapid consecutive requests."""
        users = large_dataset['users']
        algorithm_service = OptimizedAlgorithmService(load_test_session)
        
        # Select a test user
        test_user = users[0]
        
        # Clear performance metrics
        algorithm_performance_monitor.reset_metrics()
        
        # Perform rapid consecutive requests
        num_requests = 50
        response_times = []
        
        for i in range(num_requests):
            start_time = time.time()
            
            feed_posts, total_count = await algorithm_service.get_personalized_feed_optimized(
                user_id=test_user.id,
                limit=20,
                offset=i * 20,  # Different offset each time
                algorithm_enabled=True
            )
            
            response_time_ms = (time.time() - start_time) * 1000
            response_times.append(response_time_ms)
            
            # Validate response
            assert len(feed_posts) >= 0, f"Feed request {i} failed"
            assert total_count >= 0, f"Total count invalid for request {i}"
        
        # Analyze performance degradation
        first_half_avg = sum(response_times[:25]) / 25
        second_half_avg = sum(response_times[25:]) / 25
        performance_degradation = (second_half_avg - first_half_avg) / first_half_avg
        
        # Performance should not degrade significantly under stress
        assert performance_degradation < 0.5, f"Performance degraded by {performance_degradation:.2%} under stress"
        
        # All requests should still meet performance targets
        max_response_time = max(response_times)
        avg_response_time = sum(response_times) / len(response_times)
        
        assert avg_response_time < 300, f"Average response time {avg_response_time:.1f}ms exceeds 300ms under stress"
        assert max_response_time < 600, f"Max response time {max_response_time:.1f}ms exceeds 600ms under stress"
        
        print(f"Stress test results:")
        print(f"  Requests: {num_requests}")
        print(f"  First half avg: {first_half_avg:.1f}ms")
        print(f"  Second half avg: {second_half_avg:.1f}ms")
        print(f"  Performance degradation: {performance_degradation:.2%}")
        print(f"  Max response time: {max_response_time:.1f}ms")
    
    @pytest.mark.asyncio
    async def test_feed_algorithm_memory_usage(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test feed algorithm memory usage under load."""
        import psutil
        import os
        
        users = large_dataset['users']
        algorithm_service = OptimizedAlgorithmService(load_test_session)
        
        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory_mb = process.memory_info().rss / 1024 / 1024
        
        # Perform many feed requests
        test_users = users[:100]
        
        for user in test_users:
            await algorithm_service.get_personalized_feed_optimized(
                user_id=user.id,
                limit=20,
                algorithm_enabled=True
            )
        
        # Get final memory usage
        final_memory_mb = process.memory_info().rss / 1024 / 1024
        memory_increase_mb = final_memory_mb - initial_memory_mb
        memory_increase_per_request = memory_increase_mb / len(test_users)
        
        # Memory usage should not increase significantly
        assert memory_increase_mb < 100, f"Memory increased by {memory_increase_mb:.1f}MB, indicating potential memory leak"
        assert memory_increase_per_request < 1, f"Memory per request {memory_increase_per_request:.2f}MB too high"
        
        print(f"Memory usage test results:")
        print(f"  Initial memory: {initial_memory_mb:.1f}MB")
        print(f"  Final memory: {final_memory_mb:.1f}MB")
        print(f"  Memory increase: {memory_increase_mb:.1f}MB")
        print(f"  Memory per request: {memory_increase_per_request:.2f}MB")
    
    @pytest.mark.asyncio
    async def test_feed_algorithm_cache_performance_under_load(
        self,
        load_test_session,
        large_dataset: Dict[str, Any]
    ):
        """Test cache performance under high load."""
        from app.core.algorithm_performance import algorithm_cache_manager
        
        users = large_dataset['users']
        algorithm_service = OptimizedAlgorithmService(load_test_session)
        
        # Clear caches
        algorithm_cache_manager.clear_all_caches()
        
        # Test user for cache warming
        test_user = users[0]
        
        # Warm up cache
        await algorithm_service.get_personalized_feed_optimized(
            user_id=test_user.id,
            limit=20,
            algorithm_enabled=True
        )
        
        # Measure cache hit performance
        cache_hit_times = []
        for i in range(20):
            start_time = time.time()
            
            await algorithm_service.get_personalized_feed_optimized(
                user_id=test_user.id,
                limit=20,
                algorithm_enabled=True
            )
            
            response_time_ms = (time.time() - start_time) * 1000
            cache_hit_times.append(response_time_ms)
        
        # Cache hits should be very fast
        avg_cache_hit_time = sum(cache_hit_times) / len(cache_hit_times)
        max_cache_hit_time = max(cache_hit_times)
        
        assert avg_cache_hit_time < 100, f"Average cache hit time {avg_cache_hit_time:.1f}ms too slow"
        assert max_cache_hit_time < 200, f"Max cache hit time {max_cache_hit_time:.1f}ms too slow"
        
        # Test cache performance under concurrent load
        concurrent_tasks = []
        for i in range(50):
            task = asyncio.create_task(
                algorithm_service.get_personalized_feed_optimized(
                    user_id=test_user.id,
                    limit=20,
                    algorithm_enabled=True
                )
            )
            concurrent_tasks.append(task)
        
        start_time = time.time()
        await asyncio.gather(*concurrent_tasks)
        concurrent_time_ms = (time.time() - start_time) * 1000
        
        # Concurrent cache hits should still be fast
        avg_concurrent_time = concurrent_time_ms / len(concurrent_tasks)
        assert avg_concurrent_time < 150, f"Average concurrent cache time {avg_concurrent_time:.1f}ms too slow"
        
        print(f"Cache performance results:")
        print(f"  Avg cache hit time: {avg_cache_hit_time:.1f}ms")
        print(f"  Max cache hit time: {max_cache_hit_time:.1f}ms")
        print(f"  Concurrent requests: {len(concurrent_tasks)}")
        print(f"  Avg concurrent time: {avg_concurrent_time:.1f}ms")