"""
Request ID middleware for tracking requests across the application.
"""

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.structured_logging import (
    generate_request_id, 
    set_request_id, 
    request_logger,
    get_request_id
)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds a unique request ID to each request and logs request/response.
    """
    
    def __init__(self, app, header_name: str = "X-Request-ID"):
        super().__init__(app)
        self.header_name = header_name
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with request ID tracking and logging."""
        
        # Generate or extract request ID
        request_id = request.headers.get(self.header_name)
        if not request_id:
            request_id = generate_request_id()
        
        # Set request ID in context and request state
        set_request_id(request_id)
        request.state.request_id = request_id
        
        # Extract client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent")
        
        # Get user ID if available (will be set by auth middleware)
        user_id = getattr(request.state, 'user_id', None)
        
        # Log request start
        start_time = time.time()
        request_logger.log_request_start(
            method=request.method,
            path=str(request.url.path),
            request_id=request_id,
            client_ip=client_ip,
            user_agent=user_agent,
            user_id=user_id
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000
            
            # Add request ID to response headers
            response.headers[self.header_name] = request_id
            
            # Log request completion
            request_logger.log_request_end(
                method=request.method,
                path=str(request.url.path),
                request_id=request_id,
                status_code=response.status_code,
                response_time_ms=response_time_ms,
                user_id=user_id
            )
            
            return response
            
        except Exception as e:
            # Calculate response time for failed requests
            response_time_ms = (time.time() - start_time) * 1000
            
            # Log request failure
            request_logger.log_request_end(
                method=request.method,
                path=str(request.url.path),
                request_id=request_id,
                status_code=500,
                response_time_ms=response_time_ms,
                user_id=user_id,
                error=str(e)
            )
            
            # Re-raise the exception
            raise
    
    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address from request headers.
        
        Checks for common proxy headers in order of preference.
        """
        # Check for forwarded headers (common in load balancers/proxies)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first one
            return forwarded_for.split(",")[0].strip()
        
        # Check for real IP header (common in some proxies)
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        # Check for Cloudflare connecting IP
        cf_connecting_ip = request.headers.get("cf-connecting-ip")
        if cf_connecting_ip:
            return cf_connecting_ip.strip()
        
        # Fall back to direct client IP
        if request.client:
            return request.client.host
        
        return "unknown"