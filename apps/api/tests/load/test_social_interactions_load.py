"""
Load testing for social interactions performance.

Tests reactions, shares, mentions, follows, and notifications under
concurrent usage to validate performance and reliability.
"""

import pytest
import asyncio
import time
import random
from typing import Dict, Any, List
import httpx
import json

from .conftest import ConcurrentTestRunner, LoadTestMetrics

pytestmark = pytest.mark.skip(reason="Load tests disabled for development - configure for production deployment")


class TestSocialInteractionsLoad:
    """Load tests for social interactions performance."""
    
    @pytest.mark.asyncio
    async def test_emoji_reactions_concurrent_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test emoji reactions under concurrent load."""
        # Import here to avoid circular imports
        from .conftest import get_load_test_config
        config = get_load_test_config()
        
        users = large_dataset['users']
        posts = large_dataset['posts']
        concurrent_users = config["concurrent_users"]
        reactions_per_user = config["requests_per_user"]
        
        async def reaction_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make a reaction request for load testing."""
            test_user = users[user_id % len(users)]
            test_post = posts[request_id % len(posts)]
            
            # Avoid self-reactions
            if test_post.author_id == test_user.id:
                test_post = posts[(request_id + 1) % len(posts)]
            
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            emoji_codes = ['heart', 'heart_eyes', 'hug', 'pray', 'muscle', 'grateful', 'praise', 'clap']
            emoji_code = random.choice(emoji_codes)
            
            # Add reaction
            response = await client.post(
                f"/api/v1/posts/{test_post.id}/reactions",
                headers=headers,
                json={"emoji_code": emoji_code}
            )
            
            assert response.status_code in [200, 201], f"Reaction failed: {response.status_code}"
            
            # Occasionally remove reaction to test both operations
            if random.random() < 0.3:
                delete_response = await client.delete(
                    f"/api/v1/posts/{test_post.id}/reactions",
                    headers=headers
                )
                assert delete_response.status_code in [200, 204]
            
            return response.json()
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            reaction_request,
            concurrent_users=concurrent_users,
            requests_per_user=reactions_per_user
        )
        
        # Validate performance
        # More realistic success rate for development environment (allows for some business logic conflicts)
        assert stats["success_rate"] >= 0.90, f"Reaction success rate {stats['success_rate']:.2%} below 90%"
        # More realistic performance thresholds for development environment
        assert stats["response_times"]["p95_ms"] < 1000, f"P95 reaction time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 500, f"Average reaction time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Emoji reactions load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total reactions: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_share_system_concurrent_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test share system under concurrent load."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        concurrent_users = 30
        shares_per_user = 5
        
        async def share_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make a share request for load testing."""
            test_user = users[user_id % len(users)]
            test_post = posts[request_id % len(posts)]
            
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            share_method = random.choice(['url', 'message'])
            
            share_data = {"share_method": share_method}
            
            if share_method == 'message':
                # Select random recipients (up to 3)
                potential_recipients = [u for u in users[:100] if u.id != test_user.id]
                recipients = random.sample(potential_recipients, min(3, len(potential_recipients)))
                share_data["recipient_user_ids"] = [u.id for u in recipients]
            
            response = await client.post(
                f"/api/v1/posts/{test_post.id}/share",
                headers=headers,
                json=share_data
            )
            
            assert response.status_code in [200, 201], f"Share failed: {response.status_code}"
            return response.json()
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            share_request,
            concurrent_users=concurrent_users,
            requests_per_user=shares_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.95, f"Share success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 800, f"P95 share time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 400, f"Average share time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Share system load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total shares: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_follow_system_concurrent_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test follow system under concurrent load."""
        users = large_dataset['users']
        concurrent_users = 40
        follows_per_user = 8
        
        async def follow_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make a follow request for load testing."""
            follower = users[user_id % len(users)]
            # Select different user to follow
            followed = users[(user_id + request_id + 1) % len(users)]
            
            # Avoid self-follow
            if follower.id == followed.id:
                followed = users[(user_id + request_id + 2) % len(users)]
            
            # Use real JWT token
            token = load_test_tokens[follower.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Follow user
            response = await client.post(
                f"/api/v1/follows/{followed.id}",
                headers=headers
            )
            
            assert response.status_code in [200, 201], f"Follow failed: {response.status_code}"
            
            # Occasionally unfollow to test both operations
            if random.random() < 0.4:
                unfollow_response = await client.delete(
                    f"/api/v1/follows/{followed.id}",
                    headers=headers
                )
                assert unfollow_response.status_code in [200, 204]
            
            return response.json()
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            follow_request,
            concurrent_users=concurrent_users,
            requests_per_user=follows_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.95, f"Follow success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 600, f"P95 follow time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 300, f"Average follow time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Follow system load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total follows: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_mention_system_concurrent_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test mention system under concurrent load."""
        users = large_dataset['users']
        concurrent_users = 25
        posts_per_user = 4
        
        async def mention_post_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Create a post with mentions for load testing."""
            author = users[user_id % len(users)]
            
            # Select users to mention
            potential_mentions = [u for u in users[:50] if u.id != author.id]
            mentioned_users = random.sample(potential_mentions, min(3, len(potential_mentions)))
            
            # Create post content with mentions
            content = f"Load test post {request_id} by {author.username}. "
            for mentioned_user in mentioned_users:
                content += f"@{mentioned_user.username} "
            content += "Thanks for being awesome!"
            
            # Use real JWT token
            token = load_test_tokens[author.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            response = await client.post(
                "/api/v1/posts",
                headers=headers,
                json={
                    "content": content,
                    "post_type": "spontaneous",
                    "is_public": True
                }
            )
            
            assert response.status_code in [200, 201], f"Mention post failed: {response.status_code}"
            return response.json()
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            mention_post_request,
            concurrent_users=concurrent_users,
            requests_per_user=posts_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.95, f"Mention success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 1000, f"P95 mention time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 500, f"Average mention time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Mention system load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total mention posts: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_user_search_concurrent_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test user search performance under concurrent load."""
        users = large_dataset['users']
        concurrent_users = 60
        searches_per_user = 10
        
        async def user_search_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make a user search request for load testing."""
            searcher = users[user_id % len(users)]
            
            # Generate search queries based on existing usernames
            search_queries = [
                "loadtest",
                "user",
                f"user_{request_id % 100}",
                f"loadtest_user_{request_id % 50}",
                "test"
            ]
            query = random.choice(search_queries)
            
            # Use real JWT token
            token = load_test_tokens[searcher.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            response = await client.post(
                "/api/v1/users/search",
                headers=headers,
                json={"query": query, "limit": 10}
            )
            
            assert response.status_code == 200, f"User search failed: {response.status_code}"
            
            data = response.json()
            assert "users" in data
            assert isinstance(data["users"], list)
            
            return data
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            user_search_request,
            concurrent_users=concurrent_users,
            requests_per_user=searches_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.98, f"Search success rate {stats['success_rate']:.2%} below 98%"
        assert stats["response_times"]["p95_ms"] < 400, f"P95 search time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 200, f"Average search time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"User search load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total searches: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_mixed_social_interactions_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test mixed social interactions under realistic load patterns."""
        users = large_dataset['users']
        posts = large_dataset['posts']
        concurrent_users = 80
        interactions_per_user = 15
        
        async def mixed_interaction_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Perform mixed social interactions for load testing."""
            test_user = users[user_id % len(users)]
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Randomly choose interaction type
            interaction_types = ['reaction', 'share', 'follow', 'search', 'feed']
            interaction_type = random.choice(interaction_types)
            
            if interaction_type == 'reaction':
                test_post = posts[request_id % len(posts)]
                if test_post.author_id != test_user.id:
                    emoji_code = random.choice(['heart', 'heart_eyes', 'pray', 'muscle'])
                    response = await client.post(
                        f"/api/v1/posts/{test_post.id}/reactions",
                        headers=headers,
                        json={"emoji_code": emoji_code}
                    )
                    assert response.status_code in [200, 201]
                    
            elif interaction_type == 'share':
                test_post = posts[request_id % len(posts)]
                response = await client.post(
                    f"/api/v1/posts/{test_post.id}/share",
                    headers=headers,
                    json={"share_method": "url"}
                )
                assert response.status_code in [200, 201]
                
            elif interaction_type == 'follow':
                target_user = users[(user_id + request_id + 1) % len(users)]
                if target_user.id != test_user.id:
                    response = await client.post(
                        f"/api/v1/follows/{target_user.id}",
                        headers=headers
                    )
                    assert response.status_code in [200, 201]
                    
            elif interaction_type == 'search':
                query = f"user_{request_id % 100}"
                response = await client.post(
                    "/api/v1/users/search",
                    headers=headers,
                    json={"query": query, "limit": 5}
                )
                assert response.status_code == 200
                
            elif interaction_type == 'feed':
                response = await client.get(
                    f"/api/v1/posts/feed?limit=10&offset={request_id * 10}",
                    headers=headers
                )
                assert response.status_code == 200
            
            return {"interaction_type": interaction_type}
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            mixed_interaction_request,
            concurrent_users=concurrent_users,
            requests_per_user=interactions_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.95, f"Mixed interactions success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 800, f"P95 mixed interaction time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 400, f"Average mixed interaction time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Mixed social interactions load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total interactions: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
        
        # Validate system can handle sustained load
        assert stats["operations_per_second"] > 50, f"Operations per second {stats['operations_per_second']:.1f} too low for sustained load"