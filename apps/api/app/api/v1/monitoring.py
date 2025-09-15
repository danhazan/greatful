"""
Monitoring dashboard API endpoints.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.posts import get_current_user_id
from app.core.monitoring_dashboard import monitoring_dashboard
from app.core.uptime_monitoring import uptime_monitor
from app.core.error_alerting import alert_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/monitoring/dashboard")
async def get_monitoring_dashboard(
    time_range_minutes: int = Query(60, ge=5, le=1440, description="Time range in minutes (5-1440)"),
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get comprehensive monitoring dashboard data.
    
    This endpoint provides a complete overview of system health, performance metrics,
    and alerts for monitoring dashboards.
    
    Args:
        time_range_minutes: Time range for historical data (5 minutes to 24 hours)
        
    Returns:
        Dict containing comprehensive monitoring data
    """
    try:
        # Collect current metrics
        current_metrics = await monitoring_dashboard.collect_metrics()
        
        # Get dashboard data with historical metrics
        dashboard_data = monitoring_dashboard.get_dashboard_data(time_range_minutes)
        
        # Get uptime statistics
        uptime_stats = uptime_monitor.get_uptime_stats(hours=time_range_minutes // 60 or 1)
        
        # Get active incidents
        active_incidents = uptime_monitor.get_active_incidents()
        
        # Get alert statistics
        alert_stats = alert_manager.get_alert_stats()
        
        # Get service statuses
        service_statuses = uptime_monitor.get_all_service_statuses()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "time_range_minutes": time_range_minutes,
            "overall_status": _determine_overall_status(current_metrics, active_incidents),
            "current_metrics": current_metrics,
            "dashboard_data": dashboard_data,
            "uptime_stats": uptime_stats,
            "service_statuses": {name: status.value for name, status in service_statuses.items()},
            "active_incidents": active_incidents,
            "alert_stats": alert_stats,
            "summary": {
                "services_monitored": len(service_statuses),
                "healthy_services": len([s for s in service_statuses.values() if s.value == "healthy"]),
                "active_incidents": len(active_incidents),
                "critical_alerts_24h": alert_stats.get("severity_breakdown", {}).get("critical", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get monitoring dashboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get monitoring dashboard: {str(e)}"
        )


@router.get("/monitoring/alerts")
async def get_alerts(
    hours: int = Query(24, ge=1, le=168, description="Hours of alert history (1-168)"),
    severity: Optional[str] = Query(None, pattern="^(info|warning|critical|emergency)$", description="Filter by severity"),
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get alert history and statistics.
    
    Args:
        hours: Hours of history to retrieve (1-168 hours)
        severity: Optional severity filter
        
    Returns:
        Dict containing alert data
    """
    try:
        # Get active alerts
        active_alerts = alert_manager.get_active_alerts()
        
        # Get alert history
        alert_history = alert_manager.get_alert_history(hours=hours)
        
        # Filter by severity if specified
        if severity:
            alert_history = [
                alert for alert in alert_history
                if alert.get("severity") == severity
            ]
            active_alerts = [
                alert for alert in active_alerts
                if alert.get("severity") == severity
            ]
        
        # Get alert statistics
        alert_stats = alert_manager.get_alert_stats()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "time_range_hours": hours,
            "severity_filter": severity,
            "active_alerts": active_alerts,
            "alert_history": alert_history,
            "statistics": alert_stats,
            "summary": {
                "active_count": len(active_alerts),
                "history_count": len(alert_history),
                "total_alerts_24h": alert_stats.get("alerts_last_24h", 0),
                "critical_alerts_24h": alert_stats.get("severity_breakdown", {}).get("critical", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get alerts: {str(e)}"
        )


@router.get("/monitoring/incidents")
async def get_incidents(
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get current incidents and incident history.
    
    Returns:
        Dict containing incident data
    """
    try:
        # Get active incidents
        active_incidents = uptime_monitor.get_active_incidents()
        
        # Get uptime statistics which includes incident information
        uptime_stats = uptime_monitor.get_uptime_stats(hours=24)
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "active_incidents": active_incidents,
            "uptime_stats": uptime_stats,
            "summary": {
                "active_incidents": len(active_incidents),
                "services_monitored": len(uptime_stats.get("services", {})),
                "services_healthy": len([
                    s for s in uptime_stats.get("services", {}).values()
                    if s.get("current_status") == "healthy"
                ])
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get incidents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get incidents: {str(e)}"
        )


@router.get("/monitoring/performance")
async def get_performance_metrics(
    time_range_minutes: int = Query(60, ge=5, le=1440, description="Time range in minutes"),
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get detailed performance metrics.
    
    Args:
        time_range_minutes: Time range for metrics
        
    Returns:
        Dict containing performance metrics
    """
    try:
        # Get current performance metrics
        current_metrics = await monitoring_dashboard.collect_metrics()
        
        # Get performance trends
        dashboard_data = monitoring_dashboard.get_dashboard_data(time_range_minutes)
        
        # Extract performance-specific data
        performance_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "time_range_minutes": time_range_minutes,
            "algorithm_performance": current_metrics.get("algorithm", {}),
            "database_performance": current_metrics.get("database", {}),
            "system_performance": current_metrics.get("system", {}),
            "metrics_trends": dashboard_data.get("metrics", {}),
            "performance_alerts": [
                alert for alert in dashboard_data.get("alerts", [])
                if "performance" in alert.get("message", "").lower()
            ]
        }
        
        return performance_data
        
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance metrics: {str(e)}"
        )


@router.post("/monitoring/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Manually resolve an alert.
    
    Args:
        alert_id: ID of the alert to resolve
        
    Returns:
        Dict containing resolution status
    """
    try:
        success = await alert_manager.resolve_alert(alert_id)
        
        if success:
            logger.info(
                f"Alert manually resolved: {alert_id} by user {current_user_id}",
                extra={
                    "event_type": "alert_manually_resolved",
                    "alert_id": alert_id,
                    "resolved_by_user": current_user_id
                }
            )
            
            return {
                "status": "success",
                "message": f"Alert {alert_id} resolved successfully",
                "resolved_by": current_user_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found or already resolved"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve alert {alert_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve alert: {str(e)}"
        )


@router.post("/monitoring/clear-metrics")
async def clear_monitoring_metrics(
    current_user_id: int = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Clear monitoring metrics and reset counters.
    
    This endpoint allows administrators to reset monitoring data.
    
    Returns:
        Dict containing clear status
    """
    try:
        # Clear monitoring dashboard metrics
        monitoring_dashboard.clear_alerts()
        
        # Clear algorithm performance metrics
        from app.core.algorithm_performance import algorithm_performance_monitor
        algorithm_performance_monitor.reset_metrics()
        
        logger.info(
            f"Monitoring metrics cleared by user {current_user_id}",
            extra={
                "event_type": "monitoring_metrics_cleared",
                "cleared_by_user": current_user_id
            }
        )
        
        return {
            "status": "success",
            "message": "Monitoring metrics cleared successfully",
            "cleared_by": current_user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to clear monitoring metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear monitoring metrics: {str(e)}"
        )


def _determine_overall_status(current_metrics: Dict[str, Any], active_incidents: list) -> str:
    """
    Determine overall system status based on metrics and incidents.
    
    Args:
        current_metrics: Current system metrics
        active_incidents: List of active incidents
        
    Returns:
        str: Overall status (healthy, degraded, unhealthy)
    """
    # Check for critical incidents
    critical_incidents = [
        incident for incident in active_incidents
        if incident.get("severity") == "critical"
    ]
    
    if critical_incidents:
        return "unhealthy"
    
    # Check for any incidents
    if active_incidents:
        return "degraded"
    
    # Check metrics status
    metrics_status = current_metrics.get("status", "healthy")
    if metrics_status in ["error", "degraded"]:
        return "degraded"
    
    return "healthy"