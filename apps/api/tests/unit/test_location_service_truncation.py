"""
Tests for location service truncation functionality.
"""

import pytest
from unittest.mock import AsyncMock, patch
from app.services.location_service import LocationService


class TestLocationServiceTruncation:
    """Test location service truncation functionality."""

    @pytest.fixture
    async def location_service(self, db_session):
        """Create LocationService instance for testing."""
        service = LocationService(db_session)
        yield service
        await service.cleanup()

    @pytest.mark.asyncio
    async def test_format_location_result_truncation(self, location_service):
        """Test that long location names are properly truncated."""
        # Create a mock result with a very long display name
        long_name = "Condomínio Jerusa, 920, Meireles, Fortaleza, Região Geográfica Imediata de Fortaleza, Região Geográfica Intermediária de Fortaleza, Ceará, Northeast Region, 60165-070, Brazil, South America, Planet Earth"
        
        raw_item = {
            "display_name": long_name,
            "lat": "-3.7327",
            "lon": "-38.5267",
            "place_id": "123456",
            "osm_type": "way",
            "osm_id": "789012",
            "address": {
                "city": "Fortaleza",
                "state": "Ceará",
                "country": "Brazil",
                "country_code": "br"
            },
            "importance": 0.5,
            "type": "residential",
            "class": "place"
        }

        # Test with default max_length (150)
        result = location_service._format_location_result(raw_item)
        
        assert result is not None
        assert len(result["display_name"]) <= 150
        assert result["display_name"].endswith("...")
        assert result["lat"] == -3.7327
        assert result["lon"] == -38.5267

    @pytest.mark.asyncio
    async def test_format_location_result_custom_max_length(self, location_service):
        """Test truncation with custom max_length."""
        long_name = "This is a very long location name that should be truncated"
        
        raw_item = {
            "display_name": long_name,
            "lat": "40.7128",
            "lon": "-74.0060",
            "place_id": "123456",
            "address": {}
        }

        # Test with custom max_length of 30
        result = location_service._format_location_result(raw_item, max_length=30)
        
        assert result is not None
        assert len(result["display_name"]) <= 30
        assert result["display_name"].endswith("...")
        assert result["display_name"] == "This is a very long locatio..."

    @pytest.mark.asyncio
    async def test_format_location_result_no_truncation_needed(self, location_service):
        """Test that short location names are not truncated."""
        short_name = "New York, NY, USA"
        
        raw_item = {
            "display_name": short_name,
            "lat": "40.7128",
            "lon": "-74.0060",
            "place_id": "123456",
            "address": {}
        }

        result = location_service._format_location_result(raw_item)
        
        assert result is not None
        assert result["display_name"] == short_name
        assert not result["display_name"].endswith("...")

    def test_truncation_logic_directly(self, location_service):
        """Test the truncation logic directly without HTTP mocking."""
        # Test case 1: Long name that needs truncation
        long_raw_item = {
            "display_name": "This is a very long location name that should be truncated by the service",
            "lat": "40.7128",
            "lon": "-74.0060",
            "place_id": "123456",
            "address": {}
        }
        
        result = location_service._format_location_result(long_raw_item, max_length=50)
        assert result is not None
        assert len(result["display_name"]) <= 50
        assert result["display_name"].endswith("...")
        
        # Test case 2: Short name that doesn't need truncation
        short_raw_item = {
            "display_name": "Short location",
            "lat": "40.7128",
            "lon": "-74.0060",
            "place_id": "123456",
            "address": {}
        }
        
        result = location_service._format_location_result(short_raw_item, max_length=50)
        assert result is not None
        assert result["display_name"] == "Short location"
        assert not result["display_name"].endswith("...")