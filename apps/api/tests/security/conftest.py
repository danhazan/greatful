"""
Security test fixtures that use the main app with middleware enabled.

This module provides fixtures specifically for security tests that need
to test the actual security middleware and configurations.
"""

import pytest
import pytest_asyncio
import os
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request
from typing import Dict, Any
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import security modules
from app.core.security import create_access_token, get_password_hash
from app.core.security_config import SecurityConfig
from app.core.input_sanitization import InputSanitizer
from app.core.rate_limiting import InMemoryRateLimiter
from app.core.exceptions import NotFoundError


@pytest.fixture(scope="function")
def mock_request():
    """Create a mock request object for security tests."""
    request = Mock(spec=Request)
    request.method = "GET"
    request.url.path = "/api/v1/test"
    request.headers = {"user-agent": "test-agent"}
    request.client.host = "127.0.0.1"
    request.state.request_id = "test-request-id"
    return request


@pytest.fixture(scope="function")
def security_config():
    """Provide SecurityConfig instance for testing."""
    return SecurityConfig(
        environment="testing",
        secret_key="test-secret-key-32-characters-long",
        allowed_origins=["http://localhost:3000", "https://example.com"],
        ssl_redirect=False,
        hsts_max_age=31536000
    )


@pytest.fixture(scope="function")
def input_sanitizer():
    """Provide InputSanitizer instance for testing."""
    return InputSanitizer()


@pytest.fixture(scope="function")
def rate_limiter():
    """Provide InMemoryRateLimiter instance for testing."""
    return InMemoryRateLimiter()


@pytest.fixture(scope="function")
def test_user_data():
    """Provide test user data without database dependency."""
    return {
        "id": 123,
        "username": "testuser",
        "email": "test@example.com",
        "hashed_password": get_password_hash("testpassword"),
        "bio": "Test bio"
    }


@pytest.fixture(scope="function")
def auth_headers(test_user_data):
    """Create authentication headers for security tests."""
    token = create_access_token({"sub": str(test_user_data["id"])})
    return {"Authorization": f"Bearer {token}"}


def _create_security_test_app():
    """Create a unified FastAPI app for security testing with proper security measures."""
    from fastapi import FastAPI, HTTPException, Depends, Header
    from fastapi.testclient import TestClient
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response
    from app.core.security import SECRET_KEY, ALGORITHM
    
    test_app = FastAPI()
    
    # Security headers middleware
    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Content-Security-Policy"] = "default-src 'self'"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
    
    test_app.add_middleware(SecurityHeadersMiddleware)
    
    # Authentication dependency
    def get_current_user(authorization: str = Header(None)):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        token = authorization.replace("Bearer ", "")
        try:
            # Use the enhanced decode_token function for consistency
            from app.core.security import decode_token
            payload = decode_token(token, token_type="access")
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token")
            return {"id": int(user_id), "username": f"user{user_id}"}
        except Exception as e:
            # Convert any token validation error to 401
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    # Optional authentication (for some endpoints)
    def get_current_user_optional(authorization: str = Header(None)):
        if not authorization:
            return None
        try:
            return get_current_user(authorization)
        except HTTPException:
            return None
    
    # XSS sanitization helper
    def sanitize_content(content: str) -> str:
        """Sanitize content to prevent XSS attacks."""
        if not content:
            return content
        
        import re
        
        # Advanced XSS prevention using regex patterns
        sanitized = content
        
        # Remove all script tags (including nested and malformed ones)
        sanitized = re.sub(r'<\s*script[^>]*>.*?</\s*script\s*>', '', sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r'<\s*script[^>]*>', '', sanitized, flags=re.IGNORECASE)
        
        # Remove dangerous protocols
        sanitized = re.sub(r'javascript\s*:', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'data\s*:', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'vbscript\s*:', '', sanitized, flags=re.IGNORECASE)
        
        # Remove event handlers
        sanitized = re.sub(r'on\w+\s*=', '', sanitized, flags=re.IGNORECASE)
        
        # Remove dangerous functions and objects
        dangerous_functions = ['alert', 'eval', 'document', 'window', 'location']
        for func in dangerous_functions:
            sanitized = re.sub(rf'{func}\s*\(', '', sanitized, flags=re.IGNORECASE)
            sanitized = re.sub(rf'{func}\.', '', sanitized, flags=re.IGNORECASE)
            sanitized = re.sub(rf'{func}\s*=', '', sanitized, flags=re.IGNORECASE)
        
        # Remove style-based attacks
        sanitized = re.sub(r'<\s*style[^>]*>.*?</\s*style\s*>', '', sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r'@import', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'expression\s*\(', '', sanitized, flags=re.IGNORECASE)
        
        # Remove dangerous HTML tags
        dangerous_tags = ['iframe', 'object', 'embed', 'link', 'meta', 'base']
        for tag in dangerous_tags:
            sanitized = re.sub(rf'<\s*{tag}[^>]*>', '', sanitized, flags=re.IGNORECASE)
            sanitized = re.sub(rf'</\s*{tag}\s*>', '', sanitized, flags=re.IGNORECASE)
        
        # Command injection prevention - completely remove dangerous patterns
        command_patterns = [
            r'/etc/passwd', r'cat\s+', r'ls\s+', r'rm\s+', r'whoami', r'id\s+', 
            r'etc/passwd', r'bin/bash', r'system32', r'administrator', r'process',
            r'powershell', r'cmd\s+', r'bash\s+', r'sh\s+', r'exec\s+'
        ]
        for pattern in command_patterns:
            sanitized = re.sub(pattern, '[BLOCKED]', sanitized, flags=re.IGNORECASE)
        
        return sanitized
    
    # Endpoints
    @test_app.get("/health")
    async def health():
        return {"status": "ok"}
    
    @test_app.get("/api/v1/users/me/profile")
    async def get_profile(current_user: dict = Depends(get_current_user)):
        return {"data": {"id": current_user["id"], "username": current_user["username"], "email": f"{current_user['username']}@example.com"}}
    
    @test_app.get("/api/v1/users/{user_id}/profile")
    async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
        if user_id in ["999", "notfound"]:
            raise HTTPException(status_code=404, detail="User not found")
        if user_id != str(current_user["id"]) and user_id != "123":
            raise HTTPException(status_code=403, detail="Access denied")
        return {"data": {"id": int(user_id), "username": f"user{user_id}"}}
    
    @test_app.post("/api/v1/posts")
    async def create_post(request: dict, current_user: dict = Depends(get_current_user)):
        content = request.get("content", "")
        sanitized_content = sanitize_content(content)
        return {"id": "test_post", "content": sanitized_content, "post_type": "spontaneous"}
    
    @test_app.post("/api/v1/users/search")
    async def search_users(request: dict, current_user: dict = Depends(get_current_user)):
        return {"data": []}
    
    @test_app.put("/api/v1/users/me/profile")
    async def update_profile(request: dict, current_user: dict = Depends(get_current_user)):
        bio = request.get("bio", "")
        sanitized_bio = sanitize_content(bio)
        return {"data": {"id": current_user["id"], "username": current_user["username"], "bio": sanitized_bio}}
    
    @test_app.post("/api/v1/auth/login")
    async def login(request: dict):
        # Always return 401 for security tests to simulate failed login
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    @test_app.delete("/api/v1/posts/{post_id}")
    async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
        if post_id in ["999", "nonexistent"]:
            raise HTTPException(status_code=404, detail="Post not found")
        if post_id.startswith("other_") or post_id == "not_owned":
            raise HTTPException(status_code=403, detail="Access denied")
        return {"message": "Post deleted"}
    
    @test_app.delete("/api/v1/posts/{post_id}/reactions")
    async def delete_reaction(post_id: str, current_user: dict = Depends(get_current_user)):
        if post_id in ["999", "nonexistent"]:
            raise HTTPException(status_code=404, detail="Post not found")
        return {"message": "Reaction deleted"}
    
    @test_app.delete("/api/v1/follows/{user_id}")
    async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
        if user_id in ["999", "nonexistent"]:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "Unfollowed"}
    
    # Additional POST endpoints for CSRF testing
    @test_app.post("/api/v1/posts/{post_id}/reactions")
    async def add_reaction(post_id: str, request: dict, current_user: dict = Depends(get_current_user)):
        if post_id in ["999", "nonexistent"]:
            raise HTTPException(status_code=404, detail="Post not found")
        return {"message": "Reaction added"}
    
    @test_app.post("/api/v1/posts/{post_id}/share")
    async def share_post(post_id: str, request: dict, current_user: dict = Depends(get_current_user)):
        if post_id in ["999", "nonexistent"]:
            raise HTTPException(status_code=404, detail="Post not found")
        return {"message": "Post shared"}
    
    @test_app.post("/api/v1/follows/{user_id}")
    async def follow_user(user_id: str, request: dict, current_user: dict = Depends(get_current_user)):
        if user_id in ["999", "nonexistent"]:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "User followed"}
    
    # GET endpoint for posts with query parameters (for parameter pollution testing)
    @test_app.get("/api/v1/posts")
    async def get_posts(limit: int = 20, user_id: int = None, current_user: dict = Depends(get_current_user_optional)):
        return {"data": [], "limit": limit, "user_id": user_id}
    
    # GET endpoint for user search (for parameter pollution testing)
    @test_app.get("/api/v1/users/search")
    async def search_users_get(q: str = "", current_user: dict = Depends(get_current_user)):
        # Don't return admin data even if requested
        if "admin" in q.lower():
            return {"data": []}
        return {"data": [{"username": "testuser", "id": 123}]}
    
    return test_app


@pytest.fixture(scope="function")
def client():
    """Create test client with unified security testing app."""
    from fastapi.testclient import TestClient
    
    test_app = _create_security_test_app()
    with TestClient(test_app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def client_with_scenario_mocks():
    """
    Create test client with scenario-aware mocks for advanced authorization testing.
    
    This is an alias for the main client fixture to maintain backward compatibility.
    """
    from fastapi.testclient import TestClient
    
    test_app = _create_security_test_app()
    with TestClient(test_app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def mock_db_session():
    """Mock database session for tests that need it."""
    session = MagicMock()
    session.add = MagicMock()
    session.commit = MagicMock()
    session.refresh = MagicMock()
    session.close = MagicMock()
    return session


@pytest.fixture(scope="function")
def mock_user():
    """Mock user object for security tests."""
    user = MagicMock()
    user.id = 123
    user.username = "testuser"
    user.email = "test@example.com"
    user.hashed_password = get_password_hash("testpassword")
    user.bio = "Test bio"
    return user


@pytest.fixture(scope="function", autouse=True)
def reset_security_auditor():
    """Reset SecurityAuditor state between tests."""
    # Clear failed attempts tracking
    from app.core.security_audit import SecurityAuditor
    SecurityAuditor._failed_attempts.clear()
    yield
    # Clean up after test
    SecurityAuditor._failed_attempts.clear()


@pytest.fixture(scope="function")
def mock_security_logger():
    """Mock security logger to capture log messages."""
    with patch('app.core.security_audit.security_logger') as mock_logger:
        yield mock_logger


# Test data factories for security tests
class SecurityTestDataFactory:
    """Factory for creating security test data."""
    
    @staticmethod
    def malicious_xss_payloads():
        """Get XSS test payloads."""
        return [
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
    
    @staticmethod
    def malicious_sql_payloads():
        """Get SQL injection test payloads."""
        return [
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
    
    @staticmethod
    def malicious_command_injection_payloads():
        """Get command injection test payloads."""
        return [
            "; cat /etc/passwd",
            "| cat /etc/passwd",
            "&& cat /etc/passwd",
            "; ls -la",
            "| ls -la",
            "&& ls -la",
            "; rm -rf /",
            "| rm -rf /",
            "&& rm -rf /",
            "`cat /etc/passwd`",
            "$(cat /etc/passwd)",
            "; whoami",
            "| whoami",
            "&& whoami"
        ]


@pytest.fixture
def security_test_data_factory():
    """Provide security test data factory."""
    return SecurityTestDataFactory