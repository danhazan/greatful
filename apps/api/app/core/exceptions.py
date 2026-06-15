"""
Custom exception classes for standardized error handling.
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class BaseAPIException(HTTPException):
    """Base exception class for API errors."""
    
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        self.error_code = error_code
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)


class ValidationException(BaseAPIException):
    """Exception for validation errors."""
    
    def __init__(self, message: str, fields: Optional[Dict[str, str]] = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="validation_error",
            message=message,
            details={"fields": fields or {}}
        )


class NotFoundError(BaseAPIException):
    """Exception for resource not found errors."""
    
    def __init__(self, resource: str, resource_id: Optional[str] = None):
        message = f"{resource} not found"
        if resource_id:
            message += f" with id: {resource_id}"
        
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="not_found",
            message=message,
            details={"resource": resource, "id": resource_id}
        )


class ConflictError(BaseAPIException):
    """Exception for resource conflict errors."""
    
    def __init__(self, message: str, resource: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        merged_details = {"resource": resource}
        if details:
            merged_details.update(details)
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="already_exists",
            message=message,
            details=merged_details
        )


class PermissionDeniedError(BaseAPIException):
    """Exception for permission denied errors."""
    
    def __init__(self, message: str, resource: Optional[str] = None, action: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="permission_denied",
            message=message,
            details={"resource": resource, "action": action}
        )


class UpstreamServiceError(BaseAPIException):
    """Exception for upstream/dependency service failures."""

    def __init__(self, message: str, constraint: str, status_code: int = 502):
        super().__init__(
            status_code=status_code,
            error_code="upstream_error",
            message=message,
            details={"constraint": constraint}
        )


class RateLimitError(BaseAPIException):
    """Exception for rate limit exceeded errors."""
    
    def __init__(self, limit: int, reset_time: str, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="rate_limit_exceeded",
            message=f"Rate limit exceeded. Maximum {limit} requests allowed.",
            details={
                "limit": limit,
                "reset_time": reset_time,
                "retry_after": retry_after
            }
        )


class BusinessLogicError(BaseAPIException):
    """Exception for business logic violations."""
    
    def __init__(self, message: str, constraint: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="business_logic_error",
            message=message,
            details={"constraint": constraint}
        )


class AuthenticationError(BaseAPIException):
    """Exception for authentication errors."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="authentication_error",
            message=message
        )


class InternalServerError(BaseAPIException):
    """Exception for internal server errors."""
    
    def __init__(self, message: str = "Internal server error"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="internal_error",
            message=message
        )


class DatabaseError(BaseAPIException):
    """Exception for database operation errors."""
    
    def __init__(self, message: str, operation: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="database_error",
            message=message,
            details={"operation": operation}
        )


class QueryTimeoutError(DatabaseError):
    """Exception for database query timeouts."""
    
    def __init__(self, timeout_seconds: float, query_type: Optional[str] = None):
        message = f"Database query timed out after {timeout_seconds} seconds"
        super().__init__(
            message=message,
            operation=query_type
        )
        self.details.update({"timeout_seconds": timeout_seconds})


class ConnectionError(DatabaseError):
    """Exception for database connection failures."""
    
    def __init__(self, message: str = "Database connection failed"):
        super().__init__(
            message=message,
            operation="connection"
        )


class ResurrectionRequired(Exception):
    """NOT an HTTPException — signals resurrection flow to route handlers only.

    Raised by services when a tombstoned identity is detected. Route handlers
    intercept this and return the canonical ResurrectionResponse (JSONResponse
    with status 409), bypassing the global exception handler entirely.

    Not an HTTPException subclass, so it will never be caught by:
      - FastAPI/Starlette's built-in HTTPException handler
      - ErrorHandlingMiddleware (which catches BaseAPIException)
      - except HTTPException clauses
    """

    def __init__(
        self,
        identity_type: str,
        *,
        tombstone_user_id: Optional[int] = None,
        provider: Optional[str] = None,
        provider_user_id: Optional[str] = None,
        oauth_email: Optional[str] = None,
        oauth_user_info: Optional[dict] = None,
        message: Optional[str] = None,
    ):
        self.identity_type = identity_type
        self.tombstone_user_id = tombstone_user_id
        self.provider = provider
        self.provider_user_id = provider_user_id
        self.oauth_email = oauth_email
        self.oauth_user_info = oauth_user_info
        self.message = message
        super().__init__(message or "Resurrection available")