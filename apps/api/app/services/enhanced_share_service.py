"""
Enhanced ShareService with production-grade resilience and infrastructure concern wrapping.
Uses composition to wrap the core ShareService.
"""

from typing import List, Optional, Dict, Any
import logging
import os
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from app.core.exceptions import BusinessLogicError
from app.core.query_monitor import monitor_query
from app.services.share_service import ShareService

logger = logging.getLogger(__name__)


class EnhancedShareService:
    """
    Infrastructure wrapper for ShareService that adds:
    1. Production-grade resilience (soft-fails for transient infra errors)
    2. Orchestrated Monitoring (@monitor_query on entry points)
    3. Environment-aware URL resolution
    """

    def __init__(self, core_service: ShareService):
        self._core = core_service

    @monitor_query("enhanced_generate_share_url")
    async def generate_share_url(self, post_id: str) -> str:
        """Core wrapper for URL generation with environment fallbacks."""
        try:
            return await self._core.generate_share_url(post_id)
        except BusinessLogicError:
            # Re-raise logic errors (e.g. MISSING_ENV_VAR) but add fallbacks in prod
            if os.getenv("ENVIRONMENT") == "production":
                logger.warning(
                    f"[RESILIENCE_LAYER_FALLBACK] Missing config for post {post_id}. Using static fallback."
                )
                return f"https://grateful-net.vercel.app/post/{post_id}"
            raise
        except (SQLAlchemyError, asyncio.TimeoutError, ConnectionError) as e:
            logger.error(f"[RESILIENCE_LAYER_FALLBACK] Infrastructure error: {str(e)}")
            return f"https://grateful-net.vercel.app/post/{post_id}"

    @monitor_query("enhanced_share_via_url")
    async def share_via_url(self, user_id: int, post_id: str) -> Dict[str, Any]:
        """
        Record a URL share using a resilient flow.
        Ensures production-grade URL fallback is used if core generation fails.
        """
        # We manually orchestrate the resilient flow using core components
        # to ensure the wrapper's generate_share_url (with fallbacks) is used.
        
        # 1. Privacy/Validation (using core logic)
        # Note: We rely on the core methods via delegation if they were public,
        # but here we'll use a try-except wrap around the whole core call 
        # as a primary path, and a 'degraded' path for failures.
        try:
            return await self._core.share_via_url(user_id, post_id)
        except (BusinessLogicError, SQLAlchemyError, asyncio.TimeoutError, ConnectionError) as e:
            if os.getenv("ENVIRONMENT") == "production":
                logger.warning(f"[RESILIENCE_LAYER_FALLBACK] share_via_url failed, providing fallback: {str(e)}")
                # Provide a minimal valid response even if recording failed
                fallback_url = await self.generate_share_url(post_id)
                return {
                    "id": None, # Recording failed
                    "user_id": user_id,
                    "post_id": post_id,
                    "share_method": "url",
                    "share_url": fallback_url,
                    "created_at": None,
                    "is_fallback": True
                }
            raise

    @monitor_query("enhanced_share_via_whatsapp")
    async def share_via_whatsapp(
        self, user_id: int, post_id: str, phone_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """Wrap core WhatsApp sharing."""
        return await self._core.share_via_whatsapp(user_id, post_id)

    @monitor_query("enhanced_share_via_message")
    async def share_via_message(
        self, sender_id: int, post_id: str, recipient_ids: List[int], message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Wrap core direct message sharing with resilient rate limiting.
        Exercises the wrapper's check_rate_limit before delegating to core.
        """
        # Exercise the resilient rate limit check first
        await self.check_rate_limit(sender_id)
        
        # Then delegate to core for the record creation and notifications
        return await self._core.share_via_message(sender_id, post_id, recipient_ids, message)

    async def check_rate_limit(self, user_id: int) -> Dict[str, Any]:
        """
        Check rate limit with a targeted fallback for infrastructure failures.
        Emits explicit metrics for observability during bypass events.
        """
        try:
            return await self._core.check_rate_limit(user_id)
        except (SQLAlchemyError, asyncio.TimeoutError, ConnectionError) as e:
            # Emit a structured log for infra alerts
            logger.warning(
                f"[RESILIENCE_METRIC] type=rate_limit_bypass user_id={user_id} error=\"{str(e)}\""
            )
            
            # In production, we allow the share if the rate limit infrastructure fails
            if os.getenv("ENVIRONMENT") == "production":
                logger.info(f"Bypassing rate limit for user {user_id} due to transient infrastructure failure.")
                return {
                    "current_count": 0,
                    "max_allowed": 20,
                    "remaining": 20,
                    "is_exceeded": False,
                    "reset_time": None,
                    "is_fallback": True,
                    "fallback_reason": str(e)
                }
            raise

    # Delegate other non-public or non-resilient methods directly if needed
    def __getattr__(self, name):
        """Pass-through for un-wrapped core methods."""
        return getattr(self._core, name)
