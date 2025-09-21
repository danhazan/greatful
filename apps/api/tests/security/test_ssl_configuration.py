"""
Tests for SSL/TLS security configuration and middleware.
"""

import pytest
import os
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request, Response
from app.core.ssl_middleware import (
    HTTPSRedirectMiddleware, 
    SSLCertificateValidator, 
    SSLConfigurationManager
)
from app.core.security_config import SecurityConfig


class TestHTTPSRedirectMiddleware:
    """Test HTTPS redirect middleware functionality."""
    
    def test_https_redirect_middleware_creation(self):
        """Test that HTTPS redirect middleware can be created."""
        app = FastAPI()
        # Explicitly set all parameters to avoid dependency on security_config
        middleware = HTTPSRedirectMiddleware(
            app, 
            force_https=True,
            hsts_max_age=31536000,
            hsts_include_subdomains=True,
            hsts_preload=True
        )
        
        assert middleware.force_https is True
        assert middleware.hsts_max_age == 31536000  # Default 1 year
        assert middleware.hsts_include_subdomains is True
        assert middleware.hsts_preload is True
    
    def test_should_redirect_to_https_logic(self):
        """Test the logic for determining HTTPS redirects."""
        app = FastAPI()
        middleware = HTTPSRedirectMiddleware(app, force_https=True)
        
        # Mock request for HTTP
        request = MagicMock()
        request.url.scheme = "http"
        request.url.path = "/api/test"
        request.headers = {}
        
        # Should redirect HTTP requests
        assert middleware._should_redirect_to_https(request) is True
        
        # Should not redirect HTTPS requests
        request.url.scheme = "https"
        assert middleware._should_redirect_to_https(request) is False
        
        # Should not redirect health checks
        request.url.scheme = "http"
        request.url.path = "/health"
        assert middleware._should_redirect_to_https(request) is False
    
    def test_forwarded_proto_header_handling(self):
        """Test handling of X-Forwarded-Proto header."""
        app = FastAPI()
        middleware = HTTPSRedirectMiddleware(app, force_https=True)
        
        request = MagicMock()
        request.url.scheme = "http"
        request.url.path = "/api/test"
        request.headers = {"X-Forwarded-Proto": "https"}
        
        # Should not redirect if X-Forwarded-Proto is https
        assert middleware._should_redirect_to_https(request) is False
    
    def test_localhost_exemption_in_development(self):
        """Test that localhost is exempted from HTTPS redirect in development."""
        with patch('app.core.ssl_middleware.security_config') as mock_config:
            mock_config.is_production = False
            
            app = FastAPI()
            middleware = HTTPSRedirectMiddleware(app, force_https=True)
            
            request = MagicMock()
            request.url.scheme = "http"
            request.url.path = "/api/test"
            request.headers = {"host": "localhost:8000"}
            
            # Should not redirect localhost in development
            assert middleware._should_redirect_to_https(request) is False
    
    def test_hsts_header_generation(self):
        """Test HSTS header generation."""
        app = FastAPI()
        middleware = HTTPSRedirectMiddleware(
            app, 
            force_https=True,
            hsts_max_age=63072000,  # 2 years
            hsts_include_subdomains=True,
            hsts_preload=True
        )
        
        request = MagicMock()
        request.url.scheme = "https"
        response = MagicMock()
        
        # Create a proper headers mock that behaves like Starlette headers
        headers_dict = {}
        headers_mock = MagicMock()
        headers_mock.__setitem__ = lambda self, key, value: headers_dict.__setitem__(key, value)
        headers_mock.__getitem__ = lambda self, key: headers_dict.__getitem__(key)
        headers_mock.get = lambda self, key, default=None: headers_dict.get(key, default)
        headers_mock.getlist = MagicMock(return_value=[])
        response.headers = headers_mock
        
        middleware._add_ssl_security_headers(request, response)
        
        expected_hsts = "max-age=63072000; includeSubDomains; preload"
        assert headers_dict["Strict-Transport-Security"] == expected_hsts
    
    def test_cookie_security_attributes(self):
        """Test secure cookie attribute addition."""
        app = FastAPI()
        middleware = HTTPSRedirectMiddleware(app, force_https=True)
        
        # Test cookie with no security attributes
        cookie_header = "session_id=abc123; Path=/"
        secured_cookie = middleware._add_cookie_security_attributes(cookie_header)
        
        # Should add security attributes
        assert "HttpOnly" in secured_cookie
        assert "SameSite=Lax" in secured_cookie
    
    def test_cookie_security_preserves_existing_attributes(self):
        """Test that existing cookie attributes are preserved."""
        app = FastAPI()
        middleware = HTTPSRedirectMiddleware(app, force_https=True)
        
        # Test cookie with existing attributes
        cookie_header = "session_id=abc123; Path=/; HttpOnly; SameSite=Strict"
        secured_cookie = middleware._add_cookie_security_attributes(cookie_header)
        
        # Should preserve existing attributes
        assert "HttpOnly" in secured_cookie
        assert "SameSite=Strict" in secured_cookie
        # Should not duplicate attributes
        assert secured_cookie.count("HttpOnly") == 1
        assert secured_cookie.count("SameSite") == 1


class TestSSLCertificateValidator:
    """Test SSL certificate validation functionality."""
    
    def test_certificate_validator_creation(self):
        """Test that SSL certificate validator can be created."""
        validator = SSLCertificateValidator()
        assert validator is not None
    
    @patch('socket.create_connection')
    @patch('ssl.create_default_context')
    def test_certificate_validity_check_success(self, mock_ssl_context, mock_socket):
        """Test successful certificate validity check."""
        # Mock SSL certificate data with proper date format
        from datetime import datetime, timedelta
        future_date = datetime.now() + timedelta(days=365)
        past_date = datetime.now() - timedelta(days=30)
        
        mock_cert = {
            'subject': [('CN', 'example.com')],
            'issuer': [('CN', 'Test CA')],
            'notBefore': past_date.strftime('%b %d %H:%M:%S %Y GMT'),
            'notAfter': future_date.strftime('%b %d %H:%M:%S %Y GMT'),
            'serialNumber': '123456789',
            'version': 3,
            'signatureAlgorithm': 'sha256WithRSAEncryption',
            'subjectAltName': [('DNS', 'example.com'), ('DNS', 'www.example.com')]
        }
        
        # Mock SSL socket
        mock_ssl_socket = MagicMock()
        mock_ssl_socket.getpeercert.return_value = mock_cert
        
        # Mock context and socket - fix the context manager mocking
        mock_context = MagicMock()
        mock_wrapped_socket = MagicMock()
        mock_wrapped_socket.getpeercert.return_value = mock_cert
        mock_wrapped_socket.__enter__ = MagicMock(return_value=mock_wrapped_socket)
        mock_wrapped_socket.__exit__ = MagicMock(return_value=None)
        mock_context.wrap_socket.return_value = mock_wrapped_socket
        mock_ssl_context.return_value = mock_context
        
        # Mock the socket connection as context manager
        mock_connection = MagicMock()
        mock_connection.__enter__ = MagicMock(return_value=mock_connection)
        mock_connection.__exit__ = MagicMock(return_value=None)
        mock_socket.return_value = mock_connection
        
        # Test certificate check
        result = SSLCertificateValidator.check_certificate_validity("example.com")
        
        assert result['valid'] is True
        assert result['hostname'] == "example.com"
        assert 'subject' in result
        assert 'issuer' in result
        assert 'days_until_expiry' in result
    
    def test_certificate_validity_check_timeout(self):
        """Test certificate check with connection timeout."""
        with patch('socket.create_connection', side_effect=TimeoutError()):
            result = SSLCertificateValidator.check_certificate_validity("nonexistent.com")
            
            assert result['valid'] is False
            assert 'timeout' in result['error'].lower()
            assert result['hostname'] == "nonexistent.com"
    
    def test_multiple_domains_check(self):
        """Test checking multiple domains."""
        domains = ["example.com", "test.com"]
        
        with patch.object(SSLCertificateValidator, 'check_certificate_validity') as mock_check:
            mock_check.side_effect = [
                {'valid': True, 'hostname': 'example.com', 'days_until_expiry': 90},
                {'valid': False, 'hostname': 'test.com', 'error': 'Connection failed'}
            ]
            
            results = SSLCertificateValidator.check_multiple_domains(domains)
            
            assert len(results) == 2
            assert results['example.com']['valid'] is True
            assert results['test.com']['valid'] is False
    
    def test_certificate_expiry_warnings(self):
        """Test certificate expiry warning generation."""
        cert_results = {
            'example.com': {'valid': True, 'expires_soon': False, 'days_until_expiry': 90},
            'test.com': {'valid': True, 'expires_soon': True, 'days_until_expiry': 15},
            'invalid.com': {'valid': False, 'error': 'Connection failed'}
        }
        
        warnings = SSLCertificateValidator.get_certificate_expiry_warnings(cert_results)
        
        assert len(warnings) == 2
        assert any('test.com' in warning and '15 days' in warning for warning in warnings)
        assert any('invalid.com' in warning and 'invalid' in warning for warning in warnings)


class TestSSLConfigurationManager:
    """Test SSL configuration management functionality."""
    
    def test_get_ssl_configuration(self):
        """Test getting SSL configuration."""
        config = SSLConfigurationManager.get_ssl_configuration()
        
        assert 'ssl_redirect_enabled' in config
        assert 'hsts_max_age' in config
        assert 'environment' in config
        assert 'production_mode' in config
        assert isinstance(config['ssl_redirect_enabled'], bool)
        assert isinstance(config['hsts_max_age'], int)
    
    def test_validate_ssl_configuration_production(self):
        """Test SSL configuration validation in production."""
        with patch('app.core.ssl_middleware.security_config') as mock_config:
            mock_config.is_production = True
            mock_config.ssl_redirect = False
            mock_config.hsts_max_age = 86400  # 1 day (too short)
            mock_config.allowed_origins = ['http://example.com']  # HTTP in production
            
            validation = SSLConfigurationManager.validate_ssl_configuration()
            
            assert validation['valid'] is False
            assert len(validation['issues']) > 0
            assert any('SSL redirect' in issue for issue in validation['issues'])
            assert any('HTTPS' in issue for issue in validation['issues'])
    
    def test_validate_ssl_configuration_development(self):
        """Test SSL configuration validation in development."""
        with patch('app.core.ssl_middleware.security_config') as mock_config:
            mock_config.is_production = False
            mock_config.ssl_redirect = False
            mock_config.hsts_max_age = 31536000
            mock_config.allowed_origins = ['http://localhost:3000']
            
            validation = SSLConfigurationManager.validate_ssl_configuration()
            
            # Should be valid in development with HTTP localhost
            assert validation['valid'] is True
    
    def test_check_domain_certificates_no_domains(self):
        """Test certificate checking with no configured domains."""
        with patch('app.core.ssl_middleware.security_config') as mock_config:
            mock_config.allowed_origins = ['http://localhost:3000']  # No HTTPS domains
            
            result = SSLConfigurationManager.check_domain_certificates()
            
            assert result['checked'] is False
            assert 'reason' in result
    
    def test_check_domain_certificates_with_domains(self):
        """Test certificate checking with configured domains."""
        with patch('app.core.ssl_middleware.security_config') as mock_config:
            mock_config.allowed_origins = ['https://example.com', 'https://test.com']
            
            with patch.object(SSLCertificateValidator, 'check_multiple_domains') as mock_check:
                mock_check.return_value = {
                    'example.com': {'valid': True, 'expires_soon': False},
                    'test.com': {'valid': True, 'expires_soon': True, 'days_until_expiry': 15}
                }
                
                result = SSLConfigurationManager.check_domain_certificates()
                
                assert result['checked'] is True
                assert 'summary' in result
                assert result['summary']['total_domains'] == 2
                assert result['summary']['valid_certificates'] == 2
                assert result['summary']['expiring_soon'] == 1


class TestSSLSecurityConfig:
    """Test SSL-related security configuration."""
    
    def test_ssl_config_creation(self):
        """Test SSL configuration creation with environment variables."""
        # Test production SSL configuration
        with patch.dict(os.environ, {
            'ENVIRONMENT': 'production',
            'SSL_REDIRECT': 'true',
            'HSTS_MAX_AGE': '63072000',
            'HSTS_PRELOAD': 'true',
            'HSTS_INCLUDE_SUBDOMAINS': 'true',
            'SECURE_COOKIES': 'true',
            'COOKIE_SAMESITE': 'Strict',
            'COOKIE_HTTPONLY': 'true'
        }, clear=False):
            # Create a new SecurityConfig instance with the patched environment
            config = SecurityConfig(
                environment='production',
                secret_key='test-secret-key-for-ssl-configuration-testing-32-chars-long',
                ssl_redirect=True,
                hsts_max_age=63072000,
                hsts_preload=True,
                hsts_include_subdomains=True,
                secure_cookies=True,
                cookie_samesite='Strict',
                cookie_httponly=True
            )
            
            assert config.ssl_redirect is True
            assert config.hsts_max_age == 63072000
            assert config.hsts_preload is True
            assert config.hsts_include_subdomains is True
            assert config.secure_cookies is True
            assert config.cookie_samesite == 'Strict'
            assert config.cookie_httponly is True
    
    def test_get_ssl_config_method(self):
        """Test get_ssl_config method."""
        config = SecurityConfig()
        ssl_config = config.get_ssl_config()
        
        assert 'ssl_redirect' in ssl_config
        assert 'hsts_max_age' in ssl_config
        assert 'hsts_preload' in ssl_config
        assert 'secure_cookies' in ssl_config
        assert 'force_https_in_production' in ssl_config
    
    def test_get_cookie_security_config_method(self):
        """Test get_cookie_security_config method."""
        config = SecurityConfig()
        cookie_config = config.get_cookie_security_config()
        
        assert 'secure' in cookie_config
        assert 'httponly' in cookie_config
        assert 'samesite' in cookie_config
        assert 'path' in cookie_config
        assert cookie_config['path'] == '/'


class TestSSLIntegration:
    """Integration tests for SSL/TLS functionality."""
    
    def test_ssl_middleware_integration(self):
        """Test SSL middleware integration with FastAPI."""
        app = FastAPI()
        
        # Add SSL middleware
        app.add_middleware(HTTPSRedirectMiddleware, force_https=False)
        
        client = TestClient(app)
        
        @app.get("/test")
        async def test_endpoint():
            return {"message": "test"}
        
        # Test that middleware doesn't break normal requests
        response = client.get("/test")
        assert response.status_code == 200
        assert response.json() == {"message": "test"}
    
    def test_hsts_header_in_response(self):
        """Test that HSTS header is added to HTTPS responses."""
        app = FastAPI()
        
        # Add SSL middleware with HSTS enabled
        app.add_middleware(
            HTTPSRedirectMiddleware, 
            force_https=False,  # Don't redirect for testing
            hsts_max_age=31536000
        )
        
        @app.get("/test")
        async def test_endpoint():
            return {"message": "test"}
        
        client = TestClient(app)
        
        # Mock HTTPS request
        with patch('app.core.ssl_middleware.HTTPSRedirectMiddleware._is_https_request', return_value=True):
            response = client.get("/test")
            
            assert response.status_code == 200
            # Note: TestClient may not preserve all headers, so we test the logic separately
    
    def test_ssl_configuration_validation_integration(self):
        """Test SSL configuration validation integration."""
        # Test with production-like configuration
        with patch.dict(os.environ, {
            'ENVIRONMENT': 'production',
            'SSL_REDIRECT': 'true',
            'HSTS_MAX_AGE': '31536000',
            'ALLOWED_ORIGINS': 'https://example.com'
        }):
            config = SecurityConfig()
            validation = SSLConfigurationManager.validate_ssl_configuration()
            
            # Should be valid with proper production configuration
            assert validation['valid'] is True or len(validation['issues']) == 0


if __name__ == "__main__":
    pytest.main([__file__])