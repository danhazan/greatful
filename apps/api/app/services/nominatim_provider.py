"""
Nominatim geocoding provider.
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from app.core.exceptions import UpstreamServiceError

logger = logging.getLogger(__name__)

NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
DEFAULT_USER_AGENT = "Grateful-Social-App/1.0 (contact@grateful.app)"
MAX_RETRIES = 2


class NominatimProvider:
    """Geocoding via OpenStreetMap Nominatim API."""

    def __init__(self, timeout: float = 5.0):
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={
                    "User-Agent": DEFAULT_USER_AGENT,
                    "Accept": "application/json",
                    "Accept-Language": "en",
                },
                timeout=httpx.Timeout(self._timeout),
            )
        return self._client

    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        search_limit = min(limit, 10)
        client = await self._get_client()

        params = {
            "q": query,
            "format": "json",
            "limit": search_limit,
            "addressdetails": 1,
            "extratags": 0,
            "namedetails": 0,
            "dedupe": 1,
            "bounded": 0,
            "polygon_geojson": 0,
        }

        last_error: Optional[Exception] = None

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await client.get(
                    f"{NOMINATIM_BASE_URL}/search", params=params
                )

                if response.status_code == 429:
                    logger.error(
                        "Nominatim returned 429 (blocked/rate limited)",
                        extra={"query": query},
                    )
                    raise UpstreamServiceError(
                        "Location search rate limited. Please try again.",
                        constraint="rate_limited",
                        status_code=502,
                    )

                if response.status_code in (502, 503, 504) and attempt < MAX_RETRIES:
                    wait = 2 ** attempt
                    logger.warning(
                        "Nominatim returned %d (attempt %d/%d), retrying in %ds",
                        response.status_code,
                        attempt + 1,
                        MAX_RETRIES,
                        wait,
                    )
                    await asyncio.sleep(wait)
                    continue

                if response.status_code != 200:
                    logger.error(
                        "Nominatim returned unexpected status: %d",
                        response.status_code,
                        extra={"query": query},
                    )
                    raise UpstreamServiceError(
                        "Location search service temporarily unavailable.",
                        constraint="upstream_unavailable",
                    )

                return response.json()

            except (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError) as e:
                last_error = e
                if attempt < MAX_RETRIES:
                    wait = 2 ** attempt
                    logger.warning(
                        "%s on attempt %d/%d, retrying in %ds",
                        type(e).__name__,
                        attempt + 1,
                        MAX_RETRIES,
                        wait,
                    )
                    await asyncio.sleep(wait)
                    continue
                logger.error(
                    "%s exhausted after %d retries for query: %s",
                    type(e).__name__,
                    MAX_RETRIES,
                    query,
                )
                raise UpstreamServiceError(
                    "Location search request failed.",
                    constraint="request_failed",
                    status_code=504,
                ) from last_error

        raise UpstreamServiceError(
            "Location search request failed.",
            constraint="request_failed",
            status_code=504,
        ) from last_error

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
