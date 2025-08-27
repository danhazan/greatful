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
    
    def __init__(self, message: str, resource: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="already_exists",
            message=message,
            details={"resource": resource}
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