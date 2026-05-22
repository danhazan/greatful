"""
Location service for handling location autocomplete.
"""
import logging
import time
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import ValidationException
from app.services.geocoder_provider import create_provider, GeocoderProvider

logger = logging.getLogger(__name__)

SEARCH_LIMIT = 10


class LocationService(BaseService):
    """Service for location autocomplete and validation."""

    def __init__(self, db: AsyncSession, provider: Optional[GeocoderProvider] = None):
        super().__init__(db)
        self._provider = provider or create_provider()
    
    async def search_locations(
        self, 
        query: str, 
        limit: Optional[int] = None,
        max_length: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for locations using configured geocoding provider.

        Args:
            query: Search query (city, neighborhood, place name)
            limit: Maximum number of results (default: 10, max: 10)
            max_length: Maximum length for display_name (default: 150)

        Returns:
            List of location results with display_name, lat, lon, and raw data

        Raises:
            ValidationException: If query is invalid
        """
        if not query or len(query.strip()) < 2:
            raise ValidationException(
                "Search query must be at least 2 characters long",
                {"query": "Minimum 2 characters required"}
            )

        query = query.strip()
        search_limit = min(limit or SEARCH_LIMIT, SEARCH_LIMIT)
        max_display_length = max_length or 150

        start = time.monotonic()
        raw_results = await self._provider.search(query, search_limit)
        elapsed = time.monotonic() - start

        formatted_results = []
        for item in raw_results:
            try:
                formatted = self._format_location_result(item, max_display_length)
                if formatted:
                    formatted_results.append(formatted)
            except Exception as e:
                logger.warning("Error formatting location result: %s", e)
                continue

        logger.info(
            "Location search completed",
            extra={
                "query": query,
                "provider": type(self._provider).__name__,
                "result_count": len(formatted_results),
                "latency_ms": round(elapsed * 1000),
            },
        )
        return formatted_results
    
    def _format_location_result(self, raw_item: Dict[str, Any], max_length: int = 150) -> Optional[Dict[str, Any]]:
        """
        Format a raw geocoding result into our standard format.
        
        Args:
            raw_item: Raw result from the geocoding provider
            max_length: Maximum length for display_name
            
        Returns:
            Formatted location result or None if invalid
        """
        try:
            # Extract required fields
            display_name = raw_item.get("display_name", "").strip()
            lat = raw_item.get("lat")
            lon = raw_item.get("lon")
            
            if not display_name or not lat or not lon:
                return None
            
            # Truncate display_name if it exceeds max_length
            if len(display_name) > max_length:
                display_name = display_name[:max_length-3] + "..."
            
            # Convert coordinates to float
            try:
                lat_float = float(lat)
                lon_float = float(lon)
            except (ValueError, TypeError):
                return None
            
            # Extract address components
            address = raw_item.get("address", {})
            
            # Build formatted result
            result = {
                "display_name": display_name,
                "lat": lat_float,
                "lon": lon_float,
                "place_id": raw_item.get("place_id"),
                "osm_type": raw_item.get("osm_type"),
                "osm_id": raw_item.get("osm_id"),
                "address": {
                    "city": address.get("city") or address.get("town") or address.get("village"),
                    "state": address.get("state"),
                    "country": address.get("country"),
                    "country_code": address.get("country_code"),
                    "postcode": address.get("postcode")
                },
                "importance": raw_item.get("importance", 0),
                "type": raw_item.get("type"),
                "class": raw_item.get("class")
            }
            
            return result
            
        except Exception as e:
            logger.warning(f"Error formatting location result: {e}")
            return None
    
    def validate_location_data(self, location_data: Dict[str, Any]) -> bool:
        """
        Validate location data structure.
        
        Args:
            location_data: Location data to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            required_fields = ["display_name", "lat", "lon"]
            
            for field in required_fields:
                if field not in location_data:
                    return False
            
            # Validate coordinates
            lat = location_data["lat"]
            lon = location_data["lon"]
            
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                return False
            
            # Check coordinate ranges
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                return False
            
            # Validate display name
            display_name = location_data["display_name"]
            if not isinstance(display_name, str) or len(display_name.strip()) == 0:
                return False
            
            return True
            
        except Exception:
            return False
    
    async def cleanup(self):
        """Clean up provider HTTP client resources."""
        await self._provider.close()