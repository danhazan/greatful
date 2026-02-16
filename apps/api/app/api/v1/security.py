"""
Security monitoring and configuration API endpoints.

This module provides endpoints for:
- Security configuration validation
- Security monitoring dashboard
- Security alerts and incidents
- Security metrics and analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.core.dependencies import get_current_user
from app.core.responses import success_response
from app.models.user import User
from app.core.production_security import (
    ProductionSecurityManager,
    SecurityConfigurationValidator
)
from app.core.security_monitoring import security_monitor, SecurityAlert, ThreatLevel
from app.core.security_audit import SecurityAuditor, SecurityEventType
from app.models.user import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/config/validate")
async def validate_security_config(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Validate current security configuration.
    
    Requires authentication. Returns comprehensive security configuration validation.
    """
    try:
        # Log security configuration access
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.CONFIGURATION_CHANGE,
            request=request,
            user_id=current_user.id,
            username=current_user.username,
            details={"action": "validate_config"},
            severity="INFO",
            success=True
        )
        
        # Validate configuration
        validation_result = ProductionSecurityManager.validate_production_security()
        
        response_data = {
            "validation_timestamp": datetime.now(timezone.utc).isoformat(),
            "is_valid": validation_result.is_valid,
            "security_status": "SECURE" if validation_result.is_valid else "ISSUES_DETECTED",
            "issues": validation_result.issues,
            "warnings": validation_result.warnings,
            "recommendations": validation_result.recommendations,
            "summary": {
                "total_issues": len(validation_result.issues),
                "total_warnings": len(validation_result.warnings),
                "total_recommendations": len(validation_result.recommendations)
            }
        }
        
        return success_response(
            data=response_data,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Security configuration validation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to validate security configuration"
        ) from e


@router.get("/status")
async def get_security_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive security status report.
    
    Requires authentication. Returns detailed security status including
    configuration validation, monitoring metrics, and active alerts.
    """
    try:
        # Log security status access
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.SENSITIVE_DATA_ACCESS,
            request=request,
            user_id=current_user.id,
            username=current_user.username,
            details={"resource": "security_status"},
            severity="INFO",
            success=True
        )
        
        # Get comprehensive security status
        status_report = SecurityConfigurationValidator.get_security_status_report()
        dashboard_data = security_monitor.get_security_dashboard_data()
        
        response_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "overall_status": status_report["security_status"],
            "configuration": status_report,
            "monitoring": dashboard_data,
            "summary": {
                "configuration_valid": status_report["validation_result"]["is_valid"],
                "active_alerts": dashboard_data["active_alerts"]["total"],
                "monitoring_active": dashboard_data["monitoring_status"] == "active",
                "threat_level": _calculate_overall_threat_level(dashboard_data)
            }
        }
        
        return success_response(
            data=response_data,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to get security status: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve security status"
        ) from e


@router.get("/alerts")
async def get_security_alerts(
    request: Request,
    hours: int = 24,
    threat_level: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """
    Get security alerts with filtering options.
    
    Args:
        hours: Number of hours to look back (default: 24)
        threat_level: Filter by threat level (low, medium, high, critical)
        limit: Maximum number of alerts to return (default: 100)
    """
    try:
        # Validate threat level parameter
        if threat_level and threat_level not in ["low", "medium", "high", "critical"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid threat_level. Must be one of: low, medium, high, critical"
            )
        
        # Log security alerts access
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.SENSITIVE_DATA_ACCESS,
            request=request,
            user_id=current_user.id,
            username=current_user.username,
            details={
                "resource": "security_alerts",
                "hours": hours,
                "threat_level": threat_level,
                "limit": limit
            },
            severity="INFO",
            success=True
        )
        
        # Get alerts
        active_alerts = security_monitor.get_active_alerts(hours=hours)
        
        # Filter by threat level if specified
        if threat_level:
            active_alerts = [
                alert for alert in active_alerts
                if alert.get("threat_level") == threat_level
            ]
        
        # Apply limit
        active_alerts = active_alerts[:limit]
        
        # Calculate statistics
        threat_level_counts = {}
        for level in ["low", "medium", "high", "critical"]:
            threat_level_counts[level] = sum(
                1 for alert in active_alerts
                if alert.get("threat_level") == level
            )
        
        response_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "time_period_hours": hours,
            "total_alerts": len(active_alerts),
            "alerts": active_alerts,
            "statistics": {
                "by_threat_level": threat_level_counts,
                "most_common_types": _get_most_common_alert_types(active_alerts),
                "top_source_ips": _get_top_source_ips(active_alerts)
            }
        }
        
        return success_response(
            data=response_data,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get security alerts: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve security alerts"
        ) from e


@router.get("/metrics")
async def get_security_metrics(
    request: Request,
    hours: int = 24,
    current_user: User = Depends(get_current_user)
):
    """
    Get security metrics and analytics.
    
    Args:
        hours: Number of hours to analyze (default: 24)
    """
    try:
        # Log security metrics access
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.SENSITIVE_DATA_ACCESS,
            request=request,
            user_id=current_user.id,
            username=current_user.username,
            details={
                "resource": "security_metrics",
                "hours": hours
            },
            severity="INFO",
            success=True
        )
        
        # Get metrics
        metrics_summary = security_monitor.metrics.get_metrics_summary(hours=hours)
        
        # Add additional analytics
        response_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "time_period_hours": hours,
            "metrics": metrics_summary,
            "analytics": {
                "security_score": _calculate_security_score(metrics_summary),
                "trend_analysis": _analyze_security_trends(metrics_summary),
                "risk_assessment": _assess_security_risk(metrics_summary)
            }
        }
        
        return success_response(
            data=response_data,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to get security metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve security metrics"
        ) from e


@router.post("/test-alert")
async def create_test_security_alert(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Create a test security alert for testing monitoring systems.
    
    This endpoint is useful for testing alert handlers and notification systems.
    """
    try:
        # Log test alert creation
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.CONFIGURATION_CHANGE,
            request=request,
            user_id=current_user.id,
            username=current_user.username,
            details={"action": "create_test_alert"},
            severity="INFO",
            success=True
        )
        
        # Create a test alert
        import uuid
        from app.core.security_monitoring import SecurityAlert
        
        test_alert = SecurityAlert(
            alert_id=str(uuid.uuid4()),
            threat_level=ThreatLevel.LOW,
            event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
            title="Test Security Alert",
            description="This is a test security alert created for system testing",
            timestamp=datetime.now(timezone.utc),
            source_ip=request.client.host if request.client else "test",
            user_id=current_user.id,
            username=current_user.username,
            endpoint=request.url.path,
            details={"test": True, "created_by": current_user.username},
            recommended_actions=["This is a test alert - no action required"]
        )
        
        # Process the test alert
        security_monitor._handle_alert(test_alert)
        
        response_data = {
            "message": "Test security alert created successfully",
            "alert": test_alert.to_dict()
        }
        
        return success_response(
            data=response_data,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to create test alert: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create test security alert"
        ) from e


@router.get("/monitoring/config")
async def get_monitoring_config(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get security monitoring configuration.
    
    Returns the current security monitoring configuration including
    threat detection rules and alert thresholds.
    """
    try:
        # Log monitoring config access
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.SENSITIVE_DATA_ACCESS,
            request=request,
            user_id=current_user.id,
            username=current_user.username,
            details={"resource": "monitoring_config"},
            severity="INFO",
            success=True
        )
        
        # Get monitoring configuration
        monitoring_config = ProductionSecurityManager.get_security_monitoring_config()
        
        # Add current monitoring status
        response_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "monitoring_enabled": security_monitor.monitoring_enabled,
            "configuration": monitoring_config,
            "threat_detection_rules": {
                name: {
                    "description": rule["description"],
                    "threshold": rule["threshold"],
                    "time_window_minutes": rule["time_window_minutes"],
                    "threat_level": rule["threat_level"].value
                }
                for name, rule in security_monitor.threat_detection_rules.items()
            },
            "alert_handlers": len(security_monitor.alert_handlers)
        }
        
        return success_response(
            data=response_data,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(f"Failed to get monitoring config: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve monitoring configuration"
        ) from e


# Helper functions
def _calculate_overall_threat_level(dashboard_data: Dict[str, Any]) -> str:
    """Calculate overall threat level based on active alerts."""
    alerts_by_level = dashboard_data["active_alerts"]["by_threat_level"]
    
    if alerts_by_level.get("critical", 0) > 0:
        return "critical"
    elif alerts_by_level.get("high", 0) > 0:
        return "high"
    elif alerts_by_level.get("medium", 0) > 0:
        return "medium"
    elif alerts_by_level.get("low", 0) > 0:
        return "low"
    else:
        return "normal"


def _get_most_common_alert_types(alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Get most common alert types from alerts list."""
    type_counts = {}
    for alert in alerts:
        event_type = alert.get("event_type", "unknown")
        type_counts[event_type] = type_counts.get(event_type, 0) + 1
    
    # Sort by count and return top 5
    sorted_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"type": t[0], "count": t[1]} for t in sorted_types[:5]]


def _get_top_source_ips(alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Get top source IPs from alerts list."""
    ip_counts = {}
    for alert in alerts:
        source_ip = alert.get("source_ip", "unknown")
        ip_counts[source_ip] = ip_counts.get(source_ip, 0) + 1
    
    # Sort by count and return top 5
    sorted_ips = sorted(ip_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"ip": ip[0], "count": ip[1]} for ip in sorted_ips[:5]]


def _calculate_security_score(metrics: Dict[str, Any]) -> int:
    """Calculate a security score based on metrics (0-100)."""
    base_score = 100
    
    # Deduct points for security events
    total_events = metrics.get("total_events", 0)
    if total_events > 0:
        # Deduct more points for critical events
        critical_events = metrics.get("recent_events", {}).get("events_critical", 0)
        error_events = metrics.get("recent_events", {}).get("events_error", 0)
        warning_events = metrics.get("recent_events", {}).get("events_warning", 0)
        
        base_score -= (critical_events * 10)  # 10 points per critical event
        base_score -= (error_events * 5)      # 5 points per error event
        base_score -= (warning_events * 2)    # 2 points per warning event
    
    # Deduct points for active alerts
    total_alerts = metrics.get("total_alerts", 0)
    if total_alerts > 0:
        critical_alerts = metrics.get("recent_alerts", {}).get("critical", 0)
        high_alerts = metrics.get("recent_alerts", {}).get("high", 0)
        medium_alerts = metrics.get("recent_alerts", {}).get("medium", 0)
        
        base_score -= (critical_alerts * 15)  # 15 points per critical alert
        base_score -= (high_alerts * 10)      # 10 points per high alert
        base_score -= (medium_alerts * 5)     # 5 points per medium alert
    
    return max(0, min(100, base_score))


def _analyze_security_trends(metrics: Dict[str, Any]) -> Dict[str, str]:
    """Analyze security trends from metrics."""
    # This is a simplified trend analysis
    # In a real implementation, this would compare with historical data
    
    total_events = metrics.get("total_events", 0)
    total_alerts = metrics.get("total_alerts", 0)
    
    trends = {}
    
    if total_events == 0:
        trends["events"] = "stable"
    elif total_events < 10:
        trends["events"] = "low_activity"
    elif total_events < 50:
        trends["events"] = "normal_activity"
    else:
        trends["events"] = "high_activity"
    
    if total_alerts == 0:
        trends["alerts"] = "no_alerts"
    elif total_alerts < 5:
        trends["alerts"] = "few_alerts"
    else:
        trends["alerts"] = "multiple_alerts"
    
    return trends


def _assess_security_risk(metrics: Dict[str, Any]) -> str:
    """Assess overall security risk level."""
    security_score = _calculate_security_score(metrics)
    
    if security_score >= 90:
        return "low"
    elif security_score >= 70:
        return "medium"
    elif security_score >= 50:
        return "high"
    else:
        return "critical"