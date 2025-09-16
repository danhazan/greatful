"""
Main FastAPI application for Grateful backend.
"""

from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.v1.reactions import router as reactions_router
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.posts import router as posts_router
from app.api.v1.likes import router as likes_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.follows import router as follows_router
from app.api.v1.algorithm_performance import router as algorithm_performance_router
from app.api.v1.database import router as database_router
from app.api.v1.health import router as health_router
from app.api.v1.error_reporting import router as error_reporting_router
from app.api.v1.monitoring import router as monitoring_router
from app.core.database import init_db
from app.core.middleware import ErrorHandlingMiddleware, RequestValidationMiddleware
from app.core.validation_middleware import (
    APIContractValidationMiddleware, 
    SchemaValidationMiddleware, 
    TypeSafetyMiddleware
)
from app.core.rate_limiting import RateLimitingMiddleware, SecurityHeadersMiddleware, get_rate_limiter
from app.core.input_sanitization import InputSanitizationMiddleware
from app.core.request_size_middleware import RequestSizeLimitMiddleware
from app.core.request_id_middleware import RequestIDMiddleware
from app.core.security_config import security_config
from app.core.openapi_validator import create_openapi_validator
from app.core.exceptions import BaseAPIException
from app.core.responses import error_response
from app.core.structured_logging import setup_structured_logging
from app.core.uptime_monitoring import uptime_monitor
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
import logging
import os

# Setup structured logging
setup_structured_logging(
    service_name="grateful-api",
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    enable_json_format=os.getenv("ENVIRONMENT", "development") == "production"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # on startup
    logger.info("Starting up Grateful API...")
    await init_db()
    logger.info("Database initialized successfully")
    
    # Start uptime monitoring
    await uptime_monitor.start_monitoring()
    logger.info("Uptime monitoring started")
    
    yield
    
    # on shutdown
    logger.info("Shutting down Grateful API...")
    await uptime_monitor.stop_monitoring()
    logger.info("Uptime monitoring stopped")

# Create FastAPI app with security configurations
app = FastAPI(
    title="Grateful API",
    description="Backend API for the Grateful social gratitude platform",
    version="1.0.0",
    lifespan=lifespan,
    # Security configurations - disable docs in production
    docs_url="/docs" if security_config.enable_docs and not security_config.is_production else None,
    redoc_url="/redoc" if security_config.enable_docs and not security_config.is_production else None,
    openapi_url="/openapi.json" if security_config.enable_docs and not security_config.is_production else None,
)

# Add exception handlers
@app.exception_handler(BaseAPIException)
async def base_api_exception_handler(request, exc: BaseAPIException):
    """Handle custom API exceptions."""
    request_id = getattr(request.state, 'request_id', None)
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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """Handle validation errors with proper binary data handling."""
    request_id = getattr(request.state, 'request_id', None)
    
    # Safely encode validation errors, handling binary data
    safe_errors = []
    for error in exc.errors():
        safe_error = {}
        for key, value in error.items():
            if key == 'input' and isinstance(value, bytes):
                # Handle binary data in input field
                safe_error[key] = f"<binary data: {len(value)} bytes>"
            elif isinstance(value, bytes):
                # Handle any other binary fields
                safe_error[key] = f"<binary data: {len(value)} bytes>"
            else:
                try:
                    # Try to encode normally - test if it's JSON serializable
                    import json
                    json.dumps(value)
                    safe_error[key] = value
                except (UnicodeDecodeError, TypeError, ValueError):
                    # Fallback for any encoding issues
                    safe_error[key] = str(value)
        safe_errors.append(safe_error)
    
    logger.warning(
        f"Validation error: {len(safe_errors)} validation errors",
        extra={"request_id": request_id, "errors": safe_errors}
    )
    
    # Return in FastAPI's expected format for validation errors
    return JSONResponse(
        status_code=422,
        content={"detail": safe_errors}
    )

# Add middleware (order matters - first added is outermost)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(RateLimitingMiddleware, limiter=get_rate_limiter())
app.add_middleware(InputSanitizationMiddleware)  # Re-enabled with bypass
# app.add_middleware(APIContractValidationMiddleware, enable_response_validation=False)  # Disabled - causes request body consumption issue
app.add_middleware(RequestValidationMiddleware)
app.add_middleware(RequestIDMiddleware)  # Add request ID tracking

# Add CORS middleware with centralized configuration
cors_config = security_config.get_cors_config()
app.add_middleware(CORSMiddleware, **cors_config)

# Mount static files for uploads
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers with security considerations
# Health checks - basic health for load balancers, detailed health requires auth
app.include_router(health_router, tags=["health"])
# Error reporting - public for frontend error tracking (with rate limiting)
app.include_router(error_reporting_router, prefix="/api", tags=["error-reporting"])
# Monitoring - requires authentication and admin privileges
app.include_router(monitoring_router, prefix="/api/v1", tags=["monitoring"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(posts_router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(reactions_router, prefix="/api/v1", tags=["reactions"])
app.include_router(likes_router, prefix="/api/v1", tags=["likes"])
app.include_router(notifications_router, prefix="/api/v1", tags=["notifications"])
app.include_router(follows_router, prefix="/api/v1", tags=["follows"])
app.include_router(algorithm_performance_router, prefix="/api/v1/algorithm", tags=["algorithm-performance"])
app.include_router(database_router, prefix="/api/v1/database", tags=["database"])

# Include test auth router only when load testing is enabled
if os.getenv("LOAD_TESTING", "").lower() == "true":
    from app.api.v1.test_auth import router as test_auth_router
    app.include_router(test_auth_router, prefix="/api/v1", tags=["test-auth"])
    logger.info("Test authentication endpoints enabled for load testing")


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Grateful API is running"}

# Remove the basic health check as it's now handled by the health router


def custom_openapi():
    """Generate custom OpenAPI schema with enhanced validation."""
    if app.openapi_schema:
        return app.openapi_schema
    
    # Create OpenAPI validator and generate enhanced schema
    openapi_validator = create_openapi_validator(app)
    enhanced_schema = openapi_validator.generate_enhanced_schema()
    
    app.openapi_schema = enhanced_schema
    return app.openapi_schema


# Override the default OpenAPI schema generation
app.openapi = custom_openapi