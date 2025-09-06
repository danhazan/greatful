"""
Integration tests for location search API.
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


class TestLocationAPI:
    """Test location search API endpoints."""

    def test_location_search_success(self, client, auth_headers):
        """Test successful location search."""
        mock_results = [
            {
                "display_name": "New York, NY, USA",
                "lat": 40.7128,
                "lon": -74.0060,
                "place_id": "123",
                "address": {
                    "city": "New York",
                    "state": "NY", 
                    "country": "USA"
                }
            }
        ]
        
        with patch('app.services.location_service.LocationService.search_locations') as mock_search:
            mock_search.return_value = mock_results
            
            response = client.post(
                "/api/v1/users/location/search",
                json={"query": "New York", "limit": 10},
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert len(data["data"]) == 1
            assert data["data"][0]["display_name"] == "New York, NY, USA"
            assert data["data"][0]["lat"] == 40.7128
            assert data["data"][0]["lon"] == -74.0060

    def test_location_search_empty_query(self, client, auth_headers):
        """Test location search with empty query."""
        response = client.post(
            "/api/v1/users/location/search",
            json={"query": "", "limit": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error

    def test_location_search_short_query(self, client, auth_headers):
        """Test location search with query too short."""
        response = client.post(
            "/api/v1/users/location/search",
            json={"query": "N", "limit": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error

    def test_location_search_unauthorized(self, client):
        """Test location search without authentication."""
        response = client.post(
            "/api/v1/users/location/search",
            json={"query": "New York", "limit": 10}
        )
        
        assert response.status_code == 403  # FastAPI returns 403 for missing auth

    def test_location_search_limit_validation(self, client, auth_headers):
        """Test location search with limit validation."""
        mock_results = []
        
        with patch('app.services.location_service.LocationService.search_locations') as mock_search:
            mock_search.return_value = mock_results
            
            # Test with limit too high
            response = client.post(
                "/api/v1/users/location/search",
                json={"query": "New York", "limit": 50},
                headers=auth_headers
            )
            
            assert response.status_code == 200
            # Should be capped at 10
            mock_search.assert_called_with(query="New York", limit=10, max_length=150)

    def test_location_search_service_error(self, client, auth_headers):
        """Test location search when service raises error."""
        from app.core.exceptions import BusinessLogicError
        
        with patch('app.services.location_service.LocationService.search_locations') as mock_search:
            mock_search.side_effect = BusinessLogicError("API unavailable", "nominatim_error")
            
            response = client.post(
                "/api/v1/users/location/search",
                json={"query": "New York", "limit": 10},
                headers=auth_headers
            )
            
            assert response.status_code == 400
            data = response.json()
            # Should use our standardized error format
            assert "error" in data
            assert data["error"]["code"] == "business_logic_error"
            assert "API unavailable" in data["error"]["message"]
            assert data["error"]["details"]["constraint"] == "nominatim_error"

    def test_location_search_cleanup(self, client, auth_headers):
        """Test that location service cleanup is called."""
        mock_results = []
        
        with patch('app.services.location_service.LocationService.search_locations') as mock_search, \
             patch('app.services.location_service.LocationService.cleanup') as mock_cleanup:
            
            mock_search.return_value = mock_results
            
            response = client.post(
                "/api/v1/users/location/search",
                json={"query": "New York", "limit": 10},
                headers=auth_headers
            )
            
            assert response.status_code == 200
            # Verify cleanup was called
            mock_cleanup.assert_called_once()