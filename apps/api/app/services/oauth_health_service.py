"""
OAuth Provider Health Check Service for monitoring OAuth system status.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import asyncio
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.service_base import BaseService
from app.core.exceptions import BusinessLogicError
from app.core.oauth_config import oauth_config

logger = logging.getLogger(__name__)


class OAuthHealthService(BaseService):
    """Service for monitoring OAuth provider health and system status."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.timeout = 10.0  # 10 second timeout for health checks
    
    async def check_oauth_system_health(self) -> Dict[str, Any]:
        """
        Comprehensive OAuth system health check.
        
        Returns:
            Dictionary with health status for all OAuth components
        """
        try:
            health_status = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'overall_status': 'healthy',
                'oauth_config': await self._check_oauth_config(),
                'providers': {},
                'database': await self._check_database_connectivity(),
                'endpoints': await self._check_oauth_endpoints()
            }
            
            # Check individual providers
            if oauth_config.google_enabled:
                health_status['providers']['google'] = await self._check_google_provider()
            
            if oauth_config.facebook_enabled:
                health_status['providers']['facebook'] = await self._check_facebook_provider()
            
            # Determine overall status
            health_status['overall_status'] = self._determine_overall_status(health_status)
            
            return health_status
            
        except Exception as e:
            logger.error(f"OAuth health check failed: {e}")
            return {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'overall_status': 'unhealthy',
                'error': str(e),
                'oauth_config': {'status': 'error'},
                'providers': {},
                'database': {'status': 'error'},
                'endpoints': {'status': 'error'}
            }
    
    async def _check_oauth_config(self) -> Dict[str, Any]:
        """Check OAuth configuration status."""
        try:
            return {
                'status': 'healthy' if oauth_config.is_initialized else 'unhealthy',
                'initialized': oauth_config.is_initialized,
                'google_enabled': oauth_config.google_enabled,
                'facebook_enabled': oauth_config.facebook_enabled,
                'has_google_credentials': bool(oauth_config.google_client_id and oauth_config.google_client_secret),
                'has_facebook_credentials': bool(oauth_config.facebook_client_id and oauth_config.facebook_client_secret)
            }
        except Exception as e:
            logger.error(f"OAuth config check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_google_provider(self) -> Dict[str, Any]:
        """Check Google OAuth provider health."""
        try:
            # Test Google's OAuth discovery endpoint
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    'https://accounts.google.com/.well-known/openid_configuration'
                )
                
                if response.status_code == 200:
                    config_data = response.json()
                    return {
                        'status': 'healthy',
                        'response_time_ms': int(response.elapsed.total_seconds() * 1000),
                        'authorization_endpoint': config_data.get('authorization_endpoint'),
                        'token_endpoint': config_data.get('token_endpoint'),
                        'userinfo_endpoint': config_data.get('userinfo_endpoint')
                    }
                else:
                    return {
                        'status': 'unhealthy',
                        'error': f'Google discovery endpoint returned {response.status_code}',
                        'response_time_ms': int(response.elapsed.total_seconds() * 1000)
                    }
                    
        except asyncio.TimeoutError:
            return {
                'status': 'unhealthy',
                'error': 'Timeout connecting to Google OAuth endpoints'
            }
        except Exception as e:
            logger.error(f"Google provider health check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_facebook_provider(self) -> Dict[str, Any]:
        """Check Facebook OAuth provider health."""
        try:
            # Test Facebook's OAuth endpoint availability
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Check Facebook's OAuth dialog endpoint
                response = await client.head('https://www.facebook.com/v18.0/dialog/oauth')
                
                if response.status_code in [200, 405]:  # 405 is expected for HEAD request
                    return {
                        'status': 'healthy',
                        'response_time_ms': int(response.elapsed.total_seconds() * 1000),
                        'oauth_dialog_endpoint': 'https://www.facebook.com/v18.0/dialog/oauth',
                        'token_endpoint': 'https://graph.facebook.com/v18.0/oauth/access_token'
                    }
                else:
                    return {
                        'status': 'unhealthy',
                        'error': f'Facebook OAuth endpoint returned {response.status_code}',
                        'response_time_ms': int(response.elapsed.total_seconds() * 1000)
                    }
                    
        except asyncio.TimeoutError:
            return {
                'status': 'unhealthy',
                'error': 'Timeout connecting to Facebook OAuth endpoints'
            }
        except Exception as e:
            logger.error(f"Facebook provider health check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_database_connectivity(self) -> Dict[str, Any]:
        """Check database connectivity for OAuth operations."""
        try:
            # Simple query to test database connectivity
            from sqlalchemy import text
            result = await self.db.execute(text("SELECT 1"))
            result.scalar()
            
            return {
                'status': 'healthy',
                'connection': 'active'
            }
            
        except Exception as e:
            logger.error(f"Database connectivity check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def _check_oauth_endpoints(self) -> Dict[str, Any]:
        """Check internal OAuth API endpoints."""
        try:
            # This would typically make internal HTTP requests to test endpoints
            # For now, we'll do a basic configuration check
            endpoints_status = {
                'status': 'healthy',
                'available_endpoints': []
            }
            
            if oauth_config.google_enabled:
                endpoints_status['available_endpoints'].extend([
                    '/api/v1/oauth/login/google',
                    '/api/v1/oauth/callback/google'
                ])
            
            if oauth_config.facebook_enabled:
                endpoints_status['available_endpoints'].extend([
                    '/api/v1/oauth/login/facebook',
                    '/api/v1/oauth/callback/facebook'
                ])
            
            endpoints_status['available_endpoints'].append('/api/v1/oauth/providers')
            
            return endpoints_status
            
        except Exception as e:
            logger.error(f"OAuth endpoints check failed: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def _determine_overall_status(self, health_status: Dict[str, Any]) -> str:
        """Determine overall system health status."""
        try:
            # Check critical components
            if health_status['oauth_config']['status'] != 'healthy':
                return 'unhealthy'
            
            if health_status['database']['status'] != 'healthy':
                return 'unhealthy'
            
            # Check if at least one provider is healthy
            providers = health_status.get('providers', {})
            if not providers:
                return 'unhealthy'
            
            healthy_providers = [
                provider for provider in providers.values()
                if provider.get('status') == 'healthy'
            ]
            
            if not healthy_providers:
                return 'unhealthy'
            
            # If we have at least one healthy provider and core systems are good
            return 'healthy'
            
        except Exception as e:
            logger.error(f"Error determining overall status: {e}")
            return 'error'
    
    async def get_oauth_metrics(self) -> Dict[str, Any]:
        """
        Get OAuth system metrics for monitoring dashboards.
        
        Returns:
            Dictionary with OAuth usage metrics
        """
        try:
            from sqlalchemy import text, func
            from app.models.user import User
            
            # Get OAuth user statistics
            oauth_users_query = await self.db.execute(
                text("""
                    SELECT 
                        oauth_provider,
                        COUNT(*) as user_count,
                        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_24h,
                        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d
                    FROM users 
                    WHERE oauth_provider IS NOT NULL 
                    GROUP BY oauth_provider
                """)
            )
            
            provider_stats = {}
            for row in oauth_users_query:
                provider_stats[row.oauth_provider] = {
                    'total_users': row.user_count,
                    'new_users_24h': row.new_users_24h,
                    'new_users_7d': row.new_users_7d
                }
            
            # Get total user counts
            total_users_query = await self.db.execute(
                text("SELECT COUNT(*) as total FROM users")
            )
            total_users = total_users_query.scalar()
            
            oauth_users_query = await self.db.execute(
                text("SELECT COUNT(*) as total FROM users WHERE oauth_provider IS NOT NULL")
            )
            total_oauth_users = oauth_users_query.scalar()
            
            return {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'total_users': total_users,
                'total_oauth_users': total_oauth_users,
                'oauth_adoption_rate': round((total_oauth_users / total_users * 100), 2) if total_users > 0 else 0,
                'provider_breakdown': provider_stats
            }
            
        except Exception as e:
            logger.error(f"Error getting OAuth metrics: {e}")
            return {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'error': str(e)
            }