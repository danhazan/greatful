"""
Tests for LocationIQ geocoding provider.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock
import httpx
from app.services.locationiq_provider import LocationIQProvider
from app.core.exceptions import UpstreamServiceError


class TestLocationIQProvider:
    """Test LocationIQ provider search and retry behavior."""

    @pytest.fixture
    def provider(self):
        return LocationIQProvider(api_key="test-key", timeout=5.0)

    def _make_response(self, status_code: int, json_data=None):
        """Create a mock HTTP response (MagicMock — not awaited after get())."""
        mock = MagicMock()
        mock.status_code = status_code
        if json_data is not None:
            mock.json.return_value = json_data
        return mock

    @pytest.mark.asyncio
    async def test_success(self, provider):
        """Test successful search returns formatted results."""
        mock_response = self._make_response(200, [
            {"display_name": "Berlin, Germany", "lat": "52.5200", "lon": "13.4050"}
        ])
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        provider._client = mock_client

        results = await provider.search("Berlin")

        assert len(results) == 1
        assert results[0]["display_name"] == "Berlin, Germany"

    @pytest.mark.asyncio
    async def test_empty_results(self, provider):
        """Test empty result list from upstream."""
        mock_response = self._make_response(200, [])
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        provider._client = mock_client

        results = await provider.search("Nowhere")
        assert results == []

    @pytest.mark.asyncio
    async def test_429_not_retried(self, provider):
        """Test 429 is NOT retried and raises immediately."""
        mock_response = self._make_response(429)
        mock_response.headers = {"Retry-After": "0"}
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        provider._client = mock_client

        with pytest.raises(UpstreamServiceError) as exc:
            await provider.search("Berlin")

        assert exc.value.status_code == 502
        assert exc.value.details["constraint"] == "rate_limited"
        mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_401_bad_api_key(self, provider):
        """Test 401 (bad API key) raises immediately."""
        mock_response = self._make_response(401)
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        provider._client = mock_client

        with pytest.raises(UpstreamServiceError) as exc:
            await provider.search("Berlin")

        assert exc.value.status_code == 502
        assert exc.value.details["constraint"] == "upstream_unavailable"
        mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_502_retried_once(self, provider):
        """Test 502 is retried once then succeeds."""
        mock_502 = self._make_response(502)
        mock_200 = self._make_response(200, [])
        mock_client = AsyncMock()
        mock_client.get.side_effect = [mock_502, mock_200]
        provider._client = mock_client

        results = await provider.search("Berlin")

        assert results == []
        assert mock_client.get.call_count == 2

    @pytest.mark.asyncio
    async def test_502_retry_exhausted(self, provider):
        """Test 502 after max retries raises error."""
        mock_502 = self._make_response(502)
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_502
        provider._client = mock_client

        with pytest.raises(UpstreamServiceError) as exc:
            await provider.search("Berlin")

        assert exc.value.details["constraint"] == "upstream_unavailable"
        assert mock_client.get.call_count == 3

    @pytest.mark.asyncio
    async def test_timeout_retried(self, provider):
        """Test timeout is retried then succeeds."""
        mock_200 = self._make_response(200, [])
        mock_client = AsyncMock()
        mock_client.get.side_effect = [httpx.TimeoutException("timeout"), mock_200]
        provider._client = mock_client

        results = await provider.search("Berlin")

        assert results == []
        assert mock_client.get.call_count == 2

    @pytest.mark.asyncio
    async def test_timeout_exhausted(self, provider):
        """Test timeout after max retries raises 504 error."""
        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.TimeoutException("timeout")
        provider._client = mock_client

        with pytest.raises(UpstreamServiceError) as exc:
            await provider.search("Berlin")

        assert exc.value.status_code == 504
        assert exc.value.details["constraint"] == "request_failed"
        assert mock_client.get.call_count == 3

    @pytest.mark.asyncio
    async def test_close(self, provider):
        """Test close cleans up the HTTP client."""
        mock_client = AsyncMock()
        provider._client = mock_client
        await provider.close()
        mock_client.aclose.assert_called_once()
        assert provider._client is None

    @pytest.mark.asyncio
    async def test_close_without_client(self, provider):
        """Test close with no client does not error."""
        assert provider._client is None
        await provider.close()
