"""
Comprehensive health check and monitoring endpoints for production monitoring.
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db, get_db_health, get_db_stats
from app.core.performance_utils import run_performance_diagnostics
from app.core.monitoring_security import check_basic_health_access, check_monitoring_access

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Basic health check endpoint for load balancers and monitoring systems.
    
    Returns:
        Dict containing basic health status
    """
    return {
        "status": "healthy",
        "service": "grateful-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }


@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Readiness check endpoint that verifies all dependencies are available.
    
    This endpoint should be used by Kubernetes readiness probes.
    
    Returns:
        Dict containing readiness status and dependency checks
    """
    start_time = time.time()
    checks = {}
    overall_status = "ready"
    
    # Database connectivity check
    try:
        db_health = await get_db_health()
        checks["database"] = {
            "status": db_health["status"],
            "details": db_health
        }
        if db_health["status"] != "healthy":
            overall_status = "not_ready"
    except Exception as e:
        logger.error(f"Database readiness check failed: {e}")
        checks["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_status = "not_ready"
    
    # File system check (uploads directory)
    try:
        import os
        uploads_dir = os.getenv("UPLOAD_PATH", "uploads")
        if os.path.exists(uploads_dir) and os.access(uploads_dir, os.W_OK):
            checks["filesystem"] = {
                "status": "healthy",
                "uploads_writable": True
            }
        else:
            checks["filesystem"] = {
                "status": "unhealthy",
                "uploads_writable": False
            }
            overall_status = "not_ready"
    except Exception as e:
        logger.error(f"Filesystem readiness check failed: {e}")
        checks["filesystem"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_status = "not_ready"
    
    response_time_ms = (time.time() - start_time) * 1000
    
    response = {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "response_time_ms": response_time_ms,
        "checks": checks
    }
    
    # Return appropriate HTTP status code
    if overall_status == "not_ready":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=response
        )
    elif overall_status == "degraded":
        # Still return 200 but indicate degraded performance
        response["warning"] = "Service is running but performance may be degraded"
    
    return response


@router.get("/metrics")
async def metrics_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
    include_detailed: bool = Query(False, description="Include detailed performance metrics")
) -> Dict[str, Any]:
    """
    Comprehensive metrics endpoint for monitoring systems.
    
    This endpoint provides detailed metrics for external monitoring systems
    like Prometheus, Datadog, or New Relic.
    
    **Security**: Requires monitoring token and IP whitelist access.
    
    Args:
        include_detailed: Whether to include detailed performance diagnostics
        
    Returns:
        Dict containing comprehensive system metrics
    """
    # Check monitoring access permissions
    check_monitoring_access(request)
    
    start_time = time.time()
    
    try:
        # Basic system metrics
        metrics = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "grateful-api",
            "version": "1.0.0"
        }
        
        # Database metrics
        db_health = await get_db_health()
        db_stats = await get_db_stats()
        
        metrics["database"] = {
            "status": db_health["status"],
            "connection_pool": db_health.get("pool", {}),
            "connections": db_stats.get("connections", {}),
            "database_size": db_stats.get("database_size", "unknown")
        }
        
        # System resource metrics (basic)
        try:
            import psutil
            metrics["system"] = {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage_percent": psutil.disk_usage('/').percent
            }
        except ImportError:
            metrics["system"] = {
                "note": "psutil not available - install for system metrics"
            }
        
        # Include detailed diagnostics if requested
        if include_detailed:
            try:
                detailed_diagnostics = await run_performance_diagnostics(db)
                metrics["detailed_diagnostics"] = detailed_diagnostics
            except Exception as e:
                logger.error(f"Failed to get detailed diagnostics: {e}")
                metrics["detailed_diagnostics"] = {"error": str(e)}
        
        # Response time for this endpoint
        metrics["response_time_ms"] = (time.time() - start_time) * 1000
        
        return metrics
        
    except Exception as e:
        logger.error(f"Failed to generate metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate metrics: {str(e)}"
        ) from e


@router.get("/health/database")
async def database_health_check(
    db: AsyncSession = Depends(get_db),
    include_stats: bool = Query(False, description="Include detailed database statistics")
) -> Dict[str, Any]:
    """
    Detailed database health check endpoint.
    
    Args:
        include_stats: Whether to include detailed database statistics
        
    Returns:
        Dict containing database health information
    """
    try:
        # Basic health check
        health_info = await get_db_health()
        
        if include_stats:
            # Add detailed statistics
            stats = await get_db_stats()
            health_info["statistics"] = stats
        
        # Add timestamp
        health_info["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        return health_info
        
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}"
        ) from e


@router.get("/health/detailed")
async def detailed_health_check(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Comprehensive health check with all system components.
    
    This endpoint provides a complete system health overview for monitoring dashboards.
    
    **Security**: Requires monitoring access permissions.
    
    Returns:
        Dict containing detailed health information for all components
    """
    # Check monitoring access permissions
    check_monitoring_access(request)
    
    start_time = time.time()
    
    try:
        # Run all health checks in parallel
        db_health_task = asyncio.create_task(get_db_health())
        db_stats_task = asyncio.create_task(get_db_stats())
        
        # Wait for database checks
        db_health, db_stats = await asyncio.gather(db_health_task, db_stats_task)
        
        # System checks
        system_info = {}
        try:
            import psutil
            system_info = {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory": {
                    "percent": psutil.virtual_memory().percent,
                    "available_gb": psutil.virtual_memory().available / (1024**3)
                },
                "disk": {
                    "percent": psutil.disk_usage('/').percent,
                    "free_gb": psutil.disk_usage('/').free / (1024**3)
                }
            }
        except ImportError:
            system_info = {"note": "psutil not available"}
        
        # Determine overall health
        overall_status = "healthy"
        issues = []
        
        if db_health["status"] != "healthy":
            overall_status = "unhealthy"
            issues.append("Database connectivity issues")
        
        # Check system resources
        if system_info.get("cpu_percent", 0) > 80:
            if overall_status == "healthy":
                overall_status = "degraded"
            issues.append("High CPU usage")
        
        if system_info.get("memory", {}).get("percent", 0) > 85:
            if overall_status == "healthy":
                overall_status = "degraded"
            issues.append("High memory usage")
        
        response = {
            "status": overall_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "response_time_ms": (time.time() - start_time) * 1000,
            "issues": issues,
            "components": {
                "database": {
                    "status": db_health["status"],
                    "connection_pool": db_health.get("pool", {}),
                    "connections": db_stats.get("connections", {}),
                    "size": db_stats.get("database_size", "unknown")
                },
                "system": system_info
            }
        }
        
        # Return appropriate status code
        if overall_status == "unhealthy":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=response
            )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detailed health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        ) from e


