"""
Unit tests for security features including rate limiting, input sanitization, and audit logging.
"""

import pytest
import time
from unittest.mock import Mock, patch
from fastapi import Request
from fastapi.testclient import TestClient
from app.core.rate_limiting import InMemoryRateLimiter, RateLimitingMiddleware
from app.core.input_sanitization import InputSanitizer, InputSanitizationMiddleware
from app.core.security_audit import SecurityAuditor, SecurityEventType
from app.core.security_config import SecurityConfig


class TestInMemoryRateLimiter:
    """Test the in-memory rate limiter."""
    
    def test_rate_limiter_allows_requests_under_limit(self):
        """Test that requests under the limit are allowed."""
        limiter = InMemoryRateLimiter()
        
        # Make requests under the limit
        for i in range(5):
            result = limiter.is_allowed("user1", "endpoint1", limit=10, window_seconds=60)
            assert result["allowed"] is True
            assert result["current_count"] == i
            assert result["remaining"] == 10 - i
            limiter.record_request("user1", "endpoint1")
    
    def test_rate_limiter_blocks_requests_over_limit(self):
        """Test that requests over the limit are blocked."""
        limiter = InMemoryRateLimiter()
        
        # Fill up the limit
        for i in range(10):
            limiter.record_request("user1", "endpoint1")
        
        # Next request should be blocked
        result = limiter.is_allowed("user1", "endpoint1", limit=10, window_seconds=60)
        assert result["allowed"] is False
        assert result["current_count"] == 10
        assert result["remaining"] == 0
    
    def test_rate_limiter_different_users_separate_limits(self):
        """Test that different users have separate rate limits."""
        limiter = InMemoryRateLimiter()
        
        # Fill up limit for user1
        for i in range(10):
            limiter.record_request("user1", "endpoint1")
        
        # user2 should still be allowed
        result = limiter.is_allowed("user2", "endpoint1", limit=10, window_seconds=60)
        assert result["allowed"] is True
        assert result["current_count"] == 0
    
    def test_rate_limiter_different_endpoints_separate_limits(self):
        """Test that different endpoints have separate rate limits."""
        limiter = InMemoryRateLimiter()
        
        # Fill up limit for endpoint1
        for i in range(10):
            limiter.record_request("user1", "endpoint1")
        
        # endpoint2 should still be allowed
        result = limiter.is_allowed("user1", "endpoint2", limit=10, window_seconds=60)
        assert result["allowed"] is True
        assert result["current_count"] == 0
    
    def test_rate_limiter_window_expiry(self):
        """Test that rate limit window expires correctly."""
        limiter = InMemoryRateLimiter()
        
        # Mock time to control window expiry
        with patch('time.time') as mock_time:
            # Start at time 0
            mock_time.return_value = 0
            
            # Fill up the limit
            for i in range(10):
                limiter.record_request("user1", "endpoint1")
            
            # Should be blocked
            result = limiter.is_allowed("user1", "endpoint1", limit=10, window_seconds=60)
            assert result["allowed"] is False
            
            # Move time forward past the window
            mock_time.return_value = 61
            
            # Should be allowed again
            result = limiter.is_allowed("user1", "endpoint1", limit=10, window_seconds=60)
            assert result["allowed"] is True
            assert result["current_count"] == 0


class TestInputSanitizer:
    """Test the input sanitizer."""
    
    def test_sanitize_text_basic(self):
        """Test basic text sanitization."""
        sanitizer = InputSanitizer()
        
        # Test HTML escaping
        result = sanitizer.sanitize_text("<script>alert('xss')</script>", "general")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result
        
        # Test length limiting
        long_text = "a" * 2000
        result = sanitizer.sanitize_text(long_text, "username", max_length=50)
        assert len(result) == 50
    
    def test_sanitize_username(self):
        """Test username-specific sanitization."""
        sanitizer = InputSanitizer()
        
        # Valid username
        result = sanitizer.sanitize_text("user123", "username")
        assert result == "user123"
        
        # Remove invalid characters
        result = sanitizer.sanitize_text("user@#$123", "username")
        assert result == "user123"
        
        # Length limit
        result = sanitizer.sanitize_text("a" * 100, "username")
        assert len(result) == 50  # MAX_LENGTHS['username']
    
    def test_sanitize_email(self):
        """Test email-specific sanitization."""
        sanitizer = InputSanitizer()
        
        # Basic email sanitization
        result = sanitizer.sanitize_text("  USER@EXAMPLE.COM  ", "email")
        assert result == "user@example.com"
    
    def test_sanitize_url(self):
        """Test URL-specific sanitization."""
        sanitizer = InputSanitizer()
        
        # Add https scheme
        result = sanitizer.sanitize_text("example.com", "url")
        assert result == "https://example.com"
        
        # Keep existing scheme
        result = sanitizer.sanitize_text("http://example.com", "url")
        assert result == "http://example.com"
    
    def test_sanitize_post_content(self):
        """Test post content sanitization."""
        sanitizer = InputSanitizer()
        
        # Test dangerous tag removal
        content = "Hello <script>alert('xss')</script> world!"
        result = sanitizer.sanitize_text(content, "post_content")
        assert "<script>" not in result
        # Script tags are removed but content is preserved, and "script" text is added
        assert "script" in result
        # The result should be: "Hello script'xss') world!" (alert( is removed by dangerous patterns)
        assert "xss" in result  # Content inside script tags is preserved (minus dangerous patterns)
        
        # Test line break normalization
        content = "Line 1\r\nLine 2\rLine 3\nLine 4"
        result = sanitizer.sanitize_text(content, "post_content")
        assert "\r" not in result
        assert result.count("\n") == 3
    
    def test_sanitize_dict(self):
        """Test dictionary sanitization."""
        sanitizer = InputSanitizer()
        
        data = {
            "username": "user@#$123",
            "email": "  USER@EXAMPLE.COM  ",
            "bio": "<script>alert('xss')</script>",
            "number": 42,
            "nested": {
                "field": "<b>bold</b>"
            }
        }
        
        field_mappings = {
            "username": "username",
            "email": "email",
            "bio": "bio",
            "field": "general"
        }
        
        result = sanitizer.sanitize_dict(data, field_mappings)
        
        assert result["username"] == "user123"
        assert result["email"] == "user@example.com"
        assert "<script>" not in result["bio"]
        assert result["number"] == 42
        assert "&lt;b&gt;" in result["nested"]["field"]
    
    def test_validate_file_upload(self):
        """Test file upload validation."""
        sanitizer = InputSanitizer()
        
        # Valid image upload
        result = sanitizer.validate_file_upload(
            filename="test.jpg",
            content_type="image/jpeg",
            file_size=1024 * 1024,  # 1MB
            allowed_types=["image/jpeg", "image/png"],
            max_size=10 * 1024 * 1024  # 10MB
        )
        
        assert result["valid"] is True
        assert result["safe_filename"] == "test.jpg"
        
        # File too large
        result = sanitizer.validate_file_upload(
            filename="test.jpg",
            content_type="image/jpeg",
            file_size=20 * 1024 * 1024,  # 20MB
            max_size=10 * 1024 * 1024  # 10MB
        )
        
        assert result["valid"] is False
        assert "exceeds maximum" in result["errors"][0]
        
        # Invalid file type
        result = sanitizer.validate_file_upload(
            filename="test.exe",
            content_type="application/exe",
            file_size=1024,
            allowed_types=["image/jpeg", "image/png"]
        )
        
        assert result["valid"] is False
        assert "not allowed" in result["errors"][0]
    
    def test_sanitize_filename(self):
        """Test filename sanitization."""
        sanitizer = InputSanitizer()
        
        # Remove dangerous characters
        result = sanitizer._sanitize_filename("../../../etc/passwd")
        assert ".." not in result
        assert "/" not in result
        
        # Handle long filenames
        long_name = "a" * 300 + ".txt"
        result = sanitizer._sanitize_filename(long_name)
        assert len(result) <= 255
        assert result.endswith(".txt")


class TestSecurityAuditor:
    """Test the security auditor."""
    
    def test_log_security_event(self):
        """Test basic security event logging."""
        with patch('app.core.security_audit.security_logger') as mock_logger:
            # Create mock request
            mock_request = Mock(spec=Request)
            mock_request.method = "POST"
            mock_request.url.path = "/api/v1/auth/login"
            mock_request.query_params = {}
            mock_request.headers = {"user-agent": "test-agent"}
            mock_request.client.host = "127.0.0.1"
            mock_request.state.request_id = "test-request-id"
            
            SecurityAuditor.log_security_event(
                event_type=SecurityEventType.LOGIN_SUCCESS,
                request=mock_request,
                user_id=123,
                details={"username": "testuser"},
                severity="INFO"
            )
            
            # Verify logger was called
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args[0][0]
            assert "LOGIN_SUCCESS" in call_args
            assert "testuser" in call_args
    
    def test_log_authentication_event(self):
        """Test authentication event logging."""
        with patch('app.core.security_audit.security_logger') as mock_logger:
            mock_request = Mock(spec=Request)
            mock_request.method = "POST"
            mock_request.url.path = "/api/v1/auth/login"
            mock_request.query_params = {}
            mock_request.headers = {"user-agent": "test-agent"}
            mock_request.client.host = "127.0.0.1"
            mock_request.state.request_id = "test-request-id"
            
            SecurityAuditor.log_authentication_event(
                event_type=SecurityEventType.LOGIN_FAILURE,
                request=mock_request,
                username="testuser",
                success=False,
                failure_reason="Invalid password"
            )
            
            # Verify warning level for failed login
            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args[0][0]
            assert "LOGIN_FAILURE" in call_args
            assert "Invalid password" in call_args
    
    def test_get_client_ip(self):
        """Test client IP extraction."""
        # Test X-Forwarded-For header
        mock_request = Mock(spec=Request)
        mock_request.headers = {"X-Forwarded-For": "192.168.1.1, 10.0.0.1"}
        mock_request.client.host = "127.0.0.1"
        
        ip = SecurityAuditor._get_client_ip(mock_request)
        assert ip == "192.168.1.1"
        
        # Test X-Real-IP header
        mock_request.headers = {"X-Real-IP": "192.168.1.2"}
        ip = SecurityAuditor._get_client_ip(mock_request)
        assert ip == "192.168.1.2"
        
        # Test fallback to client.host
        mock_request.headers = {}
        ip = SecurityAuditor._get_client_ip(mock_request)
        assert ip == "127.0.0.1"


class TestSecurityConfig:
    """Test the security configuration."""
    
    def test_default_configuration(self):
        """Test default security configuration."""
        config = SecurityConfig()
        
        assert config.environment == "development"
        assert config.access_token_expire_minutes == 60
        assert config.default_rate_limit == 100
        assert config.is_development is True
        assert config.is_production is False
    
    def test_production_configuration(self):
        """Test production security configuration."""
        # Import locally to avoid module-level caching
        import importlib
        import app.core.security_config
        
        with patch.dict('os.environ', {
            'ENVIRONMENT': 'production',
            'SECRET_KEY': 'super-secure-production-key-32-chars',
            'ACCESS_TOKEN_EXPIRE_MINUTES': '30',
            'ALLOWED_ORIGINS': 'https://example.com,https://www.example.com'
        }, clear=False):
            # Reload the module to pick up new environment variables
            importlib.reload(app.core.security_config)
            from app.core.security_config import SecurityConfig
            
            config = SecurityConfig()
            
            assert config.environment == "production"
            assert config.access_token_expire_minutes == 30
            assert config.is_production is True
            assert "https://example.com" in config.allowed_origins
    
    def test_cors_config(self):
        """Test CORS configuration generation."""
        config = SecurityConfig()
        cors_config = config.get_cors_config()
        
        assert "allow_origins" in cors_config
        assert "allow_credentials" in cors_config
        assert cors_config["allow_credentials"] is True
        assert "GET" in cors_config["allow_methods"]
        assert "POST" in cors_config["allow_methods"]
    
    def test_security_headers(self):
        """Test security headers generation."""
        config = SecurityConfig()
        headers = config.get_security_headers()
        
        assert "Content-Security-Policy" in headers
        assert "X-Frame-Options" in headers
        assert "X-Content-Type-Options" in headers
        assert headers["X-Frame-Options"] == "DENY"
        assert headers["X-Content-Type-Options"] == "nosniff"
    
    def test_rate_limits(self):
        """Test rate limits configuration."""
        config = SecurityConfig()
        rate_limits = config.get_rate_limits()
        
        assert "default" in rate_limits
        assert "auth" in rate_limits
        assert rate_limits["default"] == 100
        assert rate_limits["auth"] == 10
    
    def test_request_size_limits(self):
        """Test request size limits configuration."""
        config = SecurityConfig()
        size_limits = config.get_request_size_limits()
        
        assert "default" in size_limits
        assert "/api/v1/auth/login" in size_limits
        assert size_limits["default"] == 1 * 1024 * 1024  # 1MB
        assert size_limits["/api/v1/auth/login"] == 1024  # 1KB
    
    def test_production_validation_warnings(self):
        """Test production configuration validation."""
        # Test the validation method directly since global instance interferes
        from app.core.security_config import SecurityConfig
        
        # Create a config instance with problematic production settings
        config = SecurityConfig()
        config.environment = 'production'
        config.secret_key = 'your-super-secret-key-change-this-in-production'
        config.allowed_origins = ['http://insecure.com']
        
        # Test that validation catches the issues
        with pytest.raises(ValueError, match="Critical security configuration issues"):
            config._validate_production_config()
    
    def test_allowed_origins_parsing(self):
        """Test allowed origins parsing from environment."""
        with patch.dict('os.environ', {
            'ALLOWED_ORIGINS': 'https://example.com, https://www.example.com , https://api.example.com'
        }, clear=False):
            from app.core.security_config import SecurityConfig
            config = SecurityConfig()
            
            assert len(config.allowed_origins) == 3
            assert "https://example.com" in config.allowed_origins
            assert "https://www.example.com" in config.allowed_origins
            assert "https://api.example.com" in config.allowed_origins
    
    def test_csp_domains_parsing(self):
        """Test CSP domains parsing from environment."""
        with patch.dict('os.environ', {
            'CSP_DOMAINS': 'https://cdn.example.com, https://assets.example.com'
        }, clear=False):
            from app.core.security_config import SecurityConfig
            config = SecurityConfig()
            
            assert len(config.csp_domains) == 2
            assert "https://cdn.example.com" in config.csp_domains
            assert "https://assets.example.com" in config.csp_domains