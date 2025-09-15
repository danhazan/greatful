"""
Performance monitoring dashboard for feed algorithm and API response times.
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
from dataclasses import dataclass, field

from app.core.algorithm_performance import get_algorithm_performance_report
from app.core.performance_utils import run_performance_diagnostics
from app.core.database import get_db_health, get_db_stats

logger = logging.getLogger(__name__)


@dataclass
class MetricPoint:
    """A single metric data point with timestamp."""
    timestamp: datetime
    value: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TimeSeriesMetric:
    """Time series metric with historical data."""
    name: str
    unit: str
    description: str
    data_points: deque = field(default_factory=lambda: deque(maxlen=1000))
    current_value: Optional[float] = None
    
    def add_point(self, value: float, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Add a new data point to the time series."""
        point = MetricPoint(
            timestamp=datetime.now(timezone.utc),
            value=value,
            metadata=metadata or {}
        )
        self.data_points.append(point)
        self.current_value = value
    
    def get_recent_points(self, minutes: int = 60) -> List[MetricPoint]:
        """Get data points from the last N minutes."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        return [
            point for point in self.data_points 
            if point.timestamp >= cutoff_time
        ]
    
    def get_average(self, minutes: int = 60) -> Optional[float]:
        """Get average value over the last N minutes."""
        recent_points = self.get_recent_points(minutes)
        if not recent_points:
            return None
        return sum(point.value for point in recent_points) / len(recent_points)
    
    def get_max(self, minutes: int = 60) -> Optional[float]:
        """Get maximum value over the last N minutes."""
        recent_points = self.get_recent_points(minutes)
        if not recent_points:
            return None
        return max(point.value for point in recent_points)
    
    def get_min(self, minutes: int = 60) -> Optional[float]:
        """Get minimum value over the last N minutes."""
        recent_points = self.get_recent_points(minutes)
        if not recent_points:
            return None
        return min(point.value for point in recent_points)


class MonitoringDashboard:
    """
    Performance monitoring dashboard that tracks key metrics over time.
    """
    
    def __init__(self):
        self.metrics: Dict[str, TimeSeriesMetric] = {}
        self.alerts: List[Dict[str, Any]] = []
        self.alert_thresholds = {
            "api_response_time_ms": 1000,  # 1 second
            "feed_algorithm_time_ms": 300,  # 300ms target
            "database_connection_pool_usage": 80,  # 80% utilization
            "slow_query_rate": 10,  # 10% of queries are slow
            "error_rate": 5,  # 5% error rate
            "cache_hit_rate": 70,  # Minimum 70% cache hit rate
        }
        self.monitoring_enabled = True
        
        # Initialize core metrics
        self._initialize_metrics()
    
    def _initialize_metrics(self) -> None:
        """Initialize core monitoring metrics."""
        core_metrics = [
            ("api_response_time_ms", "ms", "Average API response time"),
            ("feed_algorithm_time_ms", "ms", "Feed algorithm execution time"),
            ("database_connection_pool_usage", "%", "Database connection pool utilization"),
            ("database_query_time_ms", "ms", "Average database query time"),
            ("slow_query_rate", "%", "Percentage of slow queries"),
            ("error_rate", "%", "API error rate"),
            ("cache_hit_rate", "%", "Algorithm cache hit rate"),
            ("active_users", "count", "Number of active users"),
            ("requests_per_minute", "count", "API requests per minute"),
            ("memory_usage_mb", "MB", "Memory usage"),
            ("cpu_usage_percent", "%", "CPU usage percentage"),
        ]
        
        for name, unit, description in core_metrics:
            self.metrics[name] = TimeSeriesMetric(name, unit, description)
    
    async def collect_metrics(self) -> Dict[str, Any]:
        """
        Collect current metrics from all monitoring sources.
        
        Returns:
            Dict containing current metric values and metadata
        """
        if not self.monitoring_enabled:
            return {"status": "monitoring_disabled"}
        
        try:
            # Collect metrics in parallel
            tasks = [
                self._collect_algorithm_metrics(),
                self._collect_database_metrics(),
                self._collect_system_metrics(),
            ]
            
            algorithm_metrics, db_metrics, system_metrics = await asyncio.gather(*tasks)
            
            # Update time series metrics
            self._update_metrics(algorithm_metrics, db_metrics, system_metrics)
            
            # Check for alerts
            self._check_alerts()
            
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "algorithm": algorithm_metrics,
                "database": db_metrics,
                "system": system_metrics,
                "alerts": self.alerts[-10:],  # Last 10 alerts
                "status": "healthy" if not self._has_critical_alerts() else "degraded"
            }
            
        except Exception as e:
            logger.error(f"Failed to collect metrics: {e}")
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "error",
                "error": str(e)
            }
    
    async def _collect_algorithm_metrics(self) -> Dict[str, Any]:
        """Collect algorithm performance metrics."""
        try:
            algorithm_report = get_algorithm_performance_report()
            performance_metrics = algorithm_report.get("performance_metrics", {})
            cache_stats = algorithm_report.get("cache_statistics", {})
            
            # Calculate feed algorithm performance
            feed_operations = {}
            for op_name, op_data in performance_metrics.get("operations", {}).items():
                if "feed" in op_name.lower():
                    feed_operations[op_name] = op_data
            
            # Calculate average feed time
            feed_avg_time = 0
            if feed_operations:
                total_time = sum(op.get("avg_time_ms", 0) for op in feed_operations.values())
                feed_avg_time = total_time / len(feed_operations)
            
            # Calculate cache hit rate
            cache_hit_rate = self._calculate_cache_hit_rate(cache_stats)
            
            return {
                "feed_algorithm_time_ms": feed_avg_time,
                "cache_hit_rate": cache_hit_rate,
                "total_operations": len(performance_metrics.get("operations", {})),
                "feed_operations": feed_operations,
                "cache_statistics": cache_stats
            }
            
        except Exception as e:
            logger.error(f"Failed to collect algorithm metrics: {e}")
            return {"error": str(e)}
    
    async def _collect_database_metrics(self) -> Dict[str, Any]:
        """Collect database performance metrics."""
        try:
            # Get database health and stats in parallel
            db_health_task = asyncio.create_task(get_db_health())
            db_stats_task = asyncio.create_task(get_db_stats())
            
            db_health, db_stats = await asyncio.gather(db_health_task, db_stats_task)
            
            # Calculate connection pool utilization
            pool_info = db_health.get("pool", {})
            pool_size = pool_info.get("size", 0)
            checked_out = pool_info.get("checked_out", 0)
            pool_utilization = (checked_out / pool_size * 100) if pool_size > 0 else 0
            
            # Get connection stats
            connections = db_stats.get("connections", {})
            
            return {
                "status": db_health.get("status", "unknown"),
                "connection_pool_usage": pool_utilization,
                "pool_info": pool_info,
                "connections": connections,
                "database_size": db_stats.get("database_size", "unknown"),
                "table_stats": db_stats.get("tables", [])[:5]  # Top 5 tables
            }
            
        except Exception as e:
            logger.error(f"Failed to collect database metrics: {e}")
            return {"error": str(e)}
    
    async def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect system resource metrics."""
        try:
            import psutil
            
            # Get system metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                "cpu_usage_percent": cpu_percent,
                "memory_usage_mb": (memory.total - memory.available) / (1024 * 1024),
                "memory_usage_percent": memory.percent,
                "memory_available_mb": memory.available / (1024 * 1024),
                "disk_usage_percent": disk.percent,
                "disk_free_gb": disk.free / (1024 * 1024 * 1024)
            }
            
        except ImportError:
            return {"note": "psutil not available for system metrics"}
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
            return {"error": str(e)}
    
    def _update_metrics(
        self, 
        algorithm_metrics: Dict[str, Any], 
        db_metrics: Dict[str, Any], 
        system_metrics: Dict[str, Any]
    ) -> None:
        """Update time series metrics with new data points."""
        
        # Update algorithm metrics
        if "feed_algorithm_time_ms" in algorithm_metrics:
            self.metrics["feed_algorithm_time_ms"].add_point(
                algorithm_metrics["feed_algorithm_time_ms"]
            )
        
        if "cache_hit_rate" in algorithm_metrics:
            self.metrics["cache_hit_rate"].add_point(
                algorithm_metrics["cache_hit_rate"]
            )
        
        # Update database metrics
        if "connection_pool_usage" in db_metrics:
            self.metrics["database_connection_pool_usage"].add_point(
                db_metrics["connection_pool_usage"]
            )
        
        # Update system metrics
        if "cpu_usage_percent" in system_metrics:
            self.metrics["cpu_usage_percent"].add_point(
                system_metrics["cpu_usage_percent"]
            )
        
        if "memory_usage_mb" in system_metrics:
            self.metrics["memory_usage_mb"].add_point(
                system_metrics["memory_usage_mb"]
            )
    
    def _check_alerts(self) -> None:
        """Check metrics against alert thresholds and generate alerts."""
        current_time = datetime.now(timezone.utc)
        
        for metric_name, threshold in self.alert_thresholds.items():
            if metric_name in self.metrics:
                metric = self.metrics[metric_name]
                current_value = metric.current_value
                
                if current_value is not None:
                    # Check if threshold is exceeded
                    is_alert = False
                    severity = "info"
                    
                    if metric_name in ["api_response_time_ms", "feed_algorithm_time_ms", 
                                     "database_connection_pool_usage", "slow_query_rate", "error_rate"]:
                        # Higher values are bad
                        if current_value > threshold:
                            is_alert = True
                            severity = "critical" if current_value > threshold * 1.5 else "warning"
                    
                    elif metric_name == "cache_hit_rate":
                        # Lower values are bad
                        if current_value < threshold:
                            is_alert = True
                            severity = "warning"
                    
                    if is_alert:
                        # Check if we already have a recent alert for this metric
                        recent_alerts = [
                            alert for alert in self.alerts[-50:]  # Check last 50 alerts
                            if alert["metric"] == metric_name and 
                            (current_time - datetime.fromisoformat(alert["timestamp"].replace('Z', '+00:00'))).total_seconds() < 300  # 5 minutes
                        ]
                        
                        if not recent_alerts:  # Only add if no recent alert
                            alert = {
                                "timestamp": current_time.isoformat(),
                                "metric": metric_name,
                                "current_value": current_value,
                                "threshold": threshold,
                                "severity": severity,
                                "message": f"{metric_name} is {current_value:.1f} {metric.unit} (threshold: {threshold} {metric.unit})"
                            }
                            self.alerts.append(alert)
                            
                            # Log the alert
                            logger.warning(
                                f"Performance alert: {alert['message']}",
                                extra={
                                    "event_type": "performance_alert",
                                    "metric": metric_name,
                                    "current_value": current_value,
                                    "threshold": threshold,
                                    "severity": severity
                                }
                            )
    
    def _has_critical_alerts(self) -> bool:
        """Check if there are any critical alerts in the last 10 minutes."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        
        for alert in reversed(self.alerts[-20:]):  # Check last 20 alerts
            alert_time = datetime.fromisoformat(alert["timestamp"].replace('Z', '+00:00'))
            if alert_time >= cutoff_time and alert["severity"] == "critical":
                return True
        
        return False
    
    def _calculate_cache_hit_rate(self, cache_stats: Dict[str, Any]) -> float:
        """Calculate overall cache hit rate."""
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
    
    def get_dashboard_data(self, time_range_minutes: int = 60) -> Dict[str, Any]:
        """
        Get dashboard data for the specified time range.
        
        Args:
            time_range_minutes: Time range in minutes for historical data
            
        Returns:
            Dict containing dashboard data
        """
        dashboard_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "time_range_minutes": time_range_minutes,
            "metrics": {},
            "alerts": self.alerts[-20:],  # Last 20 alerts
            "status": "healthy" if not self._has_critical_alerts() else "degraded"
        }
        
        # Get metric summaries
        for name, metric in self.metrics.items():
            recent_points = metric.get_recent_points(time_range_minutes)
            
            if recent_points:
                dashboard_data["metrics"][name] = {
                    "current_value": metric.current_value,
                    "unit": metric.unit,
                    "description": metric.description,
                    "average": metric.get_average(time_range_minutes),
                    "max": metric.get_max(time_range_minutes),
                    "min": metric.get_min(time_range_minutes),
                    "data_points_count": len(recent_points),
                    "trend": self._calculate_trend(recent_points)
                }
        
        return dashboard_data
    
    def _calculate_trend(self, data_points: List[MetricPoint]) -> str:
        """Calculate trend direction for data points."""
        if len(data_points) < 2:
            return "stable"
        
        # Compare first half with second half
        mid_point = len(data_points) // 2
        first_half_avg = sum(p.value for p in data_points[:mid_point]) / mid_point
        second_half_avg = sum(p.value for p in data_points[mid_point:]) / (len(data_points) - mid_point)
        
        diff_percent = ((second_half_avg - first_half_avg) / first_half_avg) * 100 if first_half_avg != 0 else 0
        
        if diff_percent > 10:
            return "increasing"
        elif diff_percent < -10:
            return "decreasing"
        else:
            return "stable"
    
    def enable_monitoring(self) -> None:
        """Enable monitoring."""
        self.monitoring_enabled = True
        logger.info("Performance monitoring enabled")
    
    def disable_monitoring(self) -> None:
        """Disable monitoring."""
        self.monitoring_enabled = False
        logger.info("Performance monitoring disabled")
    
    def set_alert_threshold(self, metric_name: str, threshold: float) -> None:
        """Set alert threshold for a specific metric."""
        self.alert_thresholds[metric_name] = threshold
        logger.info(f"Alert threshold for {metric_name} set to {threshold}")
    
    def clear_alerts(self) -> None:
        """Clear all alerts."""
        self.alerts.clear()
        logger.info("All alerts cleared")


# Global monitoring dashboard instance
monitoring_dashboard = MonitoringDashboard()