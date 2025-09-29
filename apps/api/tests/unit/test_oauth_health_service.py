"""
Unit tests for OAuth Health Service.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from app.services.oauth_health_service import OAuthHealthService
from app.core.exceptions import BusinessLogicError


class TestOAuthHealthService:
    """Test OAuth health service functionality."""

    @pytest.fixture
    def health_service(self):
        """Create OAuth health service instance."""
        mock_db = AsyncMock()
        return OAuthHealthService(mock_db)

    @pytest.mark.asyncio
    async def test_check_oauth_system_health_success(self, health_service):
        """Test successful OAuth system health check."""
        with patch('app.services.oauth_health_service.oauth_config') as mock_config:
            mock_config.is_initialized = True
            mock_config.google_enabled = True
            mock_config.facebook_enabled = True
            mock_config.google_client_id = 'test_google_id'
            mock_config.google_client_secret = 'test_google_secret'
            mock_config.facebook_client_id = 'test_facebook_id'
            mock_config.facebook_client_secret = 'test_facebook_secret'
            
            # Mock database connectivity
            health_service.db.execute = AsyncMock()
            health_service.db.execute.return_value.scalar.return_value = 1
            
            # Mock provider health checks
            with patch.object(health_service, '_check_google_provider') as mock_google:
                with patch.object(health_service, '_check_facebook_provider') as mock_facebook:
                    mock_google.return_value = {'status': 'healthy', 'response_time_ms': 100}
                    mock_facebook.return_value = {'status': 'healthy', 'response_time_ms': 150}
                    
                    health_status = await health_service.check_oauth_system_health()
                    
                    assert health_status['overall_status'] == 'healthy'
                    assert health_status['oauth_config']['status'] == 'healthy'
                    assert health_status['database']['status'] == 'healthy'
                    assert 'google' in health_status['providers']
                    assert 'facebook' in health_status['providers']
                    assert 'timestamp' in health_status

    @pytest.mark.asyncio
    async def test_check_oauth_config_healthy(self, health_service):
        """Test OAuth configuration health check when healthy."""
        with patch('app.services.oauth_health_service.oauth_config') as mock_config:
            mock_config.is_initialized = True
            mock_config.google_enabled = True
            mock_config.facebook_enabled = True
            mock_config.google_client_id = 'test_id'
            mock_config.google_client_secret = 'test_secret'
            mock_config.facebook_client_id = 'test_id'
            mock_config.facebook_client_secret = 'test_secret'
            
            config_status = await health_service._check_oauth_config()
            
            assert config_status['status'] == 'healthy'
            assert config_status['initialized'] is True
            assert config_status['google_enabled'] is True
            assert config_status['facebook_enabled'] is True
            assert config_status['has_google_credentials'] is True
            assert config_status['has_facebook_credentials'] is True

    @pytest.mark.asyncio
    async def test_check_oauth_config_unhealthy(self, health_service):
        """Test OAuth configuration health check when unhealthy."""
        with patch('app.services.oauth_health_service.oauth_config') as mock_config:
            mock_config.is_initialized = False
            mock_config.google_enabled = False
            mock_config.facebook_enabled = False
            mock_config.google_client_id = None
            mock_config.google_client_secret = None
            mock_config.facebook_client_id = None
            mock_config.facebook_client_secret = None
            
            config_status = await health_service._check_oauth_config()
            
            assert config_status['status'] == 'unhealthy'
            assert config_status['initialized'] is False
            assert config_status['has_google_credentials'] is False
            assert config_status['has_facebook_credentials'] is False

    @pytest.mark.asyncio
    async def test_check_google_provider_healthy(self, health_service):
        """Test Google provider health check when healthy."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.elapsed.total_seconds.return_value = 0.1
        mock_response.json.return_value = {
            'authorization_endpoint': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_endpoint': 'https://oauth2.googleapis.com/token',
            'userinfo_endpoint': 'https://openidconnect.googleapis.com/v1/userinfo'
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
            
            google_status = await health_service._check_google_provider()
            
            assert google_status['status'] == 'healthy'
            assert google_status['response_time_ms'] == 100
            assert 'authorization_endpoint' in google_status

    @pytest.mark.asyncio
    async def test_check_google_provider_unhealthy(self, health_service):
        """Test Google provider health check when unhealthy."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.elapsed.total_seconds.return_value = 0.2
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
            
            google_status = await health_service._check_google_provider()
            
            assert google_status['status'] == 'unhealthy'
            assert 'error' in google_status
            assert google_status['response_time_ms'] == 200

    @pytest.mark.asyncio
    async def test_check_facebook_provider_healthy(self, health_service):
        """Test Facebook provider health check when healthy."""
        mock_response = Mock()
        mock_response.status_code = 405  # Expected for HEAD request
        mock_response.elapsed.total_seconds.return_value = 0.15
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.head.return_value = mock_response
            
            facebook_status = await health_service._check_facebook_provider()
            
            assert facebook_status['status'] == 'healthy'
            assert facebook_status['response_time_ms'] == 150
            assert 'oauth_dialog_endpoint' in facebook_status

    @pytest.mark.asyncio
    async def test_check_database_connectivity_success(self, health_service):
        """Test database connectivity check when successful."""
        health_service.db.execute = AsyncMock()
        health_service.db.execute.return_value.scalar.return_value = 1
        
        db_status = await health_service._check_database_connectivity()
        
        assert db_status['status'] == 'healthy'
        assert db_status['connection'] == 'active'

    @pytest.mark.asyncio
    async def test_check_database_connectivity_failure(self, health_service):
        """Test database connectivity check when failed."""
        health_service.db.execute = AsyncMock()
        health_service.db.execute.side_effect = Exception('Database connection failed')
        
        db_status = await health_service._check_database_connectivity()
        
        assert db_status['status'] == 'error'
        assert 'error' in db_status

    @pytest.mark.asyncio
    async def test_get_oauth_metrics_success(self, health_service):
        """Test OAuth metrics retrieval when successful."""
        # Mock database queries
        mock_provider_stats = [
            Mock(oauth_provider='google', user_count=100, new_users_24h=5, new_users_7d=20),
            Mock(oauth_provider='facebook', user_count=50, new_users_24h=2, new_users_7d=8)
        ]
        
        health_service.db.execute = AsyncMock()
        health_service.db.execute.side_effect = [
            mock_provider_stats,  # Provider stats query
            Mock(scalar=lambda: 200),  # Total users query
            Mock(scalar=lambda: 150)   # Total OAuth users query
        ]
        
        metrics = await health_service.get_oauth_metrics()
        
        assert 'timestamp' in metrics
        assert metrics['total_users'] == 200
        assert metrics['total_oauth_users'] == 150
        assert metrics['oauth_adoption_rate'] == 75.0
        assert 'provider_breakdown' in metrics

    @pytest.mark.asyncio
    async def test_determine_overall_status_healthy(self, health_service):
        """Test overall status determination when healthy."""
        health_status = {
            'oauth_config': {'status': 'healthy'},
            'database': {'status': 'healthy'},
            'providers': {
                'google': {'status': 'healthy'},
                'facebook': {'status': 'unhealthy'}
            }
        }
        
        overall_status = health_service._determine_overall_status(health_status)
        assert overall_status == 'healthy'

    @pytest.mark.asyncio
    async def test_determine_overall_status_unhealthy_no_providers(self, health_service):
        """Test overall status determination when no healthy providers."""
        health_status = {
            'oauth_config': {'status': 'healthy'},
            'database': {'status': 'healthy'},
            'providers': {
                'google': {'status': 'unhealthy'},
                'facebook': {'status': 'unhealthy'}
            }
        }
        
        overall_status = health_service._determine_overall_status(health_status)
        assert overall_status == 'unhealthy'

    @pytest.mark.asyncio
    async def test_determine_overall_status_unhealthy_config(self, health_service):
        """Test overall status determination when config is unhealthy."""
        health_status = {
            'oauth_config': {'status': 'unhealthy'},
            'database': {'status': 'healthy'},
            'providers': {
                'google': {'status': 'healthy'}
            }
        }
        
        overall_status = health_service._determine_overall_status(health_status)
        assert overall_status == 'unhealthy'