import pytest
import os
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.exc import SQLAlchemyError
from app.services.share_service import ShareService
from app.services.enhanced_share_service import EnhancedShareService
from app.core.exceptions import BusinessLogicError

class TestEnhancedShareService:
    @pytest.fixture
    def mock_core_service(self):
        return MagicMock(spec=ShareService)

    @pytest.fixture
    def enhanced_service(self, mock_core_service):
        return EnhancedShareService(mock_core_service)

    @pytest.mark.asyncio
    async def test_delegation(self, enhanced_service, mock_core_service):
        """Verify EnhancedShareService delegates share_via_url to core."""
        mock_core_service.share_via_url = AsyncMock(return_value={"status": "success"})
        
        result = await enhanced_service.share_via_url(1, "post-123")
        
        mock_core_service.share_via_url.assert_called_once_with(1, "post-123")
        assert result == {"status": "success"}

    @pytest.mark.asyncio
    async def test_rate_limit_resilience_prod(self, enhanced_service, mock_core_service):
        """Verify fallback triggers on SQLAlchemyError in production."""
        mock_core_service.check_rate_limit = AsyncMock(side_effect=SQLAlchemyError("DB Down"))
        
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            result = await enhanced_service.check_rate_limit(1)
            
            assert result["is_exceeded"] is False
            assert result["is_fallback"] is True
            assert result["max_allowed"] == 20

    @pytest.mark.asyncio
    async def test_rate_limit_fail_fast_dev(self, enhanced_service, mock_core_service):
        """Verify exception propagates in development (fail-fast)."""
        mock_core_service.check_rate_limit = AsyncMock(side_effect=SQLAlchemyError("DB Down"))
        
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            with pytest.raises(SQLAlchemyError):
                await enhanced_service.check_rate_limit(1)

    @pytest.mark.asyncio
    async def test_url_gen_resilience_prod(self, enhanced_service, mock_core_service):
        """Verify URL fallback works in production when core fails."""
        mock_core_service.generate_share_url = AsyncMock(side_effect=asyncio.TimeoutError())
        
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            url = await enhanced_service.generate_share_url("post-123")
            assert "grateful-net.vercel.app" in url

    @pytest.mark.asyncio
    async def test_url_gen_business_logic_error_prod(self, enhanced_service, mock_core_service):
        """Verify BusinessLogicError (missing env) also triggers fallback in prod."""
        mock_core_service.generate_share_url = AsyncMock(side_effect=BusinessLogicError("Missing Env"))
        
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            url = await enhanced_service.generate_share_url("post-123")
            assert "grateful-net.vercel.app" in url

    @pytest.mark.asyncio
    async def test_passthrough_getattr(self, enhanced_service, mock_core_service):
        """Verify __getattr__ passes un-wrapped methods to core."""
        mock_core_service.get_share_counts = AsyncMock(return_value={"total": 10})
        
        # get_share_counts is not explicitly wrapped in EnhancedShareService
        result = await enhanced_service.get_share_counts("post-123")
        
        mock_core_service.get_share_counts.assert_called_once_with("post-123")
        assert result == {"total": 10}
