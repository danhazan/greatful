"""
Load testing for mobile performance and responsiveness.

Tests API performance under mobile-like conditions including
slower connections, limited bandwidth, and mobile-specific usage patterns.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Load tests disabled for development - configure for production deployment")

import asyncio
import time
import random
from typing import Dict, Any, List
import httpx

from .conftest import ConcurrentTestRunner, LoadTestMetrics


class MobileSimulator:
    """Simulate mobile network conditions and usage patterns."""
    
    @staticmethod
    def get_mobile_network_conditions():
        """Get various mobile network conditions for testing."""
        return {
            "3G": {"delay_ms": 200, "bandwidth_kbps": 1000, "packet_loss": 0.02},
            "4G": {"delay_ms": 50, "bandwidth_kbps": 5000, "packet_loss": 0.01},
            "5G": {"delay_ms": 20, "bandwidth_kbps": 20000, "packet_loss": 0.005},
            "WiFi": {"delay_ms": 10, "bandwidth_kbps": 50000, "packet_loss": 0.001},
            "Poor": {"delay_ms": 500, "bandwidth_kbps": 200, "packet_loss": 0.05},
        }
    
    @staticmethod
    async def simulate_network_delay(network_type: str):
        """Simulate network delay for mobile conditions."""
        conditions = MobileSimulator.get_mobile_network_conditions()
        if network_type in conditions:
            delay_seconds = conditions[network_type]["delay_ms"] / 1000
            await asyncio.sleep(delay_seconds)
    
    @staticmethod
    def get_mobile_usage_patterns():
        """Get typical mobile usage patterns."""
        return {
            "quick_check": {
                "actions": ["feed", "notifications"],
                "session_duration_seconds": 30,
                "requests_per_action": 2
            },
            "active_browsing": {
                "actions": ["feed", "profile", "reactions", "search"],
                "session_duration_seconds": 300,
                "requests_per_action": 5
            },
            "social_interaction": {
                "actions": ["reactions", "shares", "follows", "notifications"],
                "session_duration_seconds": 180,
                "requests_per_action": 8
            },
            "content_creation": {
                "actions": ["post_creation", "image_upload", "mentions"],
                "session_duration_seconds": 240,
                "requests_per_action": 3
            }
        }


class TestMobilePerformanceLoad:
    """Load tests for mobile performance and responsiveness."""
    
    @pytest.mark.asyncio
    async def test_mobile_feed_loading_performance(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test feed loading performance under mobile conditions."""
        users = large_dataset['users']
        concurrent_users = 50
        requests_per_user = 10
        
        mobile_simulator = MobileSimulator()
        
        async def mobile_feed_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make a mobile-optimized feed request."""
            test_user = users[user_id % len(users)]
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Simulate mobile network conditions
            network_types = ["3G", "4G", "5G", "WiFi"]
            network_type = random.choice(network_types)
            await mobile_simulator.simulate_network_delay(network_type)
            
            # Mobile-optimized feed request (smaller limit for mobile)
            mobile_limit = random.choice([10, 15, 20])  # Smaller batches for mobile
            
            response = await client.get(
                f"/api/v1/posts/feed?limit={mobile_limit}&offset={request_id * mobile_limit}&mobile=true",
                headers=headers
            )
            
            assert response.status_code == 200, f"Mobile feed request failed: {response.status_code}"
            
            data = response.json()
            assert "posts" in data
            assert "total_count" in data
            
            # Validate mobile-optimized response
            posts = data["posts"]
            for post in posts:
                # Mobile responses should include essential data only
                assert "id" in post
                assert "content" in post
                assert "author" in post
                assert "created_at" in post
                
            return {"network_type": network_type, "posts_count": len(posts)}
        
        # Run concurrent mobile load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            mobile_feed_request,
            concurrent_users=concurrent_users,
            requests_per_user=requests_per_user
        )
        
        # Mobile performance targets (more lenient due to network simulation)
        assert stats["success_rate"] >= 0.95, f"Mobile feed success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 1000, f"P95 mobile feed time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 600, f"Average mobile feed time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Mobile feed loading performance results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total requests: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_mobile_usage_patterns_simulation(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        http_client: httpx.AsyncClient
    ):
        """Test various mobile usage patterns."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        
        mobile_simulator = MobileSimulator()
        usage_patterns = mobile_simulator.get_mobile_usage_patterns()
        
        pattern_results = {}
        
        for pattern_name, pattern_config in usage_patterns.items():
            print(f"Testing mobile usage pattern: {pattern_name}")
            
            test_user = users[0]
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            session_start_time = time.time()
            session_requests = []
            
            # Simulate usage pattern
            actions = pattern_config["actions"]
            requests_per_action = pattern_config["requests_per_action"]
            
            for action in actions:
                for i in range(requests_per_action):
                    request_start_time = time.time()
                    
                    # Simulate network delay
                    network_type = random.choice(["3G", "4G", "5G"])
                    await mobile_simulator.simulate_network_delay(network_type)
                    
                    # Perform action-specific request
                    if action == "feed":
                        response = await http_client.get(
                            f"/api/v1/posts/feed?limit=10&offset={i * 10}",
                            headers=headers
                        )
                    elif action == "notifications":
                        response = await http_client.get(
                            "/api/v1/notifications?limit=20",
                            headers=headers
                        )
                    elif action == "profile":
                        target_user = users[i % len(users)]
                        response = await http_client.get(
                            f"/api/v1/users/{target_user.id}/profile",
                            headers=headers
                        )
                    elif action == "reactions":
                        target_post = posts[i % len(posts)]
                        if target_post.author_id != test_user.id:
                            emoji_code = random.choice(['heart_eyes', 'pray', 'star'])
                            response = await http_client.post(
                                f"/api/v1/posts/{target_post.id}/reactions",
                                headers=headers,
                                json={"emoji_code": emoji_code}
                            )
                        else:
                            continue
                    elif action == "search":
                        query = f"user_{i % 50}"
                        response = await http_client.post(
                            "/api/v1/users/search",
                            headers=headers,
                            json={"query": query, "limit": 5}
                        )
                    elif action == "shares":
                        target_post = posts[i % len(posts)]
                        response = await http_client.post(
                            f"/api/v1/posts/{target_post.id}/share",
                            headers=headers,
                            json={"share_method": "url"}
                        )
                    elif action == "follows":
                        target_user = users[(i + 1) % len(users)]
                        if target_user.id != test_user.id:
                            response = await http_client.post(
                                f"/api/v1/follows/{target_user.id}",
                                headers=headers
                            )
                        else:
                            continue
                    else:
                        continue  # Skip unknown actions
                    
                    request_time_ms = (time.time() - request_start_time) * 1000
                    session_requests.append({
                        "action": action,
                        "response_time_ms": request_time_ms,
                        "status_code": response.status_code,
                        "network_type": network_type
                    })
                    
                    # Validate response
                    assert response.status_code in [200, 201], f"Mobile {action} request failed: {response.status_code}"
            
            session_duration = time.time() - session_start_time
            
            # Analyze pattern results
            avg_response_time = sum(r["response_time_ms"] for r in session_requests) / len(session_requests)
            max_response_time = max(r["response_time_ms"] for r in session_requests)
            success_rate = sum(1 for r in session_requests if r["status_code"] in [200, 201]) / len(session_requests)
            
            pattern_results[pattern_name] = {
                "session_duration": session_duration,
                "total_requests": len(session_requests),
                "avg_response_time_ms": avg_response_time,
                "max_response_time_ms": max_response_time,
                "success_rate": success_rate,
                "requests_per_second": len(session_requests) / session_duration
            }
            
            # Validate pattern performance
            assert success_rate >= 0.95, f"Mobile pattern {pattern_name} success rate {success_rate:.2%} below 95%"
            assert avg_response_time < 800, f"Mobile pattern {pattern_name} avg response time {avg_response_time:.1f}ms too slow"
            
            print(f"  {pattern_name}: {len(session_requests)} requests, {avg_response_time:.1f}ms avg, {success_rate:.2%} success")
        
        print(f"Mobile usage patterns simulation results:")
        for pattern_name, results in pattern_results.items():
            print(f"  {pattern_name}:")
            print(f"    Duration: {results['session_duration']:.1f}s")
            print(f"    Requests: {results['total_requests']}")
            print(f"    Avg response: {results['avg_response_time_ms']:.1f}ms")
            print(f"    Success rate: {results['success_rate']:.2%}")
    
    @pytest.mark.asyncio
    async def test_mobile_offline_recovery_simulation(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        http_client: httpx.AsyncClient
    ):
        """Test mobile app behavior during offline/online transitions."""
        users = large_dataset['users']
        test_user = users[0]
        # Use real JWT token
        token = load_test_tokens[test_user.id]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Simulate normal operation
        normal_requests = []
        for i in range(5):
            start_time = time.time()
            response = await http_client.get(
                f"/api/v1/posts/feed?limit=10&offset={i * 10}",
                headers=headers
            )
            response_time = (time.time() - start_time) * 1000
            normal_requests.append(response_time)
            assert response.status_code == 200
        
        avg_normal_time = sum(normal_requests) / len(normal_requests)
        
        # Simulate poor network conditions (high latency)
        poor_network_requests = []
        mobile_simulator = MobileSimulator()
        
        for i in range(5):
            start_time = time.time()
            
            # Simulate poor network delay
            await mobile_simulator.simulate_network_delay("Poor")
            
            response = await http_client.get(
                f"/api/v1/posts/feed?limit=10&offset={i * 10}",
                headers=headers
            )
            response_time = (time.time() - start_time) * 1000
            poor_network_requests.append(response_time)
            assert response.status_code == 200
        
        avg_poor_time = sum(poor_network_requests) / len(poor_network_requests)
        
        # Simulate recovery to good network
        recovery_requests = []
        for i in range(5):
            start_time = time.time()
            
            # Simulate good network (WiFi)
            await mobile_simulator.simulate_network_delay("WiFi")
            
            response = await http_client.get(
                f"/api/v1/posts/feed?limit=10&offset={i * 10}",
                headers=headers
            )
            response_time = (time.time() - start_time) * 1000
            recovery_requests.append(response_time)
            assert response.status_code == 200
        
        avg_recovery_time = sum(recovery_requests) / len(recovery_requests)
        
        # Validate recovery performance
        recovery_improvement = (avg_poor_time - avg_recovery_time) / avg_poor_time
        assert recovery_improvement > 0.5, f"Recovery improvement {recovery_improvement:.2%} insufficient"
        
        # Recovery should be close to normal performance
        recovery_vs_normal = abs(avg_recovery_time - avg_normal_time) / avg_normal_time
        assert recovery_vs_normal < 0.3, f"Recovery performance {recovery_vs_normal:.2%} too different from normal"
        
        print(f"Mobile offline recovery simulation results:")
        print(f"  Normal network avg: {avg_normal_time:.1f}ms")
        print(f"  Poor network avg: {avg_poor_time:.1f}ms")
        print(f"  Recovery network avg: {avg_recovery_time:.1f}ms")
        print(f"  Recovery improvement: {recovery_improvement:.2%}")
    
    @pytest.mark.asyncio
    async def test_mobile_data_usage_optimization(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        http_client: httpx.AsyncClient
    ):
        """Test mobile data usage optimization features."""
        users = large_dataset['users']
        test_user = users[0]
        # Use real JWT token
        token = load_test_tokens[test_user.id]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test normal feed request
        normal_response = await http_client.get(
            "/api/v1/posts/feed?limit=20",
            headers=headers
        )
        assert normal_response.status_code == 200
        normal_data = normal_response.json()
        normal_size = len(normal_response.content)
        
        # Test mobile-optimized feed request
        mobile_headers = {**headers, "X-Mobile-Client": "true"}
        mobile_response = await http_client.get(
            "/api/v1/posts/feed?limit=20&mobile_optimized=true",
            headers=mobile_headers
        )
        assert mobile_response.status_code == 200
        mobile_data = mobile_response.json()
        mobile_size = len(mobile_response.content)
        
        # Mobile response should be smaller (optimized)
        size_reduction = (normal_size - mobile_size) / normal_size
        assert size_reduction > 0, f"Mobile optimization should reduce response size"
        
        # Both should have same number of posts
        assert len(normal_data["posts"]) == len(mobile_data["posts"]), "Mobile response should have same number of posts"
        
        # Test image optimization for mobile
        if any(post.get("image_url") for post in mobile_data["posts"]):
            # Mobile images should use optimized URLs or smaller sizes
            mobile_posts_with_images = [p for p in mobile_data["posts"] if p.get("image_url")]
            for post in mobile_posts_with_images:
                # Mobile image URLs should indicate optimization
                image_url = post["image_url"]
                assert any(indicator in image_url.lower() for indicator in ["mobile", "small", "compressed", "thumb"]), \
                    f"Mobile image URL should indicate optimization: {image_url}"
        
        print(f"Mobile data usage optimization results:")
        print(f"  Normal response size: {normal_size} bytes")
        print(f"  Mobile response size: {mobile_size} bytes")
        print(f"  Size reduction: {size_reduction:.2%}")
        print(f"  Posts in both responses: {len(normal_data['posts'])}")
    
    @pytest.mark.asyncio
    async def test_mobile_concurrent_users_realistic_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test realistic mobile concurrent user load."""
        users = large_dataset['users']
        concurrent_users = 100  # Realistic mobile concurrent load
        actions_per_user = 8
        
        mobile_simulator = MobileSimulator()
        
        async def realistic_mobile_session(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Simulate a realistic mobile user session."""
            test_user = users[user_id % len(users)]
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Simulate mobile network
            network_type = random.choice(["3G", "4G", "5G", "WiFi"])
            await mobile_simulator.simulate_network_delay(network_type)
            
            # Realistic mobile actions sequence
            mobile_actions = [
                "check_notifications",
                "browse_feed", 
                "interact_with_post",
                "check_profile",
                "search_users"
            ]
            
            action = mobile_actions[request_id % len(mobile_actions)]
            
            if action == "check_notifications":
                response = await client.get(
                    "/api/v1/notifications?limit=10",
                    headers=headers
                )
            elif action == "browse_feed":
                response = await client.get(
                    f"/api/v1/posts/feed?limit=15&offset={request_id * 15}",
                    headers=headers
                )
            elif action == "interact_with_post":
                posts = large_dataset['posts']
                target_post = posts[request_id % len(posts)]
                if target_post.author_id != test_user.id:
                    response = await client.post(
                        f"/api/v1/posts/{target_post.id}/reactions",
                        headers=headers,
                        json={"emoji_code": "heart_eyes"}
                    )
                else:
                    # Fallback to feed request
                    response = await client.get(
                        "/api/v1/posts/feed?limit=10",
                        headers=headers
                    )
            elif action == "check_profile":
                target_user = users[(user_id + 1) % len(users)]
                response = await client.get(
                    f"/api/v1/users/{target_user.id}/profile",
                    headers=headers
                )
            elif action == "search_users":
                query = f"user_{request_id % 100}"
                response = await client.post(
                    "/api/v1/users/search",
                    headers=headers,
                    json={"query": query, "limit": 8}
                )
            
            assert response.status_code in [200, 201], f"Mobile action {action} failed: {response.status_code}"
            return {"action": action, "network_type": network_type}
        
        # Run realistic mobile load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            realistic_mobile_session,
            concurrent_users=concurrent_users,
            requests_per_user=actions_per_user
        )
        
        # Validate realistic mobile performance
        assert stats["success_rate"] >= 0.95, f"Mobile realistic success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 1200, f"P95 mobile realistic time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 700, f"Average mobile realistic time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        # Mobile should handle sustained concurrent load
        assert stats["operations_per_second"] > 30, f"Mobile ops/sec {stats['operations_per_second']:.1f} too low for realistic load"
        
        print(f"Mobile realistic concurrent load results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total actions: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
        print(f"  Test duration: {stats['test_duration_seconds']:.1f}s")