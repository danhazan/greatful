"""
Main FastAPI application for Grateful backend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.reactions import router as reactions_router
from app.api.v1.auth import router as auth_router
from app.core.database import init_db
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Grateful API",
    description="Backend API for the Grateful social gratitude platform",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(reactions_router, prefix="/api/v1", tags=["reactions"])

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    logger.info("Starting up Grateful API...")
    await init_db()
    logger.info("Database initialized successfully")

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Grateful API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "grateful-api"}