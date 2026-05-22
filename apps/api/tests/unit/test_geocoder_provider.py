"""
Tests for geocoder provider factory.
"""
import pytest
from app.services.geocoder_provider import create_provider


class TestCreateProvider:
    """Test provider factory creates correct provider based on env vars."""

    def test_default_is_locationiq(self, monkeypatch):
        """Test default GEO_PROVIDER returns LocationIQProvider."""
        monkeypatch.delenv("GEO_PROVIDER", raising=False)
        monkeypatch.setenv("LOCATIONIQ_API_KEY", "test-key")
        provider = create_provider()
        assert provider.__class__.__name__ == "LocationIQProvider"

    def test_nominatim_selected(self, monkeypatch):
        """Test GEO_PROVIDER=nominatim returns NominatimProvider."""
        monkeypatch.setenv("GEO_PROVIDER", "nominatim")
        provider = create_provider()
        assert provider.__class__.__name__ == "NominatimProvider"

    def test_locationiq_selected(self, monkeypatch):
        """Test GEO_PROVIDER=locationiq returns LocationIQProvider."""
        monkeypatch.setenv("GEO_PROVIDER", "locationiq")
        monkeypatch.setenv("LOCATIONIQ_API_KEY", "test-key")
        provider = create_provider()
        assert provider.__class__.__name__ == "LocationIQProvider"

    def test_missing_api_key_raises(self, monkeypatch):
        """Test missing LOCATIONIQ_API_KEY raises ValueError."""
        monkeypatch.setenv("GEO_PROVIDER", "locationiq")
        monkeypatch.delenv("LOCATIONIQ_API_KEY", raising=False)
        with pytest.raises(ValueError, match="LOCATIONIQ_API_KEY"):
            create_provider()

    def test_unknown_provider_raises(self, monkeypatch):
        """Test unknown GEO_PROVIDER raises ValueError."""
        monkeypatch.setenv("GEO_PROVIDER", "nonexistent")
        with pytest.raises(ValueError, match="Unknown GEO_PROVIDER"):
            create_provider()
