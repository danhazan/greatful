"""
Security audit logging and monitoring utilities.
"""

import logging
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import Request
from enum import Enum

# Configure security audit logger
security_logger = logging.getLogger("security_audit")
security_logger.setLevel(logging.INFO)

# Create separate handler for security logs if not exists
if not security_logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s - SECURITY - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    security_logger.addHandler(handler)
    security_logger.propagate = False


class SecurityEventType(Enum):
    """Types of security events to audit."""
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    REGISTRATION = "registration"
    PASSWORD_CHANGE = "password_change"
    TOKEN_REFRESH = "token_refresh"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INVALID_TOKEN = "invalid_token"
    PERMISSION_DENIED = "permission_denied"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    FILE_UPLOAD = "file_upload"
    DATA_ACCESS = "data_access"
    ADMIN_ACTION = "admin_action"


class SecurityAuditor:
    """
    Security audit logging utility.
    """
    
    @staticmethod
    def log_security_event(
        event_type: SecurityEventType,
        request: Optional[Request] = None,
        user_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "INFO"
    ):
        """
        Log a security event with comprehensive context.
        
        Args:
            event_type: Type of security event
            request: FastAPI request object for context
            user_id: ID of the user involved
            details: Additional event details
            severity: Log severity level
        """
        # Build audit log entry
        audit_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type.value,
            "user_id": user_id,
            "severity": severity,
            "details": details or {}
        }
        
        # Add request context if available
        if request:
            audit_entry.update({
                "request_id": getattr(request.state, 'request_id', None),
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "user_agent": request.headers.get("user-agent"),
                "client_ip": SecurityAuditor._get_client_ip(request),
                "referer": request.headers.get("referer"),
            })
        
        # Log the event
        log_message = f"{event_type.value.upper()}: {json.dumps(audit_entry, default=str)}"
        
        if severity == "ERROR":
            security_logger.error(log_message)
        elif severity == "WARNING":
            security_logger.warning(log_message)
        else:
            security_logger.info(log_message)
    
    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to direct client IP
        return request.client.host if request.client else "unknown"
    
    @staticmethod
    def log_authentication_event(
        event_type: SecurityEventType,
        request: Request,
        username: Optional[str] = None,
        user_id: Optional[int] = None,
        success: bool = True,
        failure_reason: Optional[str] = None
    ):
        """
        Log authentication-related events.
        
        Args:
            event_type: Type of authentication event
            request: FastAPI request object
            username: Username involved in the event
            user_id: User ID if available
            success: Whether the authentication was successful
            failure_reason: Reason for failure if applicable
        """
        details = {
            "username": username,
            "success": success
        }
        
        if failure_reason:
            details["failure_reason"] = failure_reason
        
        severity = "INFO" if success else "WARNING"
        
        SecurityAuditor.log_security_event(
            event_type=event_type,
            request=request,
            user_id=user_id,
            details=details,
            severity=severity
        )
    
    @staticmethod
    def log_rate_limit_event(
        request: Request,
        user_id: Optional[int] = None,
        endpoint: str = "",
        current_count: int = 0,
        limit: int = 0
    ):
        """
        Log rate limiting events.
        
        Args:
            request: FastAPI request object
            user_id: User ID if available
            endpoint: Endpoint that was rate limited
            current_count: Current request count
            limit: Rate limit threshold
        """
        details = {
            "endpoint": endpoint,
            "current_count": current_count,
            "limit": limit,
            "exceeded_by": current_count - limit
        }
        
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
            request=request,
            user_id=user_id,
            details=details,
            severity="WARNING"
        )
    
    @staticmethod
    def log_data_access_event(
        request: Request,
        user_id: int,
        resource_type: str,
        resource_id: str,
        action: str,
        success: bool = True
    ):
        """
        Log data access events for sensitive operations.
        
        Args:
            request: FastAPI request object
            user_id: ID of the user accessing data
            resource_type: Type of resource (post, user, etc.)
            resource_id: ID of the specific resource
            action: Action performed (read, write, delete)
            success: Whether the access was successful
        """
        details = {
            "resource_type": resource_type,
            "resource_id": resource_id,
            "action": action,
            "success": success
        }
        
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.DATA_ACCESS,
            request=request,
            user_id=user_id,
            details=details,
            severity="INFO"
        )
    
    @staticmethod
    def log_file_upload_event(
        request: Request,
        user_id: int,
        filename: str,
        file_size: int,
        content_type: str,
        success: bool = True,
        validation_errors: Optional[list] = None
    ):
        """
        Log file upload events for security monitoring.
        
        Args:
            request: FastAPI request object
            user_id: ID of the user uploading
            filename: Name of the uploaded file
            file_size: Size of the file in bytes
            content_type: MIME type of the file
            success: Whether the upload was successful
            validation_errors: List of validation errors if any
        """
        details = {
            "filename": filename,
            "file_size": file_size,
            "content_type": content_type,
            "success": success
        }
        
        if validation_errors:
            details["validation_errors"] = validation_errors
        
        severity = "INFO" if success else "WARNING"
        
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.FILE_UPLOAD,
            request=request,
            user_id=user_id,
            details=details,
            severity=severity
        )
    
    @staticmethod
    def log_suspicious_activity(
        request: Request,
        user_id: Optional[int] = None,
        activity_type: str = "",
        description: str = "",
        risk_level: str = "MEDIUM"
    ):
        """
        Log suspicious activity for security monitoring.
        
        Args:
            request: FastAPI request object
            user_id: User ID if available
            activity_type: Type of suspicious activity
            description: Description of the activity
            risk_level: Risk level (LOW, MEDIUM, HIGH, CRITICAL)
        """
        details = {
            "activity_type": activity_type,
            "description": description,
            "risk_level": risk_level
        }
        
        severity = "ERROR" if risk_level in ["HIGH", "CRITICAL"] else "WARNING"
        
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
            request=request,
            user_id=user_id,
            details=details,
            severity=severity
        )


# Convenience functions for common security events
def log_login_success(request: Request, user_id: int, username: str):
    """Log successful login."""
    SecurityAuditor.log_authentication_event(
        SecurityEventType.LOGIN_SUCCESS,
        request,
        username=username,
        user_id=user_id,
        success=True
    )


def log_login_failure(request: Request, username: str, reason: str):
    """Log failed login attempt."""
    SecurityAuditor.log_authentication_event(
        SecurityEventType.LOGIN_FAILURE,
        request,
        username=username,
        success=False,
        failure_reason=reason
    )


def log_rate_limit_exceeded(request: Request, user_id: Optional[int], endpoint: str, count: int, limit: int):
    """Log rate limit exceeded event."""
    SecurityAuditor.log_rate_limit_event(
        request,
        user_id=user_id,
        endpoint=endpoint,
        current_count=count,
        limit=limit
    )


def log_invalid_token(request: Request, token_type: str = "access"):
    """Log invalid token usage."""
    SecurityAuditor.log_security_event(
        SecurityEventType.INVALID_TOKEN,
        request=request,
        details={"token_type": token_type},
        severity="WARNING"
    )


def log_permission_denied(request: Request, user_id: int, resource: str, action: str):
    """Log permission denied events."""
    SecurityAuditor.log_security_event(
        SecurityEventType.PERMISSION_DENIED,
        request=request,
        user_id=user_id,
        details={"resource": resource, "action": action},
        severity="WARNING"
    )