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
from app.core.security_config import security_config
from app.core.openapi_validator import create_openapi_validator
from app.core.exceptions import BaseAPIException
from app.core.responses import error_response
from fastapi.responses import JSONResponse
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # on startup
    logger.info("Starting up Grateful API...")
    await init_db()
    logger.info("Database initialized successfully")
    yield
    # on shutdown
    logger.info("Shutting down Grateful API...")

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

# Add middleware (order matters - first added is outermost)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(RateLimitingMiddleware, limiter=get_rate_limiter())
app.add_middleware(InputSanitizationMiddleware)  # Re-enabled with bypass
# app.add_middleware(APIContractValidationMiddleware, enable_response_validation=False)  # Disabled - causes request body consumption issue
app.add_middleware(RequestValidationMiddleware)

# Add CORS middleware with centralized configuration
cors_config = security_config.get_cors_config()
app.add_middleware(CORSMiddleware, **cors_config)

# Mount static files for uploads
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(posts_router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(reactions_router, prefix="/api/v1", tags=["reactions"])
app.include_router(likes_router, prefix="/api/v1", tags=["likes"])
app.include_router(notifications_router, prefix="/api/v1", tags=["notifications"])
app.include_router(follows_router, prefix="/api/v1", tags=["follows"])
app.include_router(algorithm_performance_router, prefix="/api/v1/algorithm", tags=["algorithm-performance"])
app.include_router(database_router, prefix="/api/v1/database", tags=["database"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Grateful API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "grateful-api"}


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