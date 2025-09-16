"""
Load testing for public endpoints that don't require authentication.

Tests health checks and other public endpoints under concurrent load.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Load tests disabled for development - configure for production deployment")

import asyncio
import time
import random
from typing import Dict, Any, List
import httpx
import json

from .conftest import ConcurrentTestRunner, LoadTestMetrics


class TestPublicEndpointsLoad:
    """Load tests for public endpoints."""
    
    @pytest.mark.asyncio
    async def test_health_endpoint_concurrent_load(
        self,
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test health endpoint under concurrent load."""
        concurrent_users = 10
        requests_per_user = 5
        
        async def health_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make a health check request for load testing."""
            response = await client.get("/health")
            assert response.status_code == 200, f"Health check failed: {response.status_code}"
            
            data = response.json()
            assert "status" in data
            assert data["status"] == "healthy"
            
            return data
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            health_request,
            concurrent_users=concurrent_users,
            requests_per_user=requests_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.99, f"Health check success rate {stats['success_rate']:.2%} below 99%"
        assert stats["response_times"]["p95_ms"] < 500, f"P95 health check time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 200, f"Average health check time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Health endpoint load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total requests: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_mixed_public_endpoints_load(
        self,
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test mixed public endpoints under concurrent load."""
        concurrent_users = 5
        requests_per_user = 4
        
        async def mixed_public_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Make mixed public endpoint requests for load testing."""
            
            # Randomly choose endpoint type
            endpoint_types = ['health', 'docs']
            endpoint_type = random.choice(endpoint_types)
            
            if endpoint_type == 'health':
                response = await client.get("/health")
                assert response.status_code == 200
                data = response.json()
                assert "status" in data
                
            elif endpoint_type == 'docs':
                response = await client.get("/docs")
                assert response.status_code == 200
                # Docs endpoint returns HTML
                assert "text/html" in response.headers.get("content-type", "")
            
            return {"endpoint_type": endpoint_type}
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            mixed_public_request,
            concurrent_users=concurrent_users,
            requests_per_user=requests_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.98, f"Mixed public endpoints success rate {stats['success_rate']:.2%} below 98%"
        assert stats["response_times"]["p95_ms"] < 600, f"P95 mixed endpoint time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 300, f"Average mixed endpoint time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Mixed public endpoints load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total requests: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
        
        # Validate system can handle sustained load
        assert stats["operations_per_second"] > 20, f"Operations per second {stats['operations_per_second']:.1f} too low for sustained load"