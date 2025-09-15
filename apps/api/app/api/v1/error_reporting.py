"""
Error reporting API endpoints for frontend error tracking.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.core.structured_logging import performance_logger
from app.core.error_alerting import alert_manager, AlertType, AlertSeverity

logger = logging.getLogger(__name__)
router = APIRouter()


class ErrorReport(BaseModel):
    """Frontend error report model."""
    id: str
    timestamp: str
    type: str = Field(..., pattern="^(javascript|api|network|component)$")
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    message: str = Field(..., max_length=1000)
    stack: Optional[str] = Field(None, max_length=5000)
    url: str = Field(..., max_length=500)
    userAgent: str = Field(..., max_length=500)
    userId: Optional[str] = None
    sessionId: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ErrorReportBatch(BaseModel):
    """Batch of error reports from frontend."""
    errors: List[ErrorReport] = Field(..., max_length=50)
    sessionId: str
    userId: Optional[str] = None
    timestamp: str
    userAgent: str
    url: str


@router.post("/errors/report")
async def report_errors(
    error_batch: ErrorReportBatch,
    request: Request
) -> Dict[str, Any]:
    """
    Receive and process frontend error reports.
    
    This endpoint receives batched error reports from the frontend error tracking system
    and processes them for monitoring and alerting.
    """
    try:
        client_ip = _get_client_ip(request)
        request_id = getattr(request.state, 'request_id', None)
        
        # Process each error in the batch
        processed_errors = []
        critical_errors = []
        
        for error_report in error_batch.errors:
            # Log the error
            log_level = _get_log_level(error_report.severity)
            
            logger.log(
                log_level,
                f"Frontend {error_report.type} error: {error_report.message}",
                extra={
                    "event_type": "frontend_error",
                    "error_id": error_report.id,
                    "error_type": error_report.type,
                    "error_severity": error_report.severity,
                    "session_id": error_report.sessionId,
                    "user_id": error_report.userId,
                    "client_ip": client_ip,
                    "request_id": request_id,
                    "error_url": error_report.url,
                    "user_agent": error_report.userAgent,
                    "error_metadata": error_report.metadata
                }
            )
            
            # Check for critical errors that need immediate attention
            if error_report.severity == "critical":
                critical_errors.append(error_report)
            
            # Track API errors for monitoring
            if error_report.type == "api":
                _track_api_error(error_report, client_ip, request_id)
            
            # Track JavaScript errors for patterns
            if error_report.type == "javascript":
                _track_javascript_error(error_report, client_ip, request_id)
            
            processed_errors.append({
                "id": error_report.id,
                "processed": True,
                "severity": error_report.severity
            })
        
        # Send alerts for critical errors
        if critical_errors:
            await _send_critical_error_alerts(critical_errors, client_ip, request_id)
        
        # Log batch processing summary
        logger.info(
            f"Processed {len(error_batch.errors)} frontend errors "
            f"({len(critical_errors)} critical) from session {error_batch.sessionId}",
            extra={
                "event_type": "frontend_error_batch_processed",
                "session_id": error_batch.sessionId,
                "user_id": error_batch.userId,
                "total_errors": len(error_batch.errors),
                "critical_errors": len(critical_errors),
                "client_ip": client_ip,
                "request_id": request_id
            }
        )
        
        return {
            "status": "success",
            "processed_count": len(processed_errors),
            "critical_count": len(critical_errors),
            "errors": processed_errors
        }
        
    except Exception as e:
        logger.error(
            f"Failed to process frontend error reports: {e}",
            extra={
                "event_type": "frontend_error_processing_failed",
                "error": str(e),
                "request_id": getattr(request.state, 'request_id', None)
            },
            exc_info=True
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process error reports"
        )


@router.get("/errors/stats")
async def get_error_stats(request: Request) -> Dict[str, Any]:
    """
    Get frontend error statistics for monitoring dashboard.
    
    This endpoint provides aggregated error statistics for monitoring purposes.
    """
    try:
        # This would typically query a database or cache for error statistics
        # For now, return basic stats structure
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "stats": {
                "total_errors_24h": 0,  # Would be calculated from stored data
                "critical_errors_24h": 0,
                "error_rate_per_hour": 0.0,
                "top_error_types": [],
                "top_error_messages": [],
                "affected_users": 0,
                "error_trends": {
                    "javascript": 0,
                    "api": 0,
                    "network": 0,
                    "component": 0
                }
            },
            "note": "Error statistics would be calculated from stored error data in production"
        }
        
    except Exception as e:
        logger.error(f"Failed to get error statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get error statistics"
        )


def _get_client_ip(request: Request) -> str:
    """Extract client IP address from request."""
    # Check for forwarded headers
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    
    cf_connecting_ip = request.headers.get("cf-connecting-ip")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()
    
    if request.client:
        return request.client.host
    
    return "unknown"


def _get_log_level(severity: str) -> int:
    """Convert error severity to log level."""
    severity_map = {
        "low": logging.INFO,
        "medium": logging.WARNING,
        "high": logging.ERROR,
        "critical": logging.CRITICAL
    }
    return severity_map.get(severity, logging.INFO)


def _track_api_error(error_report: ErrorReport, client_ip: str, request_id: Optional[str]) -> None:
    """Track API errors for monitoring patterns."""
    metadata = error_report.metadata
    
    # Extract API error details
    endpoint = metadata.get("endpoint", "unknown")
    method = metadata.get("method", "unknown")
    status_code = metadata.get("status", 0)
    
    # Log API error pattern
    performance_logger.logger.warning(
        f"Frontend reported API error: {method} {endpoint} - {status_code}",
        extra={
            "event_type": "frontend_api_error",
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "error_id": error_report.id,
            "session_id": error_report.sessionId,
            "user_id": error_report.userId,
            "client_ip": client_ip,
            "request_id": request_id
        }
    )


def _track_javascript_error(error_report: ErrorReport, client_ip: str, request_id: Optional[str]) -> None:
    """Track JavaScript errors for monitoring patterns."""
    metadata = error_report.metadata
    
    # Extract JavaScript error details
    filename = metadata.get("filename", "unknown")
    lineno = metadata.get("lineno", 0)
    
    # Check for common error patterns
    error_patterns = {
        "chunk_load_error": "ChunkLoadError" in error_report.message or "Loading chunk" in error_report.message,
        "script_error": "Script error" in error_report.message,
        "network_error": "NetworkError" in error_report.message or "Failed to fetch" in error_report.message,
        "type_error": "TypeError" in error_report.message,
        "reference_error": "ReferenceError" in error_report.message
    }
    
    detected_patterns = [pattern for pattern, detected in error_patterns.items() if detected]
    
    # Log JavaScript error pattern
    performance_logger.logger.warning(
        f"Frontend JavaScript error: {error_report.message[:100]}...",
        extra={
            "event_type": "frontend_javascript_error",
            "error_filename": filename,
            "error_lineno": lineno,
            "error_patterns": detected_patterns,
            "error_id": error_report.id,
            "session_id": error_report.sessionId,
            "user_id": error_report.userId,
            "client_ip": client_ip,
            "request_id": request_id
        }
    )


async def _send_critical_error_alerts(
    critical_errors: List[ErrorReport], 
    client_ip: str, 
    request_id: Optional[str]
) -> None:
    """Send alerts for critical frontend errors."""
    
    # Group critical errors by type
    error_groups = {}
    for error in critical_errors:
        error_type = error.type
        if error_type not in error_groups:
            error_groups[error_type] = []
        error_groups[error_type].append(error)
    
    # Send alerts for each error group
    for error_type, errors in error_groups.items():
        if len(errors) == 1:
            error = errors[0]
            message = f"Critical frontend {error_type} error: {error.message}"
        else:
            message = f"Multiple critical frontend {error_type} errors ({len(errors)} errors)"
        
        # Add custom alert rule for frontend critical errors
        rule_name = f"frontend_critical_{error_type}_error"
        
        if rule_name not in alert_manager.alert_rules:
            alert_manager.add_custom_rule(
                rule_name=rule_name,
                alert_type=AlertType.SERVICE_UNAVAILABLE,
                severity=AlertSeverity.CRITICAL,
                title=f"Critical Frontend {error_type.title()} Error",
                message_template="Critical frontend error detected: {message}",
                rate_limit_minutes=5
            )
        
        # Send the alert
        await alert_manager.send_alert(
            rule_name,
            metadata={
                "message": message,
                "error_count": len(errors),
                "error_type": error_type,
                "client_ip": client_ip,
                "request_id": request_id,
                "sample_error": {
                    "id": errors[0].id,
                    "url": errors[0].url,
                    "user_agent": errors[0].userAgent,
                    "session_id": errors[0].sessionId,
                    "user_id": errors[0].userId
                }
            }
        )