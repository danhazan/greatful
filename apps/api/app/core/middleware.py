"""
Middleware for request/response validation and error handling.
"""

import logging
import uuid
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.exceptions import BaseAPIException
from app.core.responses import error_response

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for standardized error handling."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and handle errors."""
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            return response
        except BaseAPIException as exc:
            # Handle custom API exceptions
            logger.warning(
                f"API Exception: {exc.error_code} - {exc.detail}",
                extra={"request_id": request_id, "details": exc.details}
            )
            return JSONResponse(
                status_code=exc.status_code,
                content=error_response(
                    error_code=exc.error_code,
                    message=exc.detail,
                    details=exc.details,
                    request_id=request_id
                )
            )
        except Exception as exc:
            # Handle unexpected exceptions
            logger.error(
                f"Unexpected error: {str(exc)}",
                extra={"request_id": request_id},
                exc_info=True
            )
            return JSONResponse(
                status_code=500,
                content=error_response(
                    error_code="internal_error",
                    message="An unexpected error occurred",
                    request_id=request_id
                )
            )


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Middleware for request validation and logging."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with validation and logging."""
        request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
        
        # Log incoming request
        logger.info(
            f"Incoming request: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params)
            }
        )

        response = await call_next(request)

        # Log response
        logger.info(
            f"Response: {response.status_code}",
            extra={
                "request_id": request_id,
                "status_code": response.status_code
            }
        )

        return response