"""
Integration tests for batch username validation endpoint.
"""

import pytest
from httpx import AsyncClient
from main import app
from app.core.security import create_access_token


class TestBatchUsernameValidation:
    """Test batch username validation endpoint."""

    async def test_validate_usernames_batch_success(
        self, 
        async_client: AsyncClient, 
        test_user,
        test_user_2
    ):
        """Test successful batch username validation."""
        # Create access token for test user
        token = create_access_token({"sub": str(test_user.id)})
        
        # Test with mix of valid and invalid usernames
        usernames = [test_user.username, test_user_2.username, "nonexistent_user"]
        
        response = await async_client.post(
            "/api/v1/users/validate-batch",
            json={"usernames": usernames},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        # Should have valid usernames
        assert test_user.username in data["valid_usernames"]
        assert test_user_2.username in data["valid_usernames"]
        
        # Should have invalid usernames
        assert "nonexistent_user" in data["invalid_usernames"]

    async def test_validate_usernames_batch_empty_list(
        self, 
        async_client: AsyncClient, 
        test_user
    ):
        """Test batch validation with empty username list."""
        token = create_access_token({"sub": str(test_user.id)})
        
        response = await async_client.post(
            "/api/v1/users/validate-batch",
            json={"usernames": []},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        assert data["valid_usernames"] == []
        assert data["invalid_usernames"] == []

    async def test_validate_usernames_batch_limit(
        self, 
        async_client: AsyncClient, 
        test_user
    ):
        """Test batch validation respects 50 username limit."""
        token = create_access_token({"sub": str(test_user.id)})
        
        # Create list of 60 usernames (should be limited to 50)
        usernames = [f"user{i}" for i in range(60)]
        
        response = await async_client.post(
            "/api/v1/users/validate-batch",
            json={"usernames": usernames},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        # Should process maximum 50 usernames
        total_processed = len(data["valid_usernames"]) + len(data["invalid_usernames"])
        assert total_processed <= 50

    async def test_validate_usernames_batch_duplicates(
        self, 
        async_client: AsyncClient, 
        test_user
    ):
        """Test batch validation handles duplicate usernames."""
        token = create_access_token({"sub": str(test_user.id)})
        
        # Include duplicates
        usernames = [test_user.username, test_user.username, "nonexistent"]
        
        response = await async_client.post(
            "/api/v1/users/validate-batch",
            json={"usernames": usernames},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        # Should only appear once in results
        assert data["valid_usernames"].count(test_user.username) == 1

    async def test_validate_usernames_batch_requires_auth(
        self, 
        async_client: AsyncClient
    ):
        """Test batch validation requires authentication."""
        response = await async_client.post(
            "/api/v1/users/validate-batch",
            json={"usernames": ["testuser"]}
        )
        
        assert response.status_code == 403

    async def test_validate_usernames_batch_invalid_request(
        self, 
        async_client: AsyncClient, 
        test_user
    ):
        """Test batch validation with invalid request body."""
        token = create_access_token({"sub": str(test_user.id)})
        
        response = await async_client.post(
            "/api/v1/users/validate-batch",
            json={"invalid_field": "value"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 422

    async def test_validate_usernames_batch_database_error(
        self, 
        async_client: AsyncClient, 
        test_user,
        monkeypatch
    ):
        """Test batch validation handles database errors gracefully."""
        from app.services.user_service import UserService
        
        token = create_access_token({"sub": str(test_user.id)})
        
        async def mock_validate_batch(*args, **kwargs):
            raise Exception("Database connection error")
        
        monkeypatch.setattr(UserService, "validate_usernames_batch", mock_validate_batch)
        
        response = await async_client.post(
            "/api/v1/users/validate-batch",
            json={"usernames": ["testuser"]},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 500