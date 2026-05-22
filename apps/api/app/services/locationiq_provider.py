"""
LocationIQ geocoding provider.
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from app.core.exceptions import UpstreamServiceError

logger = logging.getLogger(__name__)

LOCATIONIQ_BASE_URL = "https://us1.locationiq.com/v1"
MAX_RETRIES = 2


class LocationIQProvider:
    """Geocoding via LocationIQ API."""

    def __init__(self, api_key: str, timeout: float = 5.0):
        self._api_key = api_key
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self._timeout),
            )
        return self._client

    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        search_limit = min(limit, 10)
        client = await self._get_client()

        params = {
            "key": self._api_key,
            "q": query,
            "format": "json",
            "limit": search_limit,
            "addressdetails": 1,
            "dedupe": 1,
        }

        last_error: Optional[Exception] = None

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await client.get(
                    f"{LOCATIONIQ_BASE_URL}/search", params=params
                )

                if response.status_code == 429:
                    logger.error(
                        "LocationIQ returned 429 (rate limited)",
                        extra={"query": query},
                    )
                    raise UpstreamServiceError(
                        "Location search rate limited. Please try again.",
                        constraint="rate_limited",
                        status_code=502,
                    )

                if response.status_code == 401:
                    logger.error("LocationIQ returned 401 (invalid API key)")
                    raise UpstreamServiceError(
                        "Location search service misconfigured.",
                        constraint="upstream_unavailable",
                        status_code=502,
                    )

                if response.status_code in (502, 503, 504) and attempt < MAX_RETRIES:
                    wait = 2 ** attempt
                    logger.warning(
                        "LocationIQ returned %d (attempt %d/%d), retrying in %ds",
                        response.status_code,
                        attempt + 1,
                        MAX_RETRIES,
                        wait,
                    )
                    await asyncio.sleep(wait)
                    continue

                if response.status_code != 200:
                    logger.error(
                        "LocationIQ returned unexpected status: %d",
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
