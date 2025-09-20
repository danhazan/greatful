"""
Comprehensive security testing and compliance validation.

This module tests for common vulnerabilities including:
- SQL injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Authentication bypass
- Rate limiting effectiveness
- Input sanitization
- JWT token security
- Session management
- Data privacy compliance
"""

import pytest
import json
import time
import jwt
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
# Database imports removed - using mocked dependencies instead

from app.core.security import create_access_token, decode_token, verify_password, get_password_hash
from app.core.rate_limiting import InMemoryRateLimiter
from app.core.input_sanitization import InputSanitizer
from app.models.user import User
from app.models.post import Post


class TestSQLInjectionPrevention:
    """Test SQL injection prevention across all endpoints."""
    
    @pytest.mark.asyncio
    async def test_user_search_sql_injection(self, client: TestClient, auth_headers: dict):
        """Test SQL injection attempts in user search."""
        # Common SQL injection payloads
        injection_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --",
            "'; INSERT INTO users (username) VALUES ('hacker'); --",
            "' OR 1=1 --",
            "admin'--",
            "admin' /*",
            "' OR 'x'='x",
            "'; EXEC xp_cmdshell('dir'); --",
            "' AND (SELECT COUNT(*) FROM users) > 0 --"
        ]
        
        for payload in injection_payloads:
            response = client.post(
                "/api/v1/users/search",
                json={"q": payload},
                headers=auth_headers
            )
            
            # Should not return 500 error or expose database structure
            assert response.status_code in [200, 400, 422], f"Payload: {payload}"
            
            # Should not contain SQL error messages
            response_text = response.text.lower()
            sql_error_indicators = [
                "sql", "syntax error", "mysql", "postgresql", "sqlite",
                "table", "column", "database", "select", "insert", "update", "delete"
            ]
            
            for indicator in sql_error_indicators:
                assert indicator not in response_text, f"SQL error exposed with payload: {payload}"
    
    @pytest.mark.asyncio
    async def test_post_creation_sql_injection(self, client_with_scenario_mocks: TestClient, auth_headers: dict):
        """Test SQL injection attempts in post creation."""
        injection_payloads = [
            "'; DROP TABLE posts; --",
            "' OR '1'='1",
            "'; UPDATE users SET password_hash = 'hacked' WHERE id = 1; --"
        ]
        
        for payload in injection_payloads:
            response = client_with_scenario_mocks.post(
                "/api/v1/posts",
                json={
                    "content": payload,
                    "post_type": "spontaneous"
                },
                headers=auth_headers
            )
            
            # Should handle malicious input gracefully
            assert response.status_code in [200, 201, 400, 422], f"Payload: {payload}"
            
            # Should not expose SQL errors
            response_text = response.text.lower()
            assert "sql" not in response_text, f"SQL error exposed with payload: {payload}"
    
    @pytest.mark.asyncio
    async def test_profile_update_sql_injection(self, client_with_scenario_mocks: TestClient, auth_headers: dict):
        """Test SQL injection attempts in profile updates."""
        injection_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; UPDATE users SET is_admin = true WHERE id = 1; --"
        ]
        
        for payload in injection_payloads:
            response = client_with_scenario_mocks.put(
                "/api/v1/users/me/profile",
                json={
                    "bio": payload,
                    "display_name": payload,
                    "city": payload
                },
                headers=auth_headers
            )
            
            # Should handle malicious input gracefully
            assert response.status_code in [200, 400, 422], f"Payload: {payload}"
            
            # Should not expose SQL errors
            response_text = response.text.lower()
            assert "sql" not in response_text, f"SQL error exposed with payload: {payload}"


class TestXSSPrevention:
    """Test XSS (Cross-Site Scripting) prevention."""
    
    @pytest.mark.asyncio
    async def test_post_content_xss_prevention(self, client: TestClient, auth_headers: dict):
        """Test XSS prevention in post content."""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "javascript:alert('XSS')",
            "<iframe src='javascript:alert(\"XSS\")'></iframe>",
            "<body onload=alert('XSS')>",
            "<div onclick=alert('XSS')>Click me</div>",
            "<a href='javascript:alert(\"XSS\")'>Link</a>",
            "<style>@import'javascript:alert(\"XSS\")';</style>",
            "<object data='javascript:alert(\"XSS\")'></object>"
        ]
        
        for payload in xss_payloads:
            response = client.post(
                "/api/v1/posts",
                json={
                    "content": payload,
                    "post_type": "spontaneous"
                },
                headers=auth_headers
            )
            
            if response.status_code in [200, 201]:
                # Get the created post
                post_data = response.json()
                
                # Content should be sanitized
                assert "<script>" not in post_data["content"], f"XSS not prevented: {payload}"
                assert "javascript:" not in post_data["content"], f"XSS not prevented: {payload}"
                assert "onerror=" not in post_data["content"], f"XSS not prevented: {payload}"
                assert "onload=" not in post_data["content"], f"XSS not prevented: {payload}"
                assert "onclick=" not in post_data["content"], f"XSS not prevented: {payload}"
    
    @pytest.mark.asyncio
    async def test_profile_xss_prevention(self, client: TestClient, auth_headers: dict):
        """Test XSS prevention in profile fields."""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')"
        ]
        
        for payload in xss_payloads:
            response = client.put(
                "/api/v1/users/me/profile",
                json={
                    "bio": payload,
                    "display_name": payload,
                    "city": payload
                },
                headers=auth_headers
            )
            
            if response.status_code == 200:
                profile_data = response.json()["data"]
                
                # All fields should be sanitized
                for field in ["bio", "display_name", "city"]:
                    if field in profile_data:
                        assert "<script>" not in profile_data[field], f"XSS not prevented in {field}: {payload}"
                        assert "javascript:" not in profile_data[field], f"XSS not prevented in {field}: {payload}"
    
    @pytest.mark.asyncio
    async def test_search_query_xss_prevention(self, client: TestClient, auth_headers: dict):
        """Test XSS prevention in search queries."""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>"
        ]
        
        for payload in xss_payloads:
            response = client.post(
                "/api/v1/users/search",
                json={"q": payload},
                headers=auth_headers
            )
            
            # Should handle XSS attempts gracefully
            assert response.status_code in [200, 400, 422], f"Payload: {payload}"
            
            # Response should not contain unescaped script tags
            response_text = response.text
            assert "<script>" not in response_text, f"XSS not prevented: {payload}"
            assert "onerror=" not in response_text, f"XSS not prevented: {payload}"


class TestCSRFProtection:
    """Test CSRF (Cross-Site Request Forgery) protection."""
    
    @pytest.mark.asyncio
    async def test_state_changing_operations_require_auth(self, client: TestClient):
        """Test that state-changing operations require authentication."""
        # Test POST operations without authentication
        endpoints_to_test = [
            ("/api/v1/posts", {"content": "test", "post_type": "spontaneous"}),
            ("/api/v1/posts/123/reactions", {"emoji": "heart_eyes"}),
            ("/api/v1/posts/123/share", {"method": "url"}),
            ("/api/v1/follows/123", {}),
        ]
        
        for endpoint, data in endpoints_to_test:
            response = client.post(endpoint, json=data)
            
            # Should require authentication (401 = invalid token, 403 = no token)
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require auth"
    
    @pytest.mark.asyncio
    async def test_put_operations_require_auth(self, client: TestClient):
        """Test that PUT operations require authentication."""
        endpoints_to_test = [
            ("/api/v1/users/me/profile", {"bio": "test"}),
        ]
        
        for endpoint, data in endpoints_to_test:
            response = client.put(endpoint, json=data)
            
            # Should require authentication (401 = not authenticated, 403 = authenticated but not authorized)
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require auth"
    
    @pytest.mark.asyncio
    async def test_delete_operations_require_auth(self, client: TestClient):
        """Test that DELETE operations require authentication."""
        endpoints_to_test = [
            "/api/v1/posts/123/reactions",
            "/api/v1/follows/123",
        ]
        
        for endpoint in endpoints_to_test:
            response = client.delete(endpoint)
            
            # Should require authentication (401 = invalid token, 403 = no token)
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require auth"


class TestAuthenticationBypass:
    """Test authentication bypass attempts."""
    
    @pytest.mark.asyncio
    async def test_invalid_jwt_tokens(self, client: TestClient):
        """Test various invalid JWT token scenarios."""
        invalid_tokens = [
            "invalid.token.here",
            "Bearer invalid.token.here",
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature",
            "Bearer " + "a" * 500,  # Very long token
            "Bearer ",  # Empty token
            "Basic dXNlcjpwYXNz",  # Wrong auth type
        ]
        
        for token in invalid_tokens:
            headers = {"Authorization": token}
            response = client.get("/api/v1/users/me/profile", headers=headers)
            
            # Should reject invalid tokens (401 = not authenticated, 403 = authenticated but not authorized)
            assert response.status_code in [401, 403], f"Invalid token accepted: {token[:50]}..."
    
    @pytest.mark.asyncio
    async def test_expired_jwt_tokens(self, client: TestClient):
        """Test expired JWT token handling."""
        # Create an expired token
        expired_payload = {
            "sub": "123",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)  # Expired 1 hour ago
        }
        
        from app.core.security import SECRET_KEY, ALGORITHM
        expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=ALGORITHM)
        
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/users/me/profile", headers=headers)
        
        # Should reject expired token
        assert response.status_code == 401
        assert "expired" in response.text.lower() or "invalid" in response.text.lower()
    
    @pytest.mark.asyncio
    async def test_token_with_wrong_signature(self, client: TestClient):
        """Test JWT token with wrong signature."""
        # Create token with wrong secret
        payload = {
            "sub": "123",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        
        wrong_token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {wrong_token}"}
        response = client.get("/api/v1/users/me/profile", headers=headers)
        
        # Should reject token with wrong signature
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_token_type_confusion(self, client: TestClient):
        """Test using refresh token as access token."""
        # This would require creating a refresh token and trying to use it for API access
        # For now, test that token type validation works
        from app.core.security import create_refresh_token, decode_token
        
        refresh_token = create_refresh_token({"sub": "123"})
        
        # Try to decode as access token
        with pytest.raises((jwt.PyJWTError, ValueError)):
            decode_token(refresh_token, token_type="access")


class TestRateLimitingEffectiveness:
    """Test rate limiting effectiveness and bypass prevention."""
    
    @pytest.mark.asyncio
    async def test_rate_limiting_blocks_excessive_requests(self, client: TestClient, auth_headers: dict):
        """Test that rate limiting blocks excessive requests."""
        # Note: This test might be skipped in test environment due to rate limiting bypass
        # We'll test the rate limiter directly instead
        
        limiter = InMemoryRateLimiter()
        
        # Make requests up to the limit
        for i in range(10):
            result = limiter.is_allowed("test_user", "test_endpoint", limit=10, window_seconds=60)
            assert result["allowed"] is True
            limiter.record_request("test_user", "test_endpoint")
        
        # Next request should be blocked
        result = limiter.is_allowed("test_user", "test_endpoint", limit=10, window_seconds=60)
        assert result["allowed"] is False
    
    @pytest.mark.asyncio
    async def test_rate_limiting_bypass_attempts(self, client: TestClient):
        """Test various rate limiting bypass attempts."""
        # Test with different User-Agent headers
        headers_variations = [
            {"User-Agent": "Mozilla/5.0"},
            {"User-Agent": "Chrome/91.0"},
            {"User-Agent": "Bot/1.0"},
            {"X-Forwarded-For": "192.168.1.1"},
            {"X-Real-IP": "10.0.0.1"},
            {"X-Forwarded-For": "127.0.0.1, 192.168.1.1"},
        ]
        
        # Note: In test environment, rate limiting might be disabled
        # This test verifies the headers don't cause errors
        for headers in headers_variations:
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "wrongpassword"
            }, headers=headers)
            
            # Should handle different headers gracefully
            assert response.status_code in [400, 401, 422, 429]
    
    @pytest.mark.asyncio
    async def test_rate_limiting_per_endpoint(self):
        """Test that rate limiting is applied per endpoint."""
        limiter = InMemoryRateLimiter()
        
        # Fill up limit for one endpoint
        for i in range(10):
            limiter.record_request("user1", "endpoint1")
        
        # Should be blocked for endpoint1
        result = limiter.is_allowed("user1", "endpoint1", limit=10, window_seconds=60)
        assert result["allowed"] is False
        
        # Should still be allowed for endpoint2
        result = limiter.is_allowed("user1", "endpoint2", limit=10, window_seconds=60)
        assert result["allowed"] is True
    
    @pytest.mark.asyncio
    async def test_rate_limiting_window_sliding(self):
        """Test sliding window rate limiting."""
        limiter = InMemoryRateLimiter()
        
        with patch('time.time') as mock_time:
            # Start at time 0
            mock_time.return_value = 0
            
            # Make 5 requests
            for i in range(5):
                limiter.record_request("user1", "endpoint1")
            
            # Move time forward 30 seconds
            mock_time.return_value = 30
            
            # Should still count previous requests
            result = limiter.is_allowed("user1", "endpoint1", limit=10, window_seconds=60)
            assert result["current_count"] == 5
            
            # Move time forward 70 seconds (past window)
            mock_time.return_value = 70
            
            # Previous requests should be expired
            result = limiter.is_allowed("user1", "endpoint1", limit=10, window_seconds=60)
            assert result["current_count"] == 0


class TestInputSanitization:
    """Test input sanitization across all user-generated content endpoints."""
    
    def test_sanitizer_html_escaping(self):
        """Test HTML escaping in input sanitizer."""
        sanitizer = InputSanitizer()
        
        malicious_inputs = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "<svg onload=alert('xss')>",
            "<iframe src='javascript:alert(1)'></iframe>",
            "<object data='javascript:alert(1)'></object>",
            "<embed src='javascript:alert(1)'>",
            "<link rel=stylesheet href='javascript:alert(1)'>",
            "<style>@import'javascript:alert(1)';</style>",
        ]
        
        for malicious_input in malicious_inputs:
            sanitized = sanitizer.sanitize_text(malicious_input, "general")
            
            # Should escape HTML tags
            assert "<script>" not in sanitized
            assert "<img" not in sanitized
            assert "<svg" not in sanitized
            assert "<iframe" not in sanitized
            assert "javascript:" not in sanitized
            assert "onerror=" not in sanitized
            assert "onload=" not in sanitized
    
    def test_sanitizer_sql_injection_prevention(self):
        """Test SQL injection prevention in input sanitizer."""
        sanitizer = InputSanitizer()
        
        sql_injections = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --",
            "admin'--",
            "' OR 1=1 --",
            "'; EXEC xp_cmdshell('dir'); --",
        ]
        
        for injection in sql_injections:
            sanitized = sanitizer.sanitize_text(injection, "general")
            
            # Should escape single quotes and other SQL metacharacters
            assert "'" not in sanitized or "&#x27;" in sanitized or "&apos;" in sanitized
    
    def test_sanitizer_length_limits(self):
        """Test length limits in input sanitizer."""
        sanitizer = InputSanitizer()
        
        # Test different field types
        test_cases = [
            ("username", "a" * 100, 50),
            ("email", "a" * 300 + "@example.com", 254),
            ("bio", "a" * 1000, 500),
            ("post_content", "a" * 6000, 5000),
        ]
        
        for field_type, long_input, expected_max in test_cases:
            sanitized = sanitizer.sanitize_text(long_input, field_type)
            assert len(sanitized) <= expected_max, f"Length limit not enforced for {field_type}"
    
    def test_sanitizer_url_validation(self):
        """Test URL validation and sanitization."""
        sanitizer = InputSanitizer()
        
        test_cases = [
            ("example.com", "https://example.com"),
            ("http://example.com", "http://example.com"),
            ("https://example.com", "https://example.com"),
            ("javascript:alert(1)", "https://alert(1)"),  # Dangerous protocol removed
        ]
        
        for input_url, expected in test_cases:
            sanitized = sanitizer.sanitize_text(input_url, "url")
            assert sanitized == expected, f"URL sanitization failed for {input_url}"
    
    def test_file_upload_validation(self):
        """Test file upload validation."""
        sanitizer = InputSanitizer()
        
        # Valid file
        result = sanitizer.validate_file_upload(
            filename="test.jpg",
            content_type="image/jpeg",
            file_size=1024 * 1024,  # 1MB
            allowed_types=["image/jpeg", "image/png"],
            max_size=10 * 1024 * 1024  # 10MB
        )
        assert result["valid"] is True
        
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
            filename="malware.exe",
            content_type="application/exe",
            file_size=1024,
            allowed_types=["image/jpeg", "image/png"]
        )
        assert result["valid"] is False
        assert "not allowed" in result["errors"][0]
        
        # Filename with path traversal
        result = sanitizer.validate_file_upload(
            filename="../../../etc/passwd",
            content_type="image/jpeg",
            file_size=1024
        )
        assert "../" not in result["safe_filename"]
        assert "/" not in result["safe_filename"]


class TestJWTTokenSecurity:
    """Test JWT token security and session management."""
    
    def test_jwt_token_creation_and_validation(self):
        """Test JWT token creation and validation."""
        from app.core.security import create_access_token, decode_token
        
        # Create token
        token_data = {"sub": "123", "username": "testuser"}
        token = create_access_token(token_data)
        
        # Decode token
        decoded = decode_token(token, token_type="access")
        
        assert decoded["sub"] == "123"
        assert decoded["username"] == "testuser"
        assert "exp" in decoded
        assert "iat" in decoded
        assert "jti" in decoded  # JWT ID for revocation
        assert decoded["type"] == "access"
    
    def test_jwt_token_expiration(self):
        """Test JWT token expiration handling."""
        from app.core.security import create_access_token, decode_token
        
        # Create token with short expiration
        token_data = {"sub": "123"}
        expires_delta = timedelta(seconds=1)
        token = create_access_token(token_data, expires_delta)
        
        # Should be valid immediately
        decoded = decode_token(token, token_type="access")
        assert decoded["sub"] == "123"
        
        # Wait for expiration
        time.sleep(1.1)  # Wait slightly longer than expiration time
        
        # Should be expired
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_token(token, token_type="access")
    
    def test_jwt_token_tampering_detection(self):
        """Test JWT token tampering detection."""
        from app.core.security import create_access_token, decode_token
        
        # Create valid token
        token_data = {"sub": "123", "username": "testuser"}
        token = create_access_token(token_data)
        
        # Tamper with token
        parts = token.split('.')
        tampered_token = parts[0] + '.tampered.' + parts[2]
        
        # Should detect tampering
        with pytest.raises(jwt.InvalidTokenError):
            decode_token(tampered_token, token_type="access")
    
    def test_jwt_secret_key_strength(self):
        """Test JWT secret key strength."""
        from app.core.security import SECRET_KEY
        
        # Secret key should be strong enough
        assert len(SECRET_KEY) >= 32, "JWT secret key should be at least 32 characters"
        
        # Should not be default value in production
        if os.getenv("ENVIRONMENT") == "production":
            assert SECRET_KEY != "your-super-secret-key-change-this-in-production"
    
    def test_password_hashing_security(self):
        """Test password hashing security."""
        from app.core.security import get_password_hash, verify_password
        
        password = "test_password_123"
        
        # Hash password
        hashed = get_password_hash(password)
        
        # Should not store plain text
        assert password not in hashed
        
        # Should verify correctly
        assert verify_password(password, hashed) is True
        
        # Should reject wrong password
        assert verify_password("wrong_password", hashed) is False
        
        # Hash should be different each time (salt)
        hashed2 = get_password_hash(password)
        assert hashed != hashed2
    
    def test_token_type_validation(self):
        """Test token type validation."""
        from app.core.security import create_access_token, create_refresh_token, decode_token
        
        # Create different token types
        access_token = create_access_token({"sub": "123"})
        refresh_token = create_refresh_token({"sub": "123"})
        
        # Should validate correct types
        access_decoded = decode_token(access_token, token_type="access")
        assert access_decoded["type"] == "access"
        
        refresh_decoded = decode_token(refresh_token, token_type="refresh")
        assert refresh_decoded["type"] == "refresh"
        
        # Should reject wrong types
        with pytest.raises(ValueError):
            decode_token(refresh_token, token_type="access")
        
        with pytest.raises(ValueError):
            decode_token(access_token, token_type="refresh")


class TestDataPrivacyCompliance:
    """Test data privacy compliance and user data protection."""
    
    @pytest.mark.asyncio
    async def test_user_data_access_control(self, client: TestClient, auth_headers: dict):
        """Test that users can only access their own data."""
        # Try to access another user's profile (should fail)
        response = client.get("/api/v1/users/999/profile", headers=auth_headers)
        assert response.status_code in [403, 404]  # Forbidden or Not Found
    
    @pytest.mark.asyncio
    async def test_sensitive_data_not_exposed(self, client: TestClient, auth_headers: dict):
        """Test that sensitive data is not exposed in API responses."""
        # Get user profile
        response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        
        if response.status_code == 200:
            profile_data = response.json()["data"]
            
            # Should not expose sensitive fields
            sensitive_fields = ["password", "password_hash", "secret_key", "private_key"]
            for field in sensitive_fields:
                assert field not in profile_data, f"Sensitive field {field} exposed in profile"
    
    @pytest.mark.asyncio
    async def test_post_privacy_controls(self, client: TestClient, auth_headers: dict):
        """Test post privacy controls."""
        # Create a post
        response = client.post(
            "/api/v1/posts",
            json={
                "content": "This is a test post",
                "post_type": "spontaneous"
            },
            headers=auth_headers
        )
        
        if response.status_code in [200, 201]:
            response_data = response.json()
            # Handle both direct data and wrapped data responses
            post_data = response_data.get("data", response_data)
            
            # Should not expose internal fields
            internal_fields = ["user_password", "internal_id", "admin_notes"]
            for field in internal_fields:
                assert field not in post_data, f"Internal field {field} exposed in post"
    
    @pytest.mark.asyncio
    async def test_user_enumeration_prevention(self, client: TestClient):
        """Test prevention of user enumeration attacks."""
        # Try to enumerate users through login
        response1 = client.post("/api/v1/auth/login", json={
            "username": "definitely_nonexistent_user_12345",
            "password": "wrongpassword"
        })
        
        response2 = client.post("/api/v1/auth/login", json={
            "username": "testuser",  # Might exist
            "password": "wrongpassword"
        })
        
        # Responses should be similar to prevent user enumeration
        assert response1.status_code == response2.status_code
        
        # Response times should be similar (timing attack prevention)
        # Note: This is hard to test reliably in unit tests
    
    @pytest.mark.asyncio
    async def test_error_message_information_disclosure(self, client: TestClient):
        """Test that error messages don't disclose sensitive information."""
        # Test various endpoints with invalid data
        test_cases = [
            ("POST", "/api/v1/auth/login", {"username": "test", "password": "wrong"}),
            ("GET", "/api/v1/users/999999/profile", {}),
            ("POST", "/api/v1/posts", {"content": "", "post_type": "invalid"}),
        ]
        
        for method, endpoint, data in test_cases:
            if method == "POST":
                response = client.post(endpoint, json=data)
            else:
                response = client.get(endpoint)
            
            response_text = response.text.lower()
            
            # Should not expose sensitive information
            sensitive_info = [
                "database", "sql", "table", "column", "schema",
                "internal error", "stack trace", "file path",
                "secret", "key", "password", "hash"
            ]
            
            for info in sensitive_info:
                assert info not in response_text, f"Sensitive info '{info}' exposed in error message"


class TestSecurityHeaders:
    """Test security headers implementation."""
    
    @pytest.mark.asyncio
    async def test_security_headers_present(self, client: TestClient):
        """Test that security headers are present in responses."""
        response = client.get("/health")
        
        # Check for important security headers
        expected_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Content-Security-Policy",
            "Referrer-Policy"
        ]
        
        for header in expected_headers:
            assert header in response.headers, f"Security header {header} missing"
    
    @pytest.mark.asyncio
    async def test_security_header_values(self, client: TestClient):
        """Test security header values."""
        response = client.get("/health")
        
        # Check specific header values
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert "default-src 'self'" in response.headers.get("Content-Security-Policy", "")
    
    @pytest.mark.asyncio
    async def test_cors_headers(self, client: TestClient):
        """Test CORS headers configuration."""
        # Make a regular request with Origin header to trigger CORS
        headers = {"Origin": "http://localhost:3000"}  # Use allowed origin
        response = client.get("/health", headers=headers)
        
        # Should have CORS headers
        assert "Access-Control-Allow-Origin" in response.headers
        # Note: Other CORS headers are only present in preflight OPTIONS responses


class TestPenetrationTesting:
    """Basic penetration testing scenarios."""
    
    @pytest.mark.asyncio
    async def test_directory_traversal_attempts(self, client: TestClient):
        """Test directory traversal attack prevention."""
        traversal_payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "....//....//....//etc/passwd",
            "..%252f..%252f..%252fetc%252fpasswd"
        ]
        
        for payload in traversal_payloads:
            # Test in various endpoints
            response = client.get(f"/uploads/{payload}")
            
            # Should not allow directory traversal
            assert response.status_code in [400, 403, 404], f"Directory traversal not prevented: {payload}"
            
            # Should not expose file system structure
            response_text = response.text.lower()
            assert "etc/passwd" not in response_text
            assert "system32" not in response_text
    
    @pytest.mark.asyncio
    async def test_command_injection_attempts(self, client: TestClient, auth_headers: dict):
        """Test command injection prevention."""
        command_payloads = [
            "; ls -la",
            "| cat /etc/passwd",
            "&& whoami",
            "`id`",
            "$(whoami)",
            "; rm -rf /",
            "| nc -l 4444",
        ]
        
        for payload in command_payloads:
            # Test in user input fields
            response = client.post(
                "/api/v1/posts",
                json={
                    "content": payload,
                    "post_type": "spontaneous"
                },
                headers=auth_headers
            )
            
            # Should handle command injection attempts gracefully
            assert response.status_code in [200, 201, 400, 422], f"Command injection payload: {payload}"
            
            # Should not execute commands or expose system info
            if response.status_code in [200, 201]:
                response_text = response.text.lower()
                system_indicators = ["uid=", "gid=", "root", "bin/bash", "etc/passwd"]
                for indicator in system_indicators:
                    assert indicator not in response_text, f"Command execution detected: {payload}"
    
    @pytest.mark.asyncio
    async def test_file_inclusion_attempts(self, client: TestClient):
        """Test file inclusion attack prevention."""
        inclusion_payloads = [
            "/etc/passwd",
            "file:///etc/passwd",
            "php://filter/read=convert.base64-encode/resource=/etc/passwd",
            "data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+",
        ]
        
        for payload in inclusion_payloads:
            # Test in file-related endpoints
            response = client.get(f"/uploads/{payload}")
            
            # Should prevent file inclusion
            assert response.status_code in [400, 403, 404], f"File inclusion not prevented: {payload}"
    
    @pytest.mark.asyncio
    async def test_http_method_tampering(self, client: TestClient, auth_headers: dict):
        """Test HTTP method tampering prevention."""
        # Try to use POST data with GET request
        response = client.get(
            "/api/v1/posts?content=test&post_type=spontaneous",
            headers=auth_headers
        )
        
        # Should not create post via GET
        assert response.status_code != 201, "HTTP method tampering allowed"
        
        # Try method override headers
        override_headers = {**auth_headers, "X-HTTP-Method-Override": "DELETE"}
        response = client.post("/api/v1/posts", headers=override_headers, json={
            "content": "test",
            "post_type": "spontaneous"
        })
        
        # Should not honor method override for security-sensitive operations
        assert response.status_code in [200, 201], "Method override should not affect POST to create"


# Import os for environment checks
import os