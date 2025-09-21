"""
Advanced security monitoring and alerting system for production deployment.

This module provides:
- Real-time security event monitoring
- Automated threat detection
- Security alerting and notifications
- Security metrics collection and analysis
- Incident response automation
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from enum import Enum
from fastapi import Request
from app.core.security_audit import SecurityAuditor, SecurityEventType

logger = logging.getLogger(__name__)


class ThreatLevel(Enum):
    """Security threat levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SecurityAlert:
    """Security alert data structure."""
    alert_id: str
    threat_level: ThreatLevel
    event_type: SecurityEventType
    title: str
    description: str
    timestamp: datetime
    source_ip: str
    user_id: Optional[int]
    username: Optional[str]
    endpoint: str
    details: Dict[str, Any]
    recommended_actions: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        data['threat_level'] = self.threat_level.value
        data['event_type'] = self.event_type.value
        return data


class SecurityMetrics:
    """Security metrics collection and analysis."""
    
    def __init__(self):
        self.metrics = defaultdict(int)
        self.time_series = defaultdict(lambda: deque(maxlen=1440))  # 24 hours of minute data
        self.alerts_history = deque(maxlen=1000)  # Keep last 1000 alerts
        self.threat_patterns = defaultdict(list)
        
    def record_event(self, event_type: SecurityEventType, severity: str, details: Dict[str, Any]):
        """Record a security event for metrics."""
        current_time = datetime.now(timezone.utc)
        
        # Update counters
        self.metrics[f"events_total"] += 1
        self.metrics[f"events_{event_type.value}"] += 1
        self.metrics[f"events_{severity.lower()}"] += 1
        
        # Update time series
        minute_key = current_time.strftime("%Y-%m-%d %H:%M")
        self.time_series[f"events_{event_type.value}"].append((current_time, 1))
        self.time_series[f"events_{severity.lower()}"].append((current_time, 1))
        
        # Analyze for threat patterns
        self._analyze_threat_patterns(event_type, details)
    
    def record_alert(self, alert: SecurityAlert):
        """Record a security alert."""
        self.alerts_history.append(alert)
        self.metrics[f"alerts_total"] += 1
        self.metrics[f"alerts_{alert.threat_level.value}"] += 1
    
    def get_metrics_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get security metrics summary."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        # Count recent events
        recent_events = {}
        for key, events in self.time_series.items():
            recent_count = sum(1 for timestamp, _ in events if timestamp > cutoff_time)
            recent_events[key] = recent_count
        
        # Count recent alerts by threat level
        recent_alerts = defaultdict(int)
        for alert in self.alerts_history:
            if alert.timestamp > cutoff_time:
                recent_alerts[alert.threat_level.value] += 1
        
        return {
            "time_period_hours": hours,
            "total_events": self.metrics.get("events_total", 0),
            "recent_events": dict(recent_events),
            "total_alerts": self.metrics.get("alerts_total", 0),
            "recent_alerts": dict(recent_alerts),
            "threat_patterns": len(self.threat_patterns),
            "metrics": dict(self.metrics)
        }
    
    def _analyze_threat_patterns(self, event_type: SecurityEventType, details: Dict[str, Any]):
        """Analyze events for threat patterns."""
        # This could be expanded with ML-based pattern detection
        current_time = datetime.now(timezone.utc)
        
        # Simple pattern detection for now
        if event_type in [SecurityEventType.LOGIN_FAILURE, SecurityEventType.ACCESS_DENIED]:
            ip_address = details.get("ip_address", "unknown")
            self.threat_patterns[f"failed_attempts_{ip_address}"].append(current_time)
            
            # Clean old entries (keep last hour)
            one_hour_ago = current_time - timedelta(hours=1)
            self.threat_patterns[f"failed_attempts_{ip_address}"] = [
                t for t in self.threat_patterns[f"failed_attempts_{ip_address}"]
                if t > one_hour_ago
            ]


class SecurityMonitor:
    """
    Advanced security monitoring system with real-time threat detection.
    """
    
    def __init__(self):
        self.metrics = SecurityMetrics()
        self.alert_handlers: List[Callable[[SecurityAlert], None]] = []
        self.threat_detection_rules = self._initialize_threat_detection_rules()
        self.monitoring_enabled = True
        
    def add_alert_handler(self, handler: Callable[[SecurityAlert], None]):
        """Add an alert handler function."""
        self.alert_handlers.append(handler)
    
    def process_security_event(
        self,
        event_type: SecurityEventType,
        request: Request,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "INFO"
    ):
        """Process a security event and check for threats."""
        if not self.monitoring_enabled:
            return
        
        details = details or {}
        
        # Record metrics
        self.metrics.record_event(event_type, severity, details)
        
        # Check threat detection rules
        alerts = self._check_threat_detection_rules(
            event_type, request, user_id, username, details, severity
        )
        
        # Process any generated alerts
        for alert in alerts:
            self._handle_alert(alert)
    
    def _initialize_threat_detection_rules(self) -> Dict[str, Dict[str, Any]]:
        """Initialize threat detection rules."""
        return {
            "brute_force_login": {
                "event_types": [SecurityEventType.LOGIN_FAILURE],
                "threshold": 5,
                "time_window_minutes": 15,
                "threat_level": ThreatLevel.HIGH,
                "description": "Multiple failed login attempts detected"
            },
            "rapid_api_requests": {
                "event_types": [SecurityEventType.RATE_LIMIT_EXCEEDED],
                "threshold": 3,
                "time_window_minutes": 5,
                "threat_level": ThreatLevel.MEDIUM,
                "description": "Rapid API request pattern detected"
            },
            "injection_attempts": {
                "event_types": [
                    SecurityEventType.XSS_ATTEMPT,
                    SecurityEventType.SQL_INJECTION_ATTEMPT,
                    SecurityEventType.COMMAND_INJECTION_ATTEMPT
                ],
                "threshold": 1,
                "time_window_minutes": 60,
                "threat_level": ThreatLevel.CRITICAL,
                "description": "Code injection attempt detected"
            },
            "privilege_escalation": {
                "event_types": [SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT],
                "threshold": 1,
                "time_window_minutes": 60,
                "threat_level": ThreatLevel.CRITICAL,
                "description": "Privilege escalation attempt detected"
            },
            "suspicious_file_access": {
                "event_types": [
                    SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
                    SecurityEventType.UNAUTHORIZED_FILE_ACCESS
                ],
                "threshold": 2,
                "time_window_minutes": 30,
                "threat_level": ThreatLevel.HIGH,
                "description": "Suspicious file access pattern detected"
            },
            "account_enumeration": {
                "event_types": [SecurityEventType.USER_ENUMERATION_ATTEMPT],
                "threshold": 10,
                "time_window_minutes": 30,
                "threat_level": ThreatLevel.MEDIUM,
                "description": "User account enumeration attempt detected"
            }
        }
    
    def _check_threat_detection_rules(
        self,
        event_type: SecurityEventType,
        request: Request,
        user_id: Optional[int],
        username: Optional[str],
        details: Dict[str, Any],
        severity: str
    ) -> List[SecurityAlert]:
        """Check event against threat detection rules."""
        alerts = []
        
        for rule_name, rule_config in self.threat_detection_rules.items():
            if event_type not in rule_config["event_types"]:
                continue
            
            # Check if this event triggers the rule
            if self._evaluate_threat_rule(rule_name, rule_config, request, details):
                alert = self._create_security_alert(
                    rule_name, rule_config, event_type, request, 
                    user_id, username, details
                )
                alerts.append(alert)
        
        return alerts
    
    def _evaluate_threat_rule(
        self,
        rule_name: str,
        rule_config: Dict[str, Any],
        request: Request,
        details: Dict[str, Any]
    ) -> bool:
        """Evaluate if a threat detection rule is triggered."""
        threshold = rule_config["threshold"]
        time_window = rule_config["time_window_minutes"]
        
        # For injection attempts, trigger immediately
        if rule_name == "injection_attempts":
            return True
        
        # For other rules, check frequency
        current_time = datetime.now(timezone.utc)
        cutoff_time = current_time - timedelta(minutes=time_window)
        
        # Count recent similar events (this would typically query a database)
        # For now, use a simple in-memory check
        source_ip = self._get_client_ip(request)
        pattern_key = f"{rule_name}_{source_ip}"
        
        if not hasattr(self, '_rule_tracking'):
            self._rule_tracking = defaultdict(list)
        
        # Add current event
        self._rule_tracking[pattern_key].append(current_time)
        
        # Clean old events
        self._rule_tracking[pattern_key] = [
            t for t in self._rule_tracking[pattern_key] if t > cutoff_time
        ]
        
        # Check if threshold is exceeded
        return len(self._rule_tracking[pattern_key]) >= threshold
    
    def _create_security_alert(
        self,
        rule_name: str,
        rule_config: Dict[str, Any],
        event_type: SecurityEventType,
        request: Request,
        user_id: Optional[int],
        username: Optional[str],
        details: Dict[str, Any]
    ) -> SecurityAlert:
        """Create a security alert."""
        import uuid
        
        alert_id = str(uuid.uuid4())
        source_ip = self._get_client_ip(request)
        
        # Generate recommended actions based on threat type
        recommended_actions = self._get_recommended_actions(rule_name, rule_config)
        
        return SecurityAlert(
            alert_id=alert_id,
            threat_level=rule_config["threat_level"],
            event_type=event_type,
            title=f"Security Alert: {rule_name.replace('_', ' ').title()}",
            description=rule_config["description"],
            timestamp=datetime.now(timezone.utc),
            source_ip=source_ip,
            user_id=user_id,
            username=username,
            endpoint=request.url.path,
            details=details,
            recommended_actions=recommended_actions
        )
    
    def _get_recommended_actions(self, rule_name: str, rule_config: Dict[str, Any]) -> List[str]:
        """Get recommended actions for a security alert."""
        actions_map = {
            "brute_force_login": [
                "Consider temporarily blocking the source IP address",
                "Review authentication logs for patterns",
                "Implement account lockout policies",
                "Enable multi-factor authentication"
            ],
            "rapid_api_requests": [
                "Review rate limiting configuration",
                "Monitor for DDoS attack patterns",
                "Consider implementing CAPTCHA for suspicious IPs",
                "Check application performance metrics"
            ],
            "injection_attempts": [
                "IMMEDIATE: Block source IP address",
                "Review input validation and sanitization",
                "Check for successful exploitation attempts",
                "Update security monitoring rules",
                "Consider filing security incident report"
            ],
            "privilege_escalation": [
                "IMMEDIATE: Review user permissions and roles",
                "Audit recent authorization changes",
                "Check for compromised accounts",
                "Review access control implementation"
            ],
            "suspicious_file_access": [
                "Review file system access logs",
                "Check for unauthorized file modifications",
                "Verify file permission configurations",
                "Monitor for data exfiltration attempts"
            ],
            "account_enumeration": [
                "Implement consistent response times for valid/invalid users",
                "Review user registration and login flows",
                "Consider implementing rate limiting on user lookup endpoints",
                "Monitor for automated scanning tools"
            ]
        }
        
        return actions_map.get(rule_name, ["Review security logs and take appropriate action"])
    
    def _handle_alert(self, alert: SecurityAlert):
        """Handle a security alert."""
        # Record the alert
        self.metrics.record_alert(alert)
        
        # Log the alert
        logger.warning(
            f"SECURITY ALERT [{alert.threat_level.value.upper()}]: {alert.title}",
            extra=alert.to_dict()
        )
        
        # Call registered alert handlers
        for handler in self.alert_handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"Alert handler failed: {e}")
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check X-Forwarded-For header first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fall back to client host
        return request.client.host if request.client else "unknown"
    
    def get_active_alerts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get active security alerts."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        active_alerts = [
            alert.to_dict() for alert in self.metrics.alerts_history
            if alert.timestamp > cutoff_time
        ]
        
        return sorted(active_alerts, key=lambda x: x['timestamp'], reverse=True)
    
    def get_security_dashboard_data(self) -> Dict[str, Any]:
        """Get comprehensive security dashboard data."""
        metrics_summary = self.metrics.get_metrics_summary()
        active_alerts = self.get_active_alerts()
        
        # Calculate threat level distribution
        threat_levels = defaultdict(int)
        for alert in active_alerts:
            threat_levels[alert['threat_level']] += 1
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "monitoring_status": "active" if self.monitoring_enabled else "disabled",
            "metrics_summary": metrics_summary,
            "active_alerts": {
                "total": len(active_alerts),
                "by_threat_level": dict(threat_levels),
                "recent_alerts": active_alerts[:10]  # Last 10 alerts
            },
            "threat_detection": {
                "rules_active": len(self.threat_detection_rules),
                "patterns_detected": len(self.metrics.threat_patterns)
            }
        }


# Global security monitor instance
security_monitor = SecurityMonitor()


# Alert handler functions
def log_security_alert(alert: SecurityAlert):
    """Log security alert to structured logging."""
    logger.warning(
        f"Security Alert: {alert.title}",
        extra={
            "alert_id": alert.alert_id,
            "threat_level": alert.threat_level.value,
            "event_type": alert.event_type.value,
            "source_ip": alert.source_ip,
            "user_id": alert.user_id,
            "username": alert.username,
            "endpoint": alert.endpoint,
            "details": alert.details,
            "recommended_actions": alert.recommended_actions
        }
    )


def email_security_alert(alert: SecurityAlert):
    """Send security alert via email (placeholder implementation)."""
    # This would integrate with an email service
    if alert.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
        logger.info(f"Would send email alert for: {alert.title}")


def slack_security_alert(alert: SecurityAlert):
    """Send security alert to Slack (placeholder implementation)."""
    # This would integrate with Slack API
    if alert.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
        logger.info(f"Would send Slack alert for: {alert.title}")


# Register default alert handlers
security_monitor.add_alert_handler(log_security_alert)

# Add additional handlers based on configuration
if os.getenv("ENABLE_EMAIL_ALERTS", "false").lower() == "true":
    security_monitor.add_alert_handler(email_security_alert)

if os.getenv("ENABLE_SLACK_ALERTS", "false").lower() == "true":
    security_monitor.add_alert_handler(slack_security_alert)


# Integration with existing security audit system
def monitor_security_event(
    event_type: SecurityEventType,
    request: Request,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    severity: str = "INFO",
    success: bool = True
):
    """
    Enhanced security event monitoring that integrates with the existing audit system.
    """
    # Call existing audit logging
    SecurityAuditor.log_security_event(
        event_type=event_type,
        request=request,
        user_id=user_id,
        username=username,
        details=details,
        severity=severity,
        success=success
    )
    
    # Add advanced monitoring
    security_monitor.process_security_event(
        event_type=event_type,
        request=request,
        user_id=user_id,
        username=username,
        details=details,
        severity=severity
    )