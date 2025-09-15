"""
Uptime monitoring and automated incident response system.
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from enum import Enum
import aiohttp

from app.core.error_alerting import alert_manager, AlertType, AlertSeverity
from app.core.database import get_db_health
from app.core.algorithm_performance import get_algorithm_performance_report

logger = logging.getLogger(__name__)


class ServiceStatus(Enum):
    """Service status levels."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    DOWN = "down"


class IncidentSeverity(Enum):
    """Incident severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class HealthCheck:
    """Health check configuration."""
    name: str
    check_function: Callable
    interval_seconds: int
    timeout_seconds: int
    failure_threshold: int = 3
    recovery_threshold: int = 2
    enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthCheckResult:
    """Result of a health check."""
    name: str
    status: ServiceStatus
    response_time_ms: float
    timestamp: datetime
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Incident:
    """Service incident."""
    id: str
    title: str
    description: str
    severity: IncidentSeverity
    status: str  # "investigating", "identified", "monitoring", "resolved"
    affected_services: List[str]
    started_at: datetime
    resolved_at: Optional[datetime] = None
    updates: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class UptimeMonitor:
    """
    Uptime monitoring system with automated incident response.
    """
    
    def __init__(self):
        self.health_checks: Dict[str, HealthCheck] = {}
        self.check_results: Dict[str, List[HealthCheckResult]] = {}
        self.failure_counts: Dict[str, int] = {}
        self.recovery_counts: Dict[str, int] = {}
        self.service_statuses: Dict[str, ServiceStatus] = {}
        self.active_incidents: Dict[str, Incident] = {}
        self.incident_history: List[Incident] = []
        self.monitoring_enabled = True
        self.check_tasks: Dict[str, asyncio.Task] = {}
        
        # Setup default health checks
        self._setup_default_health_checks()
    
    def _setup_default_health_checks(self) -> None:
        """Setup default health checks for core services."""
        
        # Database health check
        self.add_health_check(
            name="database",
            check_function=self._check_database_health,
            interval_seconds=30,
            timeout_seconds=10,
            failure_threshold=3,
            recovery_threshold=2
        )
        
        # Algorithm performance check
        self.add_health_check(
            name="algorithm_performance",
            check_function=self._check_algorithm_performance,
            interval_seconds=60,
            timeout_seconds=15,
            failure_threshold=5,
            recovery_threshold=3
        )
        
        # API endpoint health check
        self.add_health_check(
            name="api_endpoints",
            check_function=self._check_api_endpoints,
            interval_seconds=45,
            timeout_seconds=10,
            failure_threshold=3,
            recovery_threshold=2
        )
        
        # System resources check
        self.add_health_check(
            name="system_resources",
            check_function=self._check_system_resources,
            interval_seconds=120,
            timeout_seconds=5,
            failure_threshold=3,
            recovery_threshold=2
        )
    
    def add_health_check(
        self,
        name: str,
        check_function: Callable,
        interval_seconds: int,
        timeout_seconds: int,
        failure_threshold: int = 3,
        recovery_threshold: int = 2,
        enabled: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Add a health check to the monitoring system."""
        
        health_check = HealthCheck(
            name=name,
            check_function=check_function,
            interval_seconds=interval_seconds,
            timeout_seconds=timeout_seconds,
            failure_threshold=failure_threshold,
            recovery_threshold=recovery_threshold,
            enabled=enabled,
            metadata=metadata or {}
        )
        
        self.health_checks[name] = health_check
        self.check_results[name] = []
        self.failure_counts[name] = 0
        self.recovery_counts[name] = 0
        self.service_statuses[name] = ServiceStatus.HEALTHY
        
        logger.info(f"Added health check: {name}")
    
    async def start_monitoring(self) -> None:
        """Start all health check monitoring tasks."""
        if not self.monitoring_enabled:
            return
        
        for name, health_check in self.health_checks.items():
            if health_check.enabled and name not in self.check_tasks:
                task = asyncio.create_task(self._run_health_check_loop(name))
                self.check_tasks[name] = task
                logger.info(f"Started monitoring for {name}")
        
        logger.info("Uptime monitoring started")
    
    async def stop_monitoring(self) -> None:
        """Stop all health check monitoring tasks."""
        for name, task in self.check_tasks.items():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        self.check_tasks.clear()
        logger.info("Uptime monitoring stopped")
    
    async def _run_health_check_loop(self, check_name: str) -> None:
        """Run a health check in a loop."""
        health_check = self.health_checks[check_name]
        
        while self.monitoring_enabled and health_check.enabled:
            try:
                await self._perform_health_check(check_name)
                await asyncio.sleep(health_check.interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health check loop for {check_name}: {e}")
                await asyncio.sleep(health_check.interval_seconds)
    
    async def _perform_health_check(self, check_name: str) -> None:
        """Perform a single health check."""
        health_check = self.health_checks[check_name]
        start_time = time.time()
        
        try:
            # Run the health check with timeout
            result = await asyncio.wait_for(
                health_check.check_function(),
                timeout=health_check.timeout_seconds
            )
            
            response_time_ms = (time.time() - start_time) * 1000
            
            # Create health check result
            check_result = HealthCheckResult(
                name=check_name,
                status=result.get("status", ServiceStatus.HEALTHY),
                response_time_ms=response_time_ms,
                timestamp=datetime.now(timezone.utc),
                error=result.get("error"),
                metadata=result.get("metadata", {})
            )
            
        except asyncio.TimeoutError:
            response_time_ms = health_check.timeout_seconds * 1000
            check_result = HealthCheckResult(
                name=check_name,
                status=ServiceStatus.DOWN,
                response_time_ms=response_time_ms,
                timestamp=datetime.now(timezone.utc),
                error=f"Health check timed out after {health_check.timeout_seconds}s"
            )
            
        except Exception as e:
            response_time_ms = (time.time() - start_time) * 1000
            check_result = HealthCheckResult(
                name=check_name,
                status=ServiceStatus.DOWN,
                response_time_ms=response_time_ms,
                timestamp=datetime.now(timezone.utc),
                error=str(e)
            )
        
        # Store result
        self.check_results[check_name].append(check_result)
        
        # Maintain result history (keep last 100 results)
        if len(self.check_results[check_name]) > 100:
            self.check_results[check_name] = self.check_results[check_name][-100:]
        
        # Process result for incident detection
        await self._process_health_check_result(check_name, check_result)
    
    async def _process_health_check_result(self, check_name: str, result: HealthCheckResult) -> None:
        """Process health check result and handle incidents."""
        health_check = self.health_checks[check_name]
        current_status = self.service_statuses[check_name]
        
        # Update failure/recovery counts
        if result.status in [ServiceStatus.UNHEALTHY, ServiceStatus.DOWN]:
            self.failure_counts[check_name] += 1
            self.recovery_counts[check_name] = 0
        else:
            self.recovery_counts[check_name] += 1
            if current_status in [ServiceStatus.UNHEALTHY, ServiceStatus.DOWN]:
                # Only reset failure count if we're recovering from a bad state
                if self.recovery_counts[check_name] >= health_check.recovery_threshold:
                    self.failure_counts[check_name] = 0
        
        # Determine if status should change
        new_status = current_status
        
        # Check for service degradation/failure
        if self.failure_counts[check_name] >= health_check.failure_threshold:
            if result.status == ServiceStatus.DOWN:
                new_status = ServiceStatus.DOWN
            elif result.status == ServiceStatus.UNHEALTHY:
                new_status = ServiceStatus.UNHEALTHY
            elif result.status == ServiceStatus.DEGRADED:
                new_status = ServiceStatus.DEGRADED
        
        # Check for service recovery
        elif self.recovery_counts[check_name] >= health_check.recovery_threshold:
            if current_status in [ServiceStatus.UNHEALTHY, ServiceStatus.DOWN, ServiceStatus.DEGRADED]:
                new_status = ServiceStatus.HEALTHY
        
        # Update status if changed
        if new_status != current_status:
            self.service_statuses[check_name] = new_status
            await self._handle_status_change(check_name, current_status, new_status, result)
        
        # Log health check result
        log_level = logging.INFO
        if result.status in [ServiceStatus.UNHEALTHY, ServiceStatus.DOWN]:
            log_level = logging.ERROR
        elif result.status == ServiceStatus.DEGRADED:
            log_level = logging.WARNING
        
        logger.log(
            log_level,
            f"Health check {check_name}: {result.status.value} "
            f"({result.response_time_ms:.1f}ms)",
            extra={
                "event_type": "health_check_result",
                "check_name": check_name,
                "status": result.status.value,
                "response_time_ms": result.response_time_ms,
                "error": result.error,
                "failure_count": self.failure_counts[check_name],
                "recovery_count": self.recovery_counts[check_name]
            }
        )
    
    async def _handle_status_change(
        self,
        check_name: str,
        old_status: ServiceStatus,
        new_status: ServiceStatus,
        result: HealthCheckResult
    ) -> None:
        """Handle service status changes and create/resolve incidents."""
        
        logger.info(
            f"Service status changed: {check_name} {old_status.value} -> {new_status.value}",
            extra={
                "event_type": "service_status_change",
                "service": check_name,
                "old_status": old_status.value,
                "new_status": new_status.value,
                "error": result.error
            }
        )
        
        # Handle service degradation/failure
        if new_status in [ServiceStatus.DEGRADED, ServiceStatus.UNHEALTHY, ServiceStatus.DOWN]:
            await self._create_or_update_incident(check_name, new_status, result)
        
        # Handle service recovery
        elif old_status in [ServiceStatus.DEGRADED, ServiceStatus.UNHEALTHY, ServiceStatus.DOWN] and new_status == ServiceStatus.HEALTHY:
            await self._resolve_incident(check_name, result)
        
        # Send alerts
        await self._send_status_change_alert(check_name, old_status, new_status, result)
    
    async def _create_or_update_incident(
        self,
        service_name: str,
        status: ServiceStatus,
        result: HealthCheckResult
    ) -> None:
        """Create or update an incident for service issues."""
        
        # Check if there's already an active incident for this service
        existing_incident = None
        for incident in self.active_incidents.values():
            if service_name in incident.affected_services and incident.status != "resolved":
                existing_incident = incident
                break
        
        if existing_incident:
            # Update existing incident
            existing_incident.updates.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": status.value,
                "message": f"Service {service_name} status: {status.value}",
                "error": result.error
            })
            
            # Escalate severity if needed
            if status == ServiceStatus.DOWN and existing_incident.severity != IncidentSeverity.CRITICAL:
                existing_incident.severity = IncidentSeverity.CRITICAL
                existing_incident.updates.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Incident escalated to CRITICAL due to service DOWN status"
                })
        else:
            # Create new incident
            incident_id = f"incident-{int(datetime.now(timezone.utc).timestamp())}-{service_name}"
            
            severity = IncidentSeverity.LOW
            if status == ServiceStatus.DOWN:
                severity = IncidentSeverity.CRITICAL
            elif status == ServiceStatus.UNHEALTHY:
                severity = IncidentSeverity.HIGH
            elif status == ServiceStatus.DEGRADED:
                severity = IncidentSeverity.MEDIUM
            
            incident = Incident(
                id=incident_id,
                title=f"{service_name.title()} Service Issues",
                description=f"Service {service_name} is experiencing issues: {status.value}",
                severity=severity,
                status="investigating",
                affected_services=[service_name],
                started_at=datetime.now(timezone.utc),
                metadata={
                    "initial_error": result.error,
                    "response_time_ms": result.response_time_ms
                }
            )
            
            incident.updates.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"Incident created: {service_name} status changed to {status.value}",
                "error": result.error
            })
            
            self.active_incidents[incident_id] = incident
            
            logger.error(
                f"Incident created: {incident_id} - {incident.title}",
                extra={
                    "event_type": "incident_created",
                    "incident_id": incident_id,
                    "service": service_name,
                    "severity": severity.value,
                    "status": status.value
                }
            )
    
    async def _resolve_incident(self, service_name: str, result: HealthCheckResult) -> None:
        """Resolve incidents for recovered services."""
        
        # Find and resolve incidents for this service
        for incident_id, incident in list(self.active_incidents.items()):
            if service_name in incident.affected_services and incident.status != "resolved":
                incident.status = "resolved"
                incident.resolved_at = datetime.now(timezone.utc)
                incident.updates.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Service {service_name} has recovered and is now healthy"
                })
                
                # Move to history
                self.incident_history.append(incident)
                del self.active_incidents[incident_id]
                
                logger.info(
                    f"Incident resolved: {incident_id} - {incident.title}",
                    extra={
                        "event_type": "incident_resolved",
                        "incident_id": incident_id,
                        "service": service_name,
                        "duration_minutes": (
                            incident.resolved_at - incident.started_at
                        ).total_seconds() / 60
                    }
                )
    
    async def _send_status_change_alert(
        self,
        service_name: str,
        old_status: ServiceStatus,
        new_status: ServiceStatus,
        result: HealthCheckResult
    ) -> None:
        """Send alerts for service status changes."""
        
        # Determine alert severity
        if new_status == ServiceStatus.DOWN:
            severity = AlertSeverity.CRITICAL
        elif new_status == ServiceStatus.UNHEALTHY:
            severity = AlertSeverity.CRITICAL
        elif new_status == ServiceStatus.DEGRADED:
            severity = AlertSeverity.WARNING
        elif old_status in [ServiceStatus.DOWN, ServiceStatus.UNHEALTHY, ServiceStatus.DEGRADED] and new_status == ServiceStatus.HEALTHY:
            severity = AlertSeverity.INFO
        else:
            return  # No alert needed
        
        # Create alert rule if it doesn't exist
        rule_name = f"service_status_change_{service_name}"
        
        if rule_name not in alert_manager.alert_rules:
            alert_manager.add_custom_rule(
                rule_name=rule_name,
                alert_type=AlertType.SERVICE_UNAVAILABLE,
                severity=severity,
                title=f"{service_name.title()} Service Status Change",
                message_template="Service {service_name} status changed from {old_status} to {new_status}",
                rate_limit_minutes=5
            )
        
        # Send alert
        await alert_manager.send_alert(
            rule_name,
            metadata={
                "service_name": service_name,
                "old_status": old_status.value,
                "new_status": new_status.value,
                "error": result.error,
                "response_time_ms": result.response_time_ms,
                "timestamp": result.timestamp.isoformat()
            }
        )
    
    # Health check implementations
    async def _check_database_health(self) -> Dict[str, Any]:
        """Check database health."""
        try:
            db_health = await get_db_health()
            
            if db_health["status"] == "healthy":
                return {"status": ServiceStatus.HEALTHY, "metadata": db_health}
            else:
                return {
                    "status": ServiceStatus.UNHEALTHY,
                    "error": db_health.get("error", "Database unhealthy"),
                    "metadata": db_health
                }
                
        except Exception as e:
            return {
                "status": ServiceStatus.DOWN,
                "error": f"Database check failed: {str(e)}"
            }
    
    async def _check_algorithm_performance(self) -> Dict[str, Any]:
        """Check algorithm performance."""
        try:
            algorithm_report = get_algorithm_performance_report()
            performance_metrics = algorithm_report.get("performance_metrics", {})
            
            # Check if algorithm is meeting performance targets
            operations = performance_metrics.get("operations", {})
            feed_operations = {
                name: data for name, data in operations.items()
                if "feed" in name.lower()
            }
            
            if not feed_operations:
                return {"status": ServiceStatus.HEALTHY, "metadata": {"note": "No feed operations recorded"}}
            
            # Check average feed performance
            total_avg_time = sum(op.get("avg_time_ms", 0) for op in feed_operations.values())
            avg_feed_time = total_avg_time / len(feed_operations)
            
            if avg_feed_time > 500:  # Very slow
                return {
                    "status": ServiceStatus.UNHEALTHY,
                    "error": f"Algorithm performance degraded: {avg_feed_time:.1f}ms average",
                    "metadata": {"avg_feed_time_ms": avg_feed_time, "target_ms": 300}
                }
            elif avg_feed_time > 300:  # Slower than target
                return {
                    "status": ServiceStatus.DEGRADED,
                    "error": f"Algorithm performance below target: {avg_feed_time:.1f}ms average",
                    "metadata": {"avg_feed_time_ms": avg_feed_time, "target_ms": 300}
                }
            else:
                return {
                    "status": ServiceStatus.HEALTHY,
                    "metadata": {"avg_feed_time_ms": avg_feed_time, "target_ms": 300}
                }
                
        except Exception as e:
            return {
                "status": ServiceStatus.DOWN,
                "error": f"Algorithm performance check failed: {str(e)}"
            }
    
    async def _check_api_endpoints(self) -> Dict[str, Any]:
        """Check critical API endpoints."""
        try:
            # Test critical endpoints
            endpoints_to_check = [
                {"path": "/health", "method": "GET"},
                {"path": "/api/v1/posts/feed", "method": "GET", "requires_auth": True}
            ]
            
            failed_endpoints = []
            slow_endpoints = []
            
            async with aiohttp.ClientSession() as session:
                for endpoint in endpoints_to_check:
                    try:
                        start_time = time.time()
                        
                        # For now, just check the health endpoint
                        if endpoint["path"] == "/health":
                            async with session.get("http://localhost:8000/health") as response:
                                response_time = (time.time() - start_time) * 1000
                                
                                if response.status != 200:
                                    failed_endpoints.append({
                                        "path": endpoint["path"],
                                        "status": response.status,
                                        "response_time_ms": response_time
                                    })
                                elif response_time > 1000:  # Slow response
                                    slow_endpoints.append({
                                        "path": endpoint["path"],
                                        "response_time_ms": response_time
                                    })
                        
                    except Exception as e:
                        failed_endpoints.append({
                            "path": endpoint["path"],
                            "error": str(e)
                        })
            
            if failed_endpoints:
                return {
                    "status": ServiceStatus.UNHEALTHY,
                    "error": f"{len(failed_endpoints)} API endpoints failed",
                    "metadata": {"failed_endpoints": failed_endpoints, "slow_endpoints": slow_endpoints}
                }
            elif slow_endpoints:
                return {
                    "status": ServiceStatus.DEGRADED,
                    "error": f"{len(slow_endpoints)} API endpoints are slow",
                    "metadata": {"slow_endpoints": slow_endpoints}
                }
            else:
                return {"status": ServiceStatus.HEALTHY, "metadata": {"endpoints_checked": len(endpoints_to_check)}}
                
        except Exception as e:
            return {
                "status": ServiceStatus.DOWN,
                "error": f"API endpoint check failed: {str(e)}"
            }
    
    async def _check_system_resources(self) -> Dict[str, Any]:
        """Check system resource usage."""
        try:
            import psutil
            
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            issues = []
            
            if cpu_percent > 90:
                issues.append(f"High CPU usage: {cpu_percent}%")
            if memory.percent > 90:
                issues.append(f"High memory usage: {memory.percent}%")
            if disk.percent > 90:
                issues.append(f"High disk usage: {disk.percent}%")
            
            metadata = {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "disk_percent": disk.percent
            }
            
            if issues:
                return {
                    "status": ServiceStatus.DEGRADED,
                    "error": "; ".join(issues),
                    "metadata": metadata
                }
            else:
                return {"status": ServiceStatus.HEALTHY, "metadata": metadata}
                
        except ImportError:
            return {
                "status": ServiceStatus.HEALTHY,
                "metadata": {"note": "psutil not available for system monitoring"}
            }
        except Exception as e:
            return {
                "status": ServiceStatus.DOWN,
                "error": f"System resource check failed: {str(e)}"
            }
    
    # Public API methods
    def get_service_status(self, service_name: str) -> Optional[ServiceStatus]:
        """Get current status of a service."""
        return self.service_statuses.get(service_name)
    
    def get_all_service_statuses(self) -> Dict[str, ServiceStatus]:
        """Get status of all monitored services."""
        return self.service_statuses.copy()
    
    def get_recent_results(self, service_name: str, count: int = 10) -> List[HealthCheckResult]:
        """Get recent health check results for a service."""
        results = self.check_results.get(service_name, [])
        return results[-count:]
    
    def get_active_incidents(self) -> List[Dict[str, Any]]:
        """Get all active incidents."""
        return [
            {
                "id": incident.id,
                "title": incident.title,
                "description": incident.description,
                "severity": incident.severity.value,
                "status": incident.status,
                "affected_services": incident.affected_services,
                "started_at": incident.started_at.isoformat(),
                "updates": incident.updates,
                "metadata": incident.metadata
            }
            for incident in self.active_incidents.values()
        ]
    
    def get_uptime_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get uptime statistics for the specified time period."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        stats = {}
        
        for service_name, results in self.check_results.items():
            recent_results = [
                result for result in results
                if result.timestamp >= cutoff_time
            ]
            
            if not recent_results:
                continue
            
            total_checks = len(recent_results)
            healthy_checks = len([
                result for result in recent_results
                if result.status == ServiceStatus.HEALTHY
            ])
            
            uptime_percentage = (healthy_checks / total_checks * 100) if total_checks > 0 else 0
            avg_response_time = sum(result.response_time_ms for result in recent_results) / total_checks
            
            stats[service_name] = {
                "uptime_percentage": uptime_percentage,
                "total_checks": total_checks,
                "healthy_checks": healthy_checks,
                "avg_response_time_ms": avg_response_time,
                "current_status": self.service_statuses[service_name].value
            }
        
        return {
            "time_period_hours": hours,
            "services": stats,
            "active_incidents": len(self.active_incidents),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


# Global uptime monitor instance
uptime_monitor = UptimeMonitor()