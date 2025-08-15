"""
Tests for the likes (hearts) API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from main import app
import uuid

client = TestClient(app)

class TestLikesAPI:
    """Test cases for likes (hearts) API endpoints."""

    def test_heart_endpoints_exist(self):
        """Test that heart endpoints are registered and respond."""
        test_post_id = str(uuid.uuid4())
        
        # Test POST endpoint (should return 401 or 403 without auth)
        response = client.post(f"/api/v1/posts/{test_post_id}/heart")
        assert response.status_code in [401, 403]
        
        # Test DELETE endpoint (should return 401 or 403 without auth)
        response = client.delete(f"/api/v1/posts/{test_post_id}/heart")
        assert response.status_code in [401, 403]
        
        # Test GET endpoint (should return 401 or 403 without auth)
        response = client.get(f"/api/v1/posts/{test_post_id}/hearts")
        assert response.status_code in [401, 403]

    def test_heart_without_auth(self):
        """Test hearting without authentication."""
        fake_post_id = str(uuid.uuid4())
        response = client.post(f"/api/v1/posts/{fake_post_id}/heart")
        
        # Should return 401 or 403 for missing auth
        assert response.status_code in [401, 403]
        
    def test_heart_endpoints_return_proper_errors(self):
        """Test that endpoints return proper error messages."""
        test_post_id = str(uuid.uuid4())
        
        # Test with invalid auth header
        response = client.post(
            f"/api/v1/posts/{test_post_id}/heart",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
        
        response = client.delete(
            f"/api/v1/posts/{test_post_id}/heart",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
        
        response = client.get(
            f"/api/v1/posts/{test_post_id}/hearts",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401