"""
Location service for handling location autocomplete using OpenStreetMap Nominatim API.
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import ValidationException, BusinessLogicError

logger = logging.getLogger(__name__)


class LocationService(BaseService):
    """Service for location autocomplete and validation."""
    
    NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
    USER_AGENT = "Grateful-Social-App/1.0 (contact@grateful.app)"
    SEARCH_LIMIT = 10
    REQUEST_TIMEOUT = 5.0
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self._client = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with proper headers."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={
                    "User-Agent": self.USER_AGENT,
                    "Accept": "application/json",
                    "Accept-Language": "en"
                },
                timeout=httpx.Timeout(self.REQUEST_TIMEOUT)
            )
        return self._client
    
    async def search_locations(
        self, 
        query: str, 
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for locations using Nominatim API.
        
        Args:
            query: Search query (city, neighborhood, place name)
            limit: Maximum number of results (default: 10, max: 10)
            
        Returns:
            List of location results with display_name, lat, lon, and raw data
            
        Raises:
            ValidationException: If query is invalid
            BusinessLogicError: If API request fails
        """
        # Validate input
        if not query or len(query.strip()) < 2:
            raise ValidationException(
                "Search query must be at least 2 characters long",
                {"query": "Minimum 2 characters required"}
            )
        
        query = query.strip()
        search_limit = min(limit or self.SEARCH_LIMIT, self.SEARCH_LIMIT)
        
        try:
            client = await self._get_client()
            
            # Build search parameters
            params = {
                "q": query,
                "format": "json",
                "limit": search_limit,
                "addressdetails": 1,
                "extratags": 0,
                "namedetails": 0,
                "dedupe": 1,
                "bounded": 0,
                "polygon_geojson": 0
            }
            
            logger.info(f"Searching locations for query: '{query}' (limit: {search_limit})")
            
            # Make API request
            response = await client.get(
                f"{self.NOMINATIM_BASE_URL}/search",
                params=params
            )
            
            if response.status_code != 200:
                logger.error(f"Nominatim API error: {response.status_code} - {response.text}")
                raise BusinessLogicError(
                    "Location search service temporarily unavailable",
                    "nominatim_api_error"
                )
            
            raw_results = response.json()
            
            # Process and format results
            formatted_results = []
            for item in raw_results:
                try:
                    formatted_result = self._format_location_result(item)
                    if formatted_result:
                        formatted_results.append(formatted_result)
                except Exception as e:
                    logger.warning(f"Error formatting location result: {e}")
                    continue
            
            logger.info(f"Found {len(formatted_results)} location results for '{query}'")
            return formatted_results
            
        except httpx.TimeoutException:
            logger.error(f"Nominatim API timeout for query: '{query}'")
            raise BusinessLogicError(
                "Location search timed out. Please try again.",
                "nominatim_timeout"
            )
        except httpx.RequestError as e:
            logger.error(f"Nominatim API request error: {e}")
            raise BusinessLogicError(
                "Location search service unavailable. Please try again later.",
                "nominatim_request_error"
            )
        except Exception as e:
            logger.error(f"Unexpected error in location search: {e}")
            raise BusinessLogicError(
                "Location search failed. Please try again.",
                "location_search_error"
            )
    
    def _format_location_result(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Format a raw Nominatim result into our standard format.
        
        Args:
            raw_item: Raw result from Nominatim API
            
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
        """Clean up HTTP client resources."""
        if self._client:
            await self._client.aclose()
            self._client = None