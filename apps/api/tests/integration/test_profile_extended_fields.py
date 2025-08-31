"""
Integration tests for extended profile fields (location, institutions, websites, display_name).
"""

import pytest
from fastapi.testclient import TestClient


class TestExtendedProfileFields:
    """Test extended profile field updates."""

    def test_update_profile_with_extended_fields(self, client, auth_headers):
        """Test updating profile with all new extended fields."""
        
        # Test data with all new fields
        update_data = {
            "username": "updated_user",
            "bio": "Updated bio with new information",
            "display_name": "Updated Display Name",
            "city": "New York",
            "location_data": {
                "display_name": "New York, NY, USA",
                "lat": 40.7128,
                "lon": -74.0060,
                "address": {
                    "city": "New York",
                    "state": "NY",
                    "country": "USA"
                }
            },
            "institutions": ["Harvard University", "Google Inc."],
            "websites": ["https://example.com", "https://github.com/user"]
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        
        profile = data["data"]
        assert profile["username"] == "updated_user"
        assert profile["bio"] == "Updated bio with new information"
        assert profile["display_name"] == "Updated Display Name"
        assert profile["city"] == "New York"
        assert profile["location"]["display_name"] == "New York, NY, USA"
        assert profile["institutions"] == ["Harvard University", "Google Inc."]
        assert profile["websites"] == ["https://example.com", "https://github.com/user"]

    def test_update_profile_with_empty_arrays(self, client, auth_headers):
        """Test updating profile with empty arrays for institutions and websites."""
        
        update_data = {
            "username": "test_user",
            "bio": "Test bio",
            "institutions": [],
            "websites": []
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        profile = data["data"]
        assert profile["institutions"] == []
        assert profile["websites"] == []

    def test_update_profile_with_null_location(self, client, auth_headers):
        """Test updating profile with null location data."""
        
        update_data = {
            "username": "test_user",
            "bio": "Test bio",
            "location_data": None
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        profile = data["data"]
        assert profile["location"] is None

    def test_update_profile_validation_errors(self, client, auth_headers):
        """Test validation errors for extended fields."""
        
        # Test with too many institutions
        update_data = {
            "institutions": [f"Institution {i}" for i in range(15)]  # More than 10
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        
        # Test with too many websites
        update_data = {
            "websites": [f"https://example{i}.com" for i in range(10)]  # More than 5
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422

    def test_update_profile_invalid_website_urls(self, client, auth_headers):
        """Test validation for invalid website URLs."""
        
        update_data = {
            "websites": ["not-a-valid-url", "ftp://invalid-protocol.com"]
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422