"""
Algorithm Performance Monitoring API endpoints.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.posts import get_current_user_id
from app.core.algorithm_performance import (
    get_algorithm_performance_report,
    algorithm_performance_monitor,
    algorithm_cache_manager
)
from app.core.performance_utils import run_performance_diagnostics
from app.services.batch_preference_service import BatchPreferenceService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/performance/report")
async def get_performance_report(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get comprehensive algorithm performance report.
    
    Returns performance metrics, cache statistics, and optimization recommendations.
    """
    try:
        # Get algorithm performance report
        performance_report = get_algorithm_performance_report()
        
        # Get database performance diagnostics
        db_diagnostics = await run_performance_diagnostics(db)
        
        # Get batch processing stats
        batch_service = BatchPreferenceService(db)
        batch_stats = await batch_service.get_batch_processing_stats()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "algorithm_performance": performance_report,
            "database_diagnostics": db_diagnostics,
            "batch_processing": batch_stats,
            "status": "healthy" if _is_performance_healthy(performance_report.get("performance_metrics", {})) else "degraded"
        }
        
    except Exception as e:
        logger.error(f"Failed to generate performance report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate performance report: {str(e)}"
        )


@router.get("/performance/metrics")
async def get_performance_metrics(
    current_user_id: int = Depends(get_current_user_id),
    operation_name: Optional[str] = Query(None, description="Filter by specific operation name")
) -> Dict[str, Any]:
    """
    Get detailed performance metrics for algorithm operations.
    
    Args:
        operation_name: Optional filter for specific operation
    """
    try:
        report = algorithm_performance_monitor.get_performance_report()
        
        if operation_name:
            # Filter for specific operation
            if operation_name in report["operations"]:
                return {
                    "operation_name": operation_name,
                    "metrics": report["operations"][operation_name],
                    "target_time_ms": report["target_time_ms"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Operation '{operation_name}' not found in metrics"
                )
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance metrics: {str(e)}"
        )


@router.get("/performance/cache-stats")
async def get_cache_statistics(
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Get algorithm cache performance statistics."""
    try:
        cache_stats = algorithm_cache_manager.get_cache_stats()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cache_statistics": cache_stats,
            "total_caches": len(cache_stats),
            "overall_hit_rate": _calculate_overall_hit_rate(cache_stats)
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get cache statistics: {str(e)}"
        )


@router.post("/performance/clear-cache")
async def clear_algorithm_cache(
    current_user_id: int = Depends(get_current_user_id),
    cache_name: Optional[str] = Query(None, description="Specific cache to clear (optional)")
) -> Dict[str, Any]:
    """
    Clear algorithm caches to force fresh data loading.
    
    Args:
        cache_name: Optional specific cache to clear. If not provided, clears all caches.
    """
    try:
        if cache_name:
            algorithm_cache_manager.invalidate(cache_name)
            message = f"Cache '{cache_name}' cleared successfully"
        else:
            algorithm_cache_manager.clear_all_caches()
            message = "All algorithm caches cleared successfully"
        
        logger.info(f"Cache cleared by user {current_user_id}: {message}")
        
        return {
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cleared_by_user": current_user_id
        }
        
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cache: {str(e)}"
        )


@router.post("/performance/reset-metrics")
async def reset_performance_metrics(
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Reset algorithm performance metrics."""
    try:
        algorithm_performance_monitor.reset_metrics()
        
        logger.info(f"Performance metrics reset by user {current_user_id}")
        
        return {
            "message": "Performance metrics reset successfully",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reset_by_user": current_user_id
        }
        
    except Exception as e:
        logger.error(f"Failed to reset performance metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset performance metrics: {str(e)}"
        )


@router.get("/performance/health")
async def get_algorithm_health(
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get algorithm health status and performance indicators.
    
    Returns a simple health check focused on meeting the <300ms target.
    """
    try:
        report = algorithm_performance_monitor.get_performance_report()
        cache_stats = algorithm_cache_manager.get_cache_stats()
        
        # Check if performance targets are being met
        is_healthy = _is_performance_healthy(report)
        
        # Calculate key metrics
        total_operations = report["summary"]["total_operations"]
        avg_time = report["summary"]["average_query_time"]
        slow_percentage = report["summary"]["slow_queries_percentage"]
        
        # Determine health status
        if is_healthy:
            status_level = "healthy"
        elif avg_time < 500:  # Still acceptable but not optimal
            status_level = "warning"
        else:
            status_level = "critical"
        
        return {
            "status": status_level,
            "target_time_ms": 300,
            "average_time_ms": avg_time,
            "slow_operations_percentage": slow_percentage,
            "total_operations": total_operations,
            "cache_hit_rate": _calculate_overall_hit_rate(cache_stats),
            "recommendations": report["recommendations"][:3],  # Top 3 recommendations
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get algorithm health: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def _is_performance_healthy(report: Dict[str, Any]) -> bool:
    """
    Determine if algorithm performance is healthy based on metrics.
    
    Args:
        report: Performance report from algorithm monitor
        
    Returns:
        bool: True if performance is healthy (meeting <300ms target)
    """
    # Handle nested performance_metrics structure
    if "performance_metrics" in report:
        report = report["performance_metrics"]
    
    summary = report.get("summary", {})
    
    # Check average query time (convert to ms if needed)
    avg_time = summary.get("average_query_time", 0)
    if avg_time > 0.3:  # Convert seconds to ms comparison
        avg_time *= 1000
    if avg_time > 300:  # Exceeds 300ms target
        return False
    
    # Check slow query percentage
    slow_percentage = summary.get("slow_queries_percentage", 0)
    if slow_percentage > 20:  # More than 20% slow queries
        return False
    
    # Check for critical operations
    operations = report.get("operations", {})
    for op_name, op_data in operations.items():
        if "feed" in op_name.lower():  # Focus on feed operations
            if op_data.get("avg_time_ms", 0) > 300:
                return False
    
    return True


def _calculate_overall_hit_rate(cache_stats: Dict[str, Any]) -> float:
    """
    Calculate overall cache hit rate across all caches.
    
    Args:
        cache_stats: Cache statistics from cache manager
        
    Returns:
        float: Overall hit rate percentage
    """
    total_hits = 0
    total_requests = 0
    
    for cache_name, stats in cache_stats.items():
        hits = stats.get("hits", 0)
        misses = stats.get("misses", 0)
        total_hits += hits
        total_requests += hits + misses
    
    if total_requests == 0:
        return 0.0
    
    return (total_hits / total_requests) * 100