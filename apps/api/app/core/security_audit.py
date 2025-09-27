"""
Security audit logging and monitoring system.

This module provides comprehensive security event logging, monitoring,
and alerting capabilities for the application.
"""

import os
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional, List
from fastapi import Request
from dataclasses import dataclass, asdict


# Configure security-specific logger
security_logger = logging.getLogger("security_audit")
security_logger.setLevel(logging.INFO)

# Create security log handler if not exists
if not security_logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s - SECURITY - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    security_logger.addHandler(handler)


class SecurityEventType(Enum):
    """Security event types for audit logging."""
    
    # Authentication Events
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    REGISTRATION = "registration"
    TOKEN_REFRESH = "token_refresh"
    TOKEN_EXPIRED = "token_expired"
    TOKEN_INVALID = "token_invalid"
    PASSWORD_CHANGE = "password_change"
    ACCOUNT_LOCKED = "account_locked"
    
    # OAuth-specific Events
    OAUTH_LOGIN_INITIATED = "oauth_login_initiated"
    OAUTH_LOGIN_SUCCESS = "oauth_login_success"
    OAUTH_LOGIN_FAILURE = "oauth_login_failure"
    OAUTH_ACCOUNT_LINKED = "oauth_account_linked"
    OAUTH_ACCOUNT_UNLINKED = "oauth_account_unlinked"
    OAUTH_USER_CREATED = "oauth_user_created"
    OAUTH_TOKEN_EXCHANGE_FAILED = "oauth_token_exchange_failed"
    OAUTH_INVALID_STATE = "oauth_invalid_state"
    OAUTH_PROVIDER_ERROR = "oauth_provider_error"
    OAUTH_CONFIGURATION_ERROR = "oauth_configuration_error"
    
    # Authorization Events
    ACCESS_DENIED = "access_denied"
    PRIVILEGE_ESCALATION_ATTEMPT = "privilege_escalation_attempt"
    UNAUTHORIZED_RESOURCE_ACCESS = "unauthorized_resource_access"
    
    # Input Validation Events
    XSS_ATTEMPT = "xss_attempt"
    SQL_INJECTION_ATTEMPT = "sql_injection_attempt"
    COMMAND_INJECTION_ATTEMPT = "command_injection_attempt"
    PATH_TRAVERSAL_ATTEMPT = "path_traversal_attempt"
    MALICIOUS_FILE_UPLOAD = "malicious_file_upload"
    INPUT_VALIDATION_FAILURE = "input_validation_failure"
    
    # Rate Limiting Events
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    RATE_LIMIT_BYPASS_ATTEMPT = "rate_limit_bypass_attempt"
    
    # Data Access Events
    SENSITIVE_DATA_ACCESS = "sensitive_data_access"
    DATA_EXPORT = "data_export"
    BULK_DATA_ACCESS = "bulk_data_access"
    USER_ENUMERATION_ATTEMPT = "user_enumeration_attempt"
    
    # System Events
    CONFIGURATION_CHANGE = "configuration_change"
    SECURITY_POLICY_VIOLATION = "security_policy_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    BRUTE_FORCE_ATTEMPT = "brute_force_attempt"
    
    # File System Events
    FILE_ACCESS_VIOLATION = "file_access_violation"
    DIRECTORY_TRAVERSAL = "directory_traversal"
    UNAUTHORIZED_FILE_ACCESS = "unauthorized_file_access"
    
    # Network Events
    SUSPICIOUS_IP = "suspicious_ip"
    MULTIPLE_FAILED_ATTEMPTS = "multiple_failed_attempts"
    UNUSUAL_USER_AGENT = "unusual_user_agent"


@dataclass
class SecurityEvent:
    """Security event data structure."""
    
    event_type: SecurityEventType
    timestamp: datetime
    user_id: Optional[int]
    username: Optional[str]
    ip_address: str
    user_agent: str
    endpoint: str
    method: str
    request_id: Optional[str]
    details: Dict[str, Any]
    severity: str  # INFO, WARNING, ERROR, CRITICAL
    success: bool
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging."""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        data['event_type'] = self.event_type.value
        return data
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), default=str)


class SecurityAuditor:
    """Security audit logging and monitoring."""
    
    # Track failed attempts per IP
    _failed_attempts: Dict[str, List[datetime]] = {}
    
    # Suspicious patterns
    SUSPICIOUS_USER_AGENTS = [
        'sqlmap', 'nikto', 'nmap', 'masscan', 'zap', 'burp',
        'python-requests', 'curl', 'wget', 'scanner'
    ]
    
    XSS_PATTERNS = [
        '<script', 'javascript:', 'onerror=', 'onload=', 'onclick=',
        'onmouseover=', 'onfocus=', 'onblur=', 'alert(', 'confirm(',
        'prompt(', 'document.cookie', 'window.location'
    ]
    
    SQL_INJECTION_PATTERNS = [
        "' or '1'='1", "' or 1=1", "'; drop table", "'; delete from",
        "'; insert into", "'; update ", "union select", "' union ",
        "' having ", "' group by", "' order by", "--", "/*", "*/"
    ]
    
    COMMAND_INJECTION_PATTERNS = [
        '; ls', '; cat', '; rm', '; wget', '; curl', '; nc',
        '| cat', '| ls', '| rm', '&& cat', '&& ls', '`cat',
        '$(cat', '${cat', '; whoami', '| whoami', '&& whoami'
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        '../', '..\\', '%2e%2e%2f', '%2e%2e\\', '....//....',
        '..%252f', '..%255c', '/etc/passwd', '/etc/shadow',
        'c:\\windows\\system32'
    ]
    
    @classmethod
    def log_security_event(
        cls,
        event_type: SecurityEventType,
        request: Request,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "INFO",
        success: bool = True
    ):
        """Log a security event."""
        
        event = SecurityEvent(
            event_type=event_type,
            timestamp=datetime.now(timezone.utc),
            user_id=user_id,
            username=username,
            ip_address=cls._get_client_ip(request),
            user_agent=request.headers.get("user-agent", "unknown"),
            endpoint=request.url.path,
            method=request.method,
            request_id=getattr(request.state, 'request_id', None),
            details=details or {},
            severity=severity,
            success=success
        )
        
        # Log based on severity
        log_message = cls._format_log_message(event)
        
        if severity == "CRITICAL":
            security_logger.critical(log_message, extra=event.to_dict())
        elif severity == "ERROR":
            security_logger.error(log_message, extra=event.to_dict())
        elif severity == "WARNING":
            security_logger.warning(log_message, extra=event.to_dict())
        else:
            security_logger.info(log_message, extra=event.to_dict())
        
        # Check for suspicious patterns
        cls._analyze_security_event(event, request)
    
    @classmethod
    def log_authentication_event(
        cls,
        event_type: SecurityEventType,
        request: Request,
        username: str,
        user_id: Optional[int] = None,
        success: bool = True,
        failure_reason: Optional[str] = None
    ):
        """Log authentication-related events."""
        
        details = {}
        if failure_reason:
            details["failure_reason"] = failure_reason
        
        severity = "INFO" if success else "WARNING"
        
        cls.log_security_event(
            event_type=event_type,
            request=request,
            user_id=user_id,
            username=username,
            details=details,
            severity=severity,
            success=success
        )
        
        # Track failed attempts for brute force detection
        if not success:
            cls._track_failed_attempt(request)
    
    @classmethod
    def log_input_validation_failure(
        cls,
        request: Request,
        field_name: str,
        malicious_input: str,
        attack_type: SecurityEventType,
        user_id: Optional[int] = None
    ):
        """Log input validation failures and potential attacks."""
        
        details = {
            "field_name": field_name,
            "malicious_input": malicious_input[:500],  # Truncate for logging
            "attack_type": attack_type.value
        }
        
        cls.log_security_event(
            event_type=attack_type,
            request=request,
            user_id=user_id,
            details=details,
            severity="WARNING",
            success=False
        )
    
    @classmethod
    def log_rate_limit_violation(
        cls,
        request: Request,
        user_id: Optional[int] = None,
        limit: int = 0,
        current_count: int = 0,
        endpoint: str = ""
    ):
        """Log rate limit violations."""
        
        details = {
            "limit": limit,
            "current_count": current_count,
            "endpoint": endpoint
        }
        
        cls.log_security_event(
            event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
            request=request,
            user_id=user_id,
            details=details,
            severity="WARNING",
            success=False
        )
    
    @classmethod
    def log_access_denied(
        cls,
        request: Request,
        resource: str,
        required_permission: str,
        user_id: Optional[int] = None,
        username: Optional[str] = None
    ):
        """Log access denied events."""
        
        details = {
            "resource": resource,
            "required_permission": required_permission
        }
        
        cls.log_security_event(
            event_type=SecurityEventType.ACCESS_DENIED,
            request=request,
            user_id=user_id,
            username=username,
            details=details,
            severity="WARNING",
            success=False
        )
    
    @classmethod
    def log_suspicious_activity(
        cls,
        request: Request,
        activity_type: str,
        description: str,
        user_id: Optional[int] = None,
        severity: str = "WARNING"
    ):
        """Log suspicious activity."""
        
        details = {
            "activity_type": activity_type,
            "description": description
        }
        
        cls.log_security_event(
            event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
            request=request,
            user_id=user_id,
            details=details,
            severity=severity,
            success=False
        )
    
    @classmethod
    def analyze_request_for_attacks(
        cls,
        request: Request,
        user_input: str,
        field_name: str,
        user_id: Optional[int] = None
    ):
        """Analyze user input for potential attacks."""
        
        input_lower = user_input.lower()
        
        # Check for XSS attempts
        for pattern in cls.XSS_PATTERNS:
            if pattern.lower() in input_lower:
                cls.log_input_validation_failure(
                    request=request,
                    field_name=field_name,
                    malicious_input=user_input,
                    attack_type=SecurityEventType.XSS_ATTEMPT,
                    user_id=user_id
                )
                break
        
        # Check for SQL injection attempts
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if pattern.lower() in input_lower:
                cls.log_input_validation_failure(
                    request=request,
                    field_name=field_name,
                    malicious_input=user_input,
                    attack_type=SecurityEventType.SQL_INJECTION_ATTEMPT,
                    user_id=user_id
                )
                break
        
        # Check for command injection attempts
        for pattern in cls.COMMAND_INJECTION_PATTERNS:
            if pattern.lower() in input_lower:
                cls.log_input_validation_failure(
                    request=request,
                    field_name=field_name,
                    malicious_input=user_input,
                    attack_type=SecurityEventType.COMMAND_INJECTION_ATTEMPT,
                    user_id=user_id
                )
                break
        
        # Check for path traversal attempts
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if pattern.lower() in input_lower:
                cls.log_input_validation_failure(
                    request=request,
                    field_name=field_name,
                    malicious_input=user_input,
                    attack_type=SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
                    user_id=user_id
                )
                break
    
    @classmethod
    def _get_client_ip(cls, request: Request) -> str:
        """Get client IP address from request."""
        # Check X-Forwarded-For header first (for load balancers/proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fall back to client host
        return request.client.host if request.client else "unknown"
    
    @classmethod
    def _format_log_message(cls, event: SecurityEvent) -> str:
        """Format security event for logging."""
        return (
            f"{event.event_type.value.upper()} - "
            f"User: {event.username or 'anonymous'} ({event.user_id or 'N/A'}) - "
            f"IP: {event.ip_address} - "
            f"Endpoint: {event.method} {event.endpoint} - "
            f"Success: {event.success} - "
            f"Details: {json.dumps(event.details)}"
        )
    
    @classmethod
    def _analyze_security_event(cls, event: SecurityEvent, request: Request):
        """Analyze security event for additional threats."""
        
        # Check for suspicious user agent
        user_agent = event.user_agent.lower()
        for suspicious_agent in cls.SUSPICIOUS_USER_AGENTS:
            if suspicious_agent in user_agent:
                cls.log_suspicious_activity(
                    request=request,
                    activity_type="suspicious_user_agent",
                    description=f"Suspicious user agent detected: {event.user_agent}",
                    user_id=event.user_id,
                    severity="WARNING"
                )
                break
        
        # Check for multiple failed attempts from same IP
        if not event.success and event.event_type in [
            SecurityEventType.LOGIN_FAILURE,
            SecurityEventType.ACCESS_DENIED
        ]:
            failed_count = cls._get_failed_attempts_count(event.ip_address)
            if failed_count >= 5:  # Threshold for brute force
                cls.log_security_event(
                    event_type=SecurityEventType.BRUTE_FORCE_ATTEMPT,
                    request=request,
                    user_id=event.user_id,
                    username=event.username,
                    details={
                        "failed_attempts": failed_count,
                        "ip_address": event.ip_address
                    },
                    severity="ERROR",
                    success=False
                )
    
    @classmethod
    def _track_failed_attempt(cls, request: Request):
        """Track failed authentication attempts."""
        ip_address = cls._get_client_ip(request)
        current_time = datetime.now(timezone.utc)
        
        if ip_address not in cls._failed_attempts:
            cls._failed_attempts[ip_address] = []
        
        cls._failed_attempts[ip_address].append(current_time)
        
        # Clean up old attempts (keep only last hour)
        one_hour_ago = current_time - timedelta(hours=1)
        cls._failed_attempts[ip_address] = [
            attempt for attempt in cls._failed_attempts[ip_address]
            if attempt > one_hour_ago
        ]
    
    @classmethod
    def _get_failed_attempts_count(cls, ip_address: str) -> int:
        """Get count of failed attempts for IP address."""
        if ip_address not in cls._failed_attempts:
            return 0
        
        current_time = datetime.now(timezone.utc)
        one_hour_ago = current_time - timedelta(hours=1)
        
        # Count attempts in last hour
        recent_attempts = [
            attempt for attempt in cls._failed_attempts[ip_address]
            if attempt > one_hour_ago
        ]
        
        return len(recent_attempts)
    
    @classmethod
    def get_security_metrics(cls, hours: int = 24) -> Dict[str, Any]:
        """Get security metrics for monitoring dashboard."""
        # This would typically query a database or log aggregation system
        # For now, return basic structure
        
        return {
            "time_period_hours": hours,
            "total_events": 0,
            "events_by_type": {},
            "events_by_severity": {
                "INFO": 0,
                "WARNING": 0,
                "ERROR": 0,
                "CRITICAL": 0
            },
            "top_source_ips": [],
            "failed_login_attempts": 0,
            "blocked_attacks": 0,
            "rate_limit_violations": 0
        }
    
    @classmethod
    def is_ip_suspicious(cls, ip_address: str) -> bool:
        """Check if IP address is suspicious based on recent activity."""
        failed_count = cls._get_failed_attempts_count(ip_address)
        return failed_count >= 3  # Threshold for suspicious activity


# Import timedelta for time calculations
from datetime import timedelta


# Convenience functions for common security events
def log_login_success(request: Request, user_id: int, username: str):
    """Log successful login event."""
    SecurityAuditor.log_authentication_event(
        event_type=SecurityEventType.LOGIN_SUCCESS,
        request=request,
        username=username,
        user_id=user_id,
        success=True
    )


def log_login_failure(request: Request, username: str, failure_reason: str = "Invalid credentials"):
    """Log failed login event."""
    SecurityAuditor.log_authentication_event(
        event_type=SecurityEventType.LOGIN_FAILURE,
        request=request,
        username=username,
        success=False,
        failure_reason=failure_reason
    )