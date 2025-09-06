"""
Integration tests for API contract validation middleware.
"""

import pytest
from httpx import AsyncClient
from fastapi import status


class TestContractValidationMiddleware:
    """Test contract validation middleware functionality."""

    async def test_request_validation_middleware_active(self, http_client: AsyncClient, auth_headers):
        """Test that request validation middleware is active and working."""
        
        # Test with valid post data - should pass
        valid_post_data = {
            "content": "Valid test content",
            "post_type": "daily",
            "is_public": True
        }
        
        response = await http_client.post("/api/v1/posts/", json=valid_post_data, headers=auth_headers)
        assert response.status_code == status.HTTP_201_CREATED
        
        # Verify response structure (API returns post data directly)
        data = response.json()
        # Verify it's a valid post response
        assert "id" in data
        assert "content" in data
        assert "post_type" in data

    async def test_pydantic_validation_errors_handled(self, http_client: AsyncClient, auth_headers):
        """Test that Pydantic validation errors are properly handled by middleware."""
        
        # Test with invalid post type
        invalid_post_data = {
            "content": "Test content",
            "post_type_override": "invalid_type",  # Invalid enum value
            "is_public": True
        }
        
        response = await http_client.post("/api/v1/posts/", json=invalid_post_data, headers=auth_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        data = response.json()
        # FastAPI returns validation errors in standard format
        assert "detail" in data
        assert isinstance(data["detail"], list)

    async def test_content_length_validation(self, http_client: AsyncClient, auth_headers):
        """Test that content length validation works through middleware."""
        
        # Test content too long for post type
        long_content = "x" * 600  # Exceeds daily post limit of 500
        
        invalid_post_data = {
            "content": long_content,
            "post_type": "daily",
            "is_public": True
        }
        
        response = await http_client.post("/api/v1/posts/", json=invalid_post_data, headers=auth_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        data = response.json()
        # FastAPI returns validation errors in standard format
        assert "detail" in data

    async def test_emoji_validation_through_middleware(self, http_client: AsyncClient, auth_headers, test_post_dict):
        """Test that emoji validation works through middleware."""
        
        # Test with valid emoji
        valid_reaction_data = {
            "emoji_code": "heart_eyes"
        }
        
        response = await http_client.post(
            f"/api/v1/posts/{test_post_dict['id']}/reactions",
            json=valid_reaction_data,
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_201_CREATED
        
        # Test with invalid emoji
        invalid_reaction_data = {
            "emoji_code": "invalid_emoji"
        }
        
        response = await http_client.post(
            f"/api/v1/posts/{test_post_dict['id']}/reactions",
            json=invalid_reaction_data,
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_response_structure_validation(self, http_client: AsyncClient, auth_headers):
        """Test that response structure validation is working."""
        
        # Test successful response structure
        response = await http_client.get("/api/v1/posts/feed", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        
        # The feed returns a list of posts directly
        assert isinstance(data, list)
        
        # Verify timestamp format in posts if any exist
        for post in data:
            if "created_at" in post:
                timestamp = post["created_at"]
                assert isinstance(timestamp, str)
                assert len(timestamp) > 0

    async def test_error_response_structure_validation(self, http_client: AsyncClient):
        """Test that error response structure validation is working."""
        
        # Test 404 error structure
        response = await http_client.get("/api/v1/posts/nonexistent-id")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        data = response.json()
        
        # FastAPI returns errors in standard format with 'detail' field
        assert "detail" in data

    async def test_openapi_schema_generation(self, http_client: AsyncClient):
        """Test that enhanced OpenAPI schema is generated correctly."""
        
        response = await http_client.get("/openapi.json")
        assert response.status_code == status.HTTP_200_OK
        
        schema = response.json()
        
        # Verify enhanced schema structure
        assert "openapi" in schema
        assert "info" in schema
        assert "paths" in schema
        assert "components" in schema
        
        # Verify enhanced components
        components = schema["components"]
        assert "schemas" in components
        assert "securitySchemes" in components
        
        # Verify required schemas exist
        schemas = components["schemas"]
        required_schemas = ["ApiSuccessResponse", "ApiErrorResponse"]
        for schema_name in required_schemas:
            assert schema_name in schemas

    async def test_type_safety_middleware_active(self, http_client: AsyncClient, auth_headers):
        """Test that type safety middleware is active."""
        
        # Create a post to test type consistency
        post_data = {
            "content": "Type safety test",
            "post_type": "daily",
            "is_public": True
        }
        
        response = await http_client.post("/api/v1/posts/", json=post_data, headers=auth_headers)
        assert response.status_code == status.HTTP_201_CREATED
        
        data = response.json()
        post_response = data
        
        # Verify type consistency in response
        assert isinstance(post_response["id"], str)
        assert isinstance(post_response["author_id"], int)
        assert isinstance(post_response["content"], str)
        assert isinstance(post_response["is_public"], bool)
        assert isinstance(post_response["hearts_count"], int)
        assert isinstance(post_response["reactions_count"], int)

    async def test_middleware_error_handling(self, http_client: AsyncClient):
        """Test that middleware handles errors gracefully."""
        
        # Test with malformed JSON
        response = await http_client.post(
            "/api/v1/posts/",
            content='{"invalid": json}',  # Malformed JSON
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 422 for validation error or 401 for auth error
        assert response.status_code in [status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_401_UNAUTHORIZED]

    async def test_middleware_performance_impact(self, http_client: AsyncClient, auth_headers):
        """Test that middleware doesn't significantly impact performance."""
        
        import time
        
        # Measure response time for a simple request
        start_time = time.time()
        
        response = await http_client.get("/api/v1/posts/feed", headers=auth_headers)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code == status.HTTP_200_OK
        
        # Response should be reasonably fast (less than 2 seconds for this simple request)
        assert response_time < 2.0, f"Response took {response_time:.2f} seconds, which is too slow"


class TestContractValidationUtilities:
    """Test contract validation utility functions."""

    def test_contract_validator_import(self):
        """Test that contract validator can be imported and used."""
        from app.core.contract_validation import contract_validator
        
        # Test enum validation
        result = contract_validator.validate_emoji_code("heart_eyes")
        assert result == "heart_eyes"
        
        # Test pagination validation
        result = contract_validator.validate_pagination_params(10, 0)
        assert result["limit"] == 10
        assert result["offset"] == 0

    def test_openapi_validator_import(self):
        """Test that OpenAPI validator can be imported."""
        from app.core.openapi_validator import OpenAPIValidator
        from main import app
        
        validator = OpenAPIValidator(app)
        schema = validator.generate_enhanced_schema()
        
        # Verify basic schema structure
        assert "openapi" in schema
        assert "info" in schema
        assert "paths" in schema

    def test_validation_decorators_import(self):
        """Test that validation decorators can be imported."""
        from app.core.validation_decorators import (
            validate_request_body,
            validate_response_body,
            validate_enum_param,
            validate_pagination_params,
            contract_validated
        )
        
        # Just verify they can be imported without errors
        assert callable(validate_request_body)
        assert callable(validate_response_body)
        assert callable(validate_enum_param)
        assert callable(validate_pagination_params)
        assert callable(contract_validated)