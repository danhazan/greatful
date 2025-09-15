"""
Error alerting system for critical failures and performance issues.
"""

import asyncio
import logging
import smtplib
import json
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dataclasses import dataclass
from enum import Enum
import os

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertType(Enum):
    """Types of alerts."""
    DATABASE_CONNECTION = "database_connection"
    DATABASE_PERFORMANCE = "database_performance"
    ALGORITHM_PERFORMANCE = "algorithm_performance"
    HIGH_ERROR_RATE = "high_error_rate"
    SYSTEM_RESOURCE = "system_resource"
    SECURITY_INCIDENT = "security_incident"
    SERVICE_UNAVAILABLE = "service_unavailable"


@dataclass
class Alert:
    """Alert data structure."""
    id: str
    type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    timestamp: datetime
    metadata: Dict[str, Any]
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert alert to dictionary."""
        return {
            "id": self.id,
            "type": self.type.value,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
            "resolved": self.resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }


class AlertChannel:
    """Base class for alert channels."""
    
    async def send_alert(self, alert: Alert) -> bool:
        """Send alert through this channel."""
        raise NotImplementedError


class LogAlertChannel(AlertChannel):
    """Alert channel that logs alerts."""
    
    def __init__(self, logger_name: str = "grateful-api.alerts"):
        self.logger = logging.getLogger(logger_name)
    
    async def send_alert(self, alert: Alert) -> bool:
        """Log the alert."""
        try:
            log_level = {
                AlertSeverity.INFO: logging.INFO,
                AlertSeverity.WARNING: logging.WARNING,
                AlertSeverity.CRITICAL: logging.ERROR,
                AlertSeverity.EMERGENCY: logging.CRITICAL
            }.get(alert.severity, logging.INFO)
            
            self.logger.log(
                log_level,
                f"ALERT [{alert.severity.value.upper()}] {alert.title}: {alert.message}",
                extra={
                    "event_type": "alert",
                    "alert_id": alert.id,
                    "alert_type": alert.type.value,
                    "alert_severity": alert.severity.value,
                    "alert_metadata": alert.metadata
                }
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to log alert: {e}")
            return False


class EmailAlertChannel(AlertChannel):
    """Alert channel that sends emails."""
    
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
        to_emails: List[str],
        use_tls: bool = True
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_email = from_email
        self.to_emails = to_emails
        self.use_tls = use_tls
    
    async def send_alert(self, alert: Alert) -> bool:
        """Send alert via email."""
        try:
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = ', '.join(self.to_emails)
            msg['Subject'] = f"[{alert.severity.value.upper()}] Grateful API Alert: {alert.title}"
            
            # Create email body
            body = self._create_email_body(alert)
            msg.attach(MIMEText(body, 'html'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            return False
    
    def _create_email_body(self, alert: Alert) -> str:
        """Create HTML email body for alert."""
        severity_colors = {
            AlertSeverity.INFO: "#17a2b8",
            AlertSeverity.WARNING: "#ffc107",
            AlertSeverity.CRITICAL: "#dc3545",
            AlertSeverity.EMERGENCY: "#6f42c1"
        }
        
        color = severity_colors.get(alert.severity, "#6c757d")
        
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; margin: 20px;">
            <div style="border-left: 4px solid {color}; padding-left: 20px;">
                <h2 style="color: {color}; margin-top: 0;">
                    [{alert.severity.value.upper()}] {alert.title}
                </h2>
                <p><strong>Time:</strong> {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                <p><strong>Type:</strong> {alert.type.value}</p>
                <p><strong>Message:</strong></p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    {alert.message}
                </div>
                
                {self._format_metadata(alert.metadata)}
                
                <hr style="margin: 20px 0;">
                <p style="color: #6c757d; font-size: 12px;">
                    This alert was generated by the Grateful API monitoring system.
                    Alert ID: {alert.id}
                </p>
            </div>
        </body>
        </html>
        """
    
    def _format_metadata(self, metadata: Dict[str, Any]) -> str:
        """Format metadata for email display."""
        if not metadata:
            return ""
        
        html = "<p><strong>Additional Information:</strong></p><ul>"
        for key, value in metadata.items():
            html += f"<li><strong>{key}:</strong> {value}</li>"
        html += "</ul>"
        return html


class WebhookAlertChannel(AlertChannel):
    """Alert channel that sends webhooks."""
    
    def __init__(self, webhook_url: str, headers: Optional[Dict[str, str]] = None):
        self.webhook_url = webhook_url
        self.headers = headers or {}
    
    async def send_alert(self, alert: Alert) -> bool:
        """Send alert via webhook."""
        try:
            import aiohttp
            
            payload = {
                "alert": alert.to_dict(),
                "service": "grateful-api",
                "environment": os.getenv("ENVIRONMENT", "development")
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    headers=self.headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status < 400:
                        return True
                    else:
                        logger.error(f"Webhook returned status {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to send webhook alert: {e}")
            return False


class SlackAlertChannel(AlertChannel):
    """Alert channel that sends Slack messages."""
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
    
    async def send_alert(self, alert: Alert) -> bool:
        """Send alert to Slack."""
        try:
            import aiohttp
            
            # Map severity to Slack colors
            colors = {
                AlertSeverity.INFO: "#36a64f",
                AlertSeverity.WARNING: "#ff9500",
                AlertSeverity.CRITICAL: "#ff0000",
                AlertSeverity.EMERGENCY: "#800080"
            }
            
            payload = {
                "attachments": [
                    {
                        "color": colors.get(alert.severity, "#36a64f"),
                        "title": f"[{alert.severity.value.upper()}] {alert.title}",
                        "text": alert.message,
                        "fields": [
                            {
                                "title": "Type",
                                "value": alert.type.value,
                                "short": True
                            },
                            {
                                "title": "Time",
                                "value": alert.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC'),
                                "short": True
                            }
                        ],
                        "footer": "Grateful API Monitoring",
                        "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
                        "ts": int(alert.timestamp.timestamp())
                    }
                ]
            }
            
            # Add metadata fields
            if alert.metadata:
                for key, value in list(alert.metadata.items())[:5]:  # Limit to 5 fields
                    payload["attachments"][0]["fields"].append({
                        "title": key.replace("_", " ").title(),
                        "value": str(value),
                        "short": True
                    })
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status < 400:
                        return True
                    else:
                        logger.error(f"Slack webhook returned status {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")
            return False


class AlertManager:
    """
    Manages alerts, channels, and alert rules.
    """
    
    def __init__(self):
        self.channels: List[AlertChannel] = []
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: List[Alert] = []
        self.alert_rules: Dict[str, Dict[str, Any]] = {}
        self.rate_limits: Dict[str, datetime] = {}
        
        # Default alert rules
        self._setup_default_rules()
        
        # Add default log channel
        self.add_channel(LogAlertChannel())
    
    def _setup_default_rules(self) -> None:
        """Setup default alert rules."""
        self.alert_rules = {
            "database_connection_failure": {
                "type": AlertType.DATABASE_CONNECTION,
                "severity": AlertSeverity.CRITICAL,
                "rate_limit_minutes": 5,
                "title": "Database Connection Failure",
                "message_template": "Database connection failed: {error}"
            },
            "algorithm_performance_degraded": {
                "type": AlertType.ALGORITHM_PERFORMANCE,
                "severity": AlertSeverity.WARNING,
                "rate_limit_minutes": 10,
                "title": "Algorithm Performance Degraded",
                "message_template": "Feed algorithm exceeding 300ms target: {avg_time_ms}ms average"
            },
            "high_error_rate": {
                "type": AlertType.HIGH_ERROR_RATE,
                "severity": AlertSeverity.CRITICAL,
                "rate_limit_minutes": 5,
                "title": "High API Error Rate",
                "message_template": "API error rate is {error_rate}% (threshold: {threshold}%)"
            },
            "system_resource_critical": {
                "type": AlertType.SYSTEM_RESOURCE,
                "severity": AlertSeverity.CRITICAL,
                "rate_limit_minutes": 15,
                "title": "Critical System Resource Usage",
                "message_template": "{resource} usage is {usage}% (threshold: {threshold}%)"
            },
            "security_incident": {
                "type": AlertType.SECURITY_INCIDENT,
                "severity": AlertSeverity.EMERGENCY,
                "rate_limit_minutes": 1,
                "title": "Security Incident Detected",
                "message_template": "Security incident: {incident_type} - {description}"
            }
        }
    
    def add_channel(self, channel: AlertChannel) -> None:
        """Add an alert channel."""
        self.channels.append(channel)
        logger.info(f"Added alert channel: {type(channel).__name__}")
    
    async def send_alert(
        self,
        rule_name: str,
        metadata: Optional[Dict[str, Any]] = None,
        custom_message: Optional[str] = None
    ) -> bool:
        """
        Send an alert based on a rule.
        
        Args:
            rule_name: Name of the alert rule
            metadata: Additional metadata for the alert
            custom_message: Custom message to override template
            
        Returns:
            bool: True if alert was sent successfully
        """
        if rule_name not in self.alert_rules:
            logger.error(f"Unknown alert rule: {rule_name}")
            return False
        
        rule = self.alert_rules[rule_name]
        
        # Check rate limiting
        if self._is_rate_limited(rule_name, rule.get("rate_limit_minutes", 5)):
            logger.debug(f"Alert {rule_name} is rate limited")
            return False
        
        # Create alert
        alert_id = f"{rule_name}_{int(datetime.now(timezone.utc).timestamp())}"
        
        # Format message
        if custom_message:
            message = custom_message
        else:
            message_template = rule.get("message_template", "Alert: {rule_name}")
            message = message_template.format(rule_name=rule_name, **(metadata or {}))
        
        alert = Alert(
            id=alert_id,
            type=rule["type"],
            severity=rule["severity"],
            title=rule["title"],
            message=message,
            timestamp=datetime.now(timezone.utc),
            metadata=metadata or {}
        )
        
        # Store alert
        self.active_alerts[alert_id] = alert
        self.alert_history.append(alert)
        
        # Update rate limit
        self.rate_limits[rule_name] = datetime.now(timezone.utc)
        
        # Send to all channels
        success_count = 0
        for channel in self.channels:
            try:
                if await channel.send_alert(alert):
                    success_count += 1
            except Exception as e:
                logger.error(f"Failed to send alert via {type(channel).__name__}: {e}")
        
        logger.info(
            f"Alert sent: {rule_name} (sent to {success_count}/{len(self.channels)} channels)",
            extra={
                "event_type": "alert_sent",
                "alert_id": alert_id,
                "rule_name": rule_name,
                "severity": alert.severity.value,
                "channels_success": success_count,
                "channels_total": len(self.channels)
            }
        )
        
        return success_count > 0
    
    def _is_rate_limited(self, rule_name: str, rate_limit_minutes: int) -> bool:
        """Check if alert is rate limited."""
        if rule_name not in self.rate_limits:
            return False
        
        last_sent = self.rate_limits[rule_name]
        time_diff = datetime.now(timezone.utc) - last_sent
        return time_diff.total_seconds() < (rate_limit_minutes * 60)
    
    async def resolve_alert(self, alert_id: str) -> bool:
        """Resolve an active alert."""
        if alert_id not in self.active_alerts:
            return False
        
        alert = self.active_alerts[alert_id]
        alert.resolved = True
        alert.resolved_at = datetime.now(timezone.utc)
        
        # Remove from active alerts
        del self.active_alerts[alert_id]
        
        logger.info(
            f"Alert resolved: {alert_id}",
            extra={
                "event_type": "alert_resolved",
                "alert_id": alert_id,
                "alert_type": alert.type.value
            }
        )
        
        return True
    
    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get all active alerts."""
        return [alert.to_dict() for alert in self.active_alerts.values()]
    
    def get_alert_history(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get alert history for the specified time period."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        recent_alerts = [
            alert for alert in self.alert_history
            if alert.timestamp >= cutoff_time
        ]
        
        return [alert.to_dict() for alert in recent_alerts]
    
    def add_custom_rule(
        self,
        rule_name: str,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        message_template: str,
        rate_limit_minutes: int = 5
    ) -> None:
        """Add a custom alert rule."""
        self.alert_rules[rule_name] = {
            "type": alert_type,
            "severity": severity,
            "title": title,
            "message_template": message_template,
            "rate_limit_minutes": rate_limit_minutes
        }
        
        logger.info(f"Added custom alert rule: {rule_name}")
    
    def get_alert_stats(self) -> Dict[str, Any]:
        """Get alert statistics."""
        now = datetime.now(timezone.utc)
        last_24h = now - timedelta(hours=24)
        last_hour = now - timedelta(hours=1)
        
        recent_alerts = [a for a in self.alert_history if a.timestamp >= last_24h]
        hourly_alerts = [a for a in self.alert_history if a.timestamp >= last_hour]
        
        # Count by severity
        severity_counts = {}
        for severity in AlertSeverity:
            severity_counts[severity.value] = len([
                a for a in recent_alerts if a.severity == severity
            ])
        
        # Count by type
        type_counts = {}
        for alert_type in AlertType:
            type_counts[alert_type.value] = len([
                a for a in recent_alerts if a.type == alert_type
            ])
        
        return {
            "active_alerts": len(self.active_alerts),
            "alerts_last_24h": len(recent_alerts),
            "alerts_last_hour": len(hourly_alerts),
            "severity_breakdown": severity_counts,
            "type_breakdown": type_counts,
            "total_channels": len(self.channels),
            "alert_rules": len(self.alert_rules)
        }


# Global alert manager instance
alert_manager = AlertManager()


# Convenience functions for common alerts
async def alert_database_connection_failure(error: str) -> bool:
    """Send database connection failure alert."""
    return await alert_manager.send_alert(
        "database_connection_failure",
        metadata={"error": error}
    )


async def alert_algorithm_performance_degraded(avg_time_ms: float) -> bool:
    """Send algorithm performance degraded alert."""
    return await alert_manager.send_alert(
        "algorithm_performance_degraded",
        metadata={"avg_time_ms": avg_time_ms, "threshold_ms": 300}
    )


async def alert_high_error_rate(error_rate: float, threshold: float = 5.0) -> bool:
    """Send high error rate alert."""
    return await alert_manager.send_alert(
        "high_error_rate",
        metadata={"error_rate": error_rate, "threshold": threshold}
    )


async def alert_system_resource_critical(resource: str, usage: float, threshold: float) -> bool:
    """Send critical system resource usage alert."""
    return await alert_manager.send_alert(
        "system_resource_critical",
        metadata={"resource": resource, "usage": usage, "threshold": threshold}
    )


async def alert_security_incident(incident_type: str, description: str, additional_data: Optional[Dict[str, Any]] = None) -> bool:
    """Send security incident alert."""
    metadata = {
        "incident_type": incident_type,
        "description": description
    }
    if additional_data:
        metadata.update(additional_data)
    
    return await alert_manager.send_alert(
        "security_incident",
        metadata=metadata
    )


def setup_email_alerts(
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    from_email: str,
    to_emails: List[str]
) -> None:
    """Setup email alert channel."""
    email_channel = EmailAlertChannel(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        from_email=from_email,
        to_emails=to_emails
    )
    alert_manager.add_channel(email_channel)


def setup_slack_alerts(webhook_url: str) -> None:
    """Setup Slack alert channel."""
    slack_channel = SlackAlertChannel(webhook_url)
    alert_manager.add_channel(slack_channel)


def setup_webhook_alerts(webhook_url: str, headers: Optional[Dict[str, str]] = None) -> None:
    """Setup webhook alert channel."""
    webhook_channel = WebhookAlertChannel(webhook_url, headers)
    alert_manager.add_channel(webhook_channel)