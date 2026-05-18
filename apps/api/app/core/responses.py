"""
Standardized response formatting for API endpoints.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Error detail structure."""
    field: Optional[str] = None
    message: str
    code: str
    value: Optional[Any] = None


class ApiErrorResponse(BaseModel):
    """Standardized error response format."""
    success: bool = False
    error: Dict[str, Any]
    timestamp: str
    request_id: Optional[str] = None

    @classmethod
    def create(
        cls,
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None
    ) -> "ApiErrorResponse":
        """Create a standardized error response."""
        return cls(
            error={
                "code": error_code,
                "message": message,
                "details": details or {}
            },
            timestamp=datetime.now(timezone.utc).isoformat(),
            request_id=request_id or str(uuid.uuid4())
        )


class ApiSuccessResponse(BaseModel):
    """Standardized success response format."""
    success: bool = True
    data: Any
    timestamp: str
    request_id: Optional[str] = None

    @classmethod
    def create(
        cls,
        data: Any,
        request_id: Optional[str] = None
    ) -> "ApiSuccessResponse":
        """Create a standardized success response."""
        return cls(
            data=data,
            timestamp=datetime.now(timezone.utc).isoformat(),
            request_id=request_id or str(uuid.uuid4())
        )


class PaginatedResponse(BaseModel):
    """Standardized paginated response format."""
    success: bool = True
    data: List[Any]
    pagination: Dict[str, Any]
    timestamp: str
    request_id: Optional[str] = None

    @classmethod
    def create(
        cls,
        data: List[Any],
        total_count: int,
        limit: int,
        offset: int,
        request_id: Optional[str] = None
    ) -> "PaginatedResponse":
        """Create a standardized paginated response."""
        return cls(
            data=data,
            pagination={
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(data) < total_count
            },
            timestamp=datetime.now(timezone.utc).isoformat(),
            request_id=request_id or str(uuid.uuid4())
        )


def success_response(data: Any, request_id: Optional[str] = None) -> Dict[str, Any]:
    """Create a success response dictionary."""
    response = ApiSuccessResponse.create(data, request_id)
    return response.model_dump()


def error_response(
    error_code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> Dict[str, Any]:
    """Create an error response dictionary."""
    response = ApiErrorResponse.create(error_code, message, details, request_id)
    return response.model_dump()


def paginated_response(
    data: List[Any],
    total_count: int,
    limit: int,
    offset: int,
    request_id: Optional[str] = None
) -> Dict[str, Any]:
    """Create a paginated response dictionary."""
    response = PaginatedResponse.create(data, total_count, limit, offset, request_id)
    return response.model_dump()


class AuthResponseData(BaseModel):
    """Canonical authentication response data structure."""
    user: Dict[str, Any]
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = False


class AuthResponse(ApiSuccessResponse):
    """Canonical authentication success response format."""
    data: AuthResponseData


def build_auth_response(
    user: Any,
    access_token: str,
    refresh_token: str,
    is_new_user: bool = False,
    request_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Build a canonical authentication response dictionary.
    
    Ensures all authentication endpoints (login, signup, refresh, oauth)
    return an identical, standardized response schema wrapped in ApiSuccessResponse.
    """
    # Normalize user object to dictionary
    if hasattr(user, "model_dump"):
        user_dict = user.model_dump()
    elif hasattr(user, "__table__"):
        user_dict = {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "display_name": getattr(user, "display_name", None),
            "profile_image_url": getattr(user, "profile_image_url", None),
            "oauth_provider": getattr(user, "oauth_provider", None),
            "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None
        }
    elif isinstance(user, dict):
        user_dict = user
    else:
        user_dict = dict(user)

    auth_data = {
        "user": user_dict,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new_user
    }
    return success_response(auth_data, request_id)