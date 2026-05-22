"""
Geocoding provider interface and factory.
"""
from typing import Protocol, List, Dict, Any
import os


class GeocoderProvider(Protocol):
    """Protocol for geocoding search providers.

    Implementations must return results in Nominatim-compatible JSON format.
    """

    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        ...

    async def close(self) -> None:
        ...


def create_provider() -> GeocoderProvider:
    """Create configured provider based on GEO_PROVIDER env var."""
    provider_name = os.getenv("GEO_PROVIDER", "locationiq").lower()
    timeout = float(os.getenv("GEO_REQUEST_TIMEOUT", "5.0"))

    if provider_name == "nominatim":
        from app.services.nominatim_provider import NominatimProvider
        return NominatimProvider(timeout=timeout)
    elif provider_name == "locationiq":
        from app.services.locationiq_provider import LocationIQProvider
        api_key = os.getenv("LOCATIONIQ_API_KEY")
        if not api_key:
            raise ValueError(
                "LOCATIONIQ_API_KEY environment variable is required "
                "when GEO_PROVIDER=locationiq"
            )
        return LocationIQProvider(api_key=api_key, timeout=timeout)
    else:
        raise ValueError(f"Unknown GEO_PROVIDER: {provider_name}")
