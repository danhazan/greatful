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
from app.core.database import init_db
from app.core.middleware import ErrorHandlingMiddleware, RequestValidationMiddleware
import logging

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

# Create FastAPI app
app = FastAPI(
    title="Grateful API",
    description="Backend API for the Grateful social gratitude platform",
    version="1.0.0",
    lifespan=lifespan
)

# Add middleware (order matters - first added is outermost)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestValidationMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Grateful API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "grateful-api"}