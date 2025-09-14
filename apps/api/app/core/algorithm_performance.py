"""
Algorithm Performance Monitoring and Optimization Utilities

This module provides performance monitoring, caching, and optimization utilities
specifically for the enhanced algorithm service to maintain <300ms feed loading.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Callable
from functools import wraps
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics for algorithm operations."""
    operation_name: str
    execution_count: int = 0
    total_time_ms: float = 0.0
    min_time_ms: float = float('inf')
    max_time_ms: float = 0.0
    avg_time_ms: float = 0.0
    slow_operations: int = 0
    recent_times: deque = field(default_factory=lambda: deque(maxlen=100))
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AlgorithmPerformanceMonitor:
    """
    Performance monitor specifically for algorithm operations.
    
    Tracks execution times, identifies bottlenecks, and provides
    optimization recommendations to maintain <300ms feed loading.
    """
    
    def __init__(self, target_time_ms: float = 300.0):
        self.target_time_ms = target_time_ms
        self.slow_threshold_ms = target_time_ms * 0.8  # 80% of target as warning
        self.metrics: Dict[str, PerformanceMetrics] = {}
        self.enabled = True
        
        # Performance alerts
        self.alert_threshold = 5  # Alert after 5 consecutive slow operations
        self.consecutive_slow_counts: Dict[str, int] = defaultdict(int)
    
    def record_operation(self, operation_name: str, execution_time_ms: float) -> None:
        """Record performance metrics for an operation."""
        if not self.enabled:
            return
        
        if operation_name not in self.metrics:
            self.metrics[operation_name] = PerformanceMetrics(operation_name=operation_name)
        
        metrics = self.metrics[operation_name]
        metrics.execution_count += 1
        metrics.total_time_ms += execution_time_ms
        metrics.min_time_ms = min(metrics.min_time_ms, execution_time_ms)
        metrics.max_time_ms = max(metrics.max_time_ms, execution_time_ms)
        metrics.avg_time_ms = metrics.total_time_ms / metrics.execution_count
        metrics.recent_times.append(execution_time_ms)
        metrics.last_updated = datetime.now(timezone.utc)
        
        # Track slow operations
        if execution_time_ms > self.slow_threshold_ms:
            metrics.slow_operations += 1
            self.consecutive_slow_counts[operation_name] += 1
            
            # Alert on consecutive slow operations
            if self.consecutive_slow_counts[operation_name] >= self.alert_threshold:
                logger.warning(
                    f"Performance alert: {operation_name} has been slow "
                    f"{self.consecutive_slow_counts[operation_name]} consecutive times. "
                    f"Latest: {execution_time_ms:.1f}ms (target: {self.target_time_ms}ms)"
                )
        else:
            self.consecutive_slow_counts[operation_name] = 0
        
        # Log individual slow operations
        if execution_time_ms > self.target_time_ms:
            logger.warning(
                f"Slow algorithm operation: {operation_name} took {execution_time_ms:.1f}ms "
                f"(target: {self.target_time_ms}ms, threshold: {self.slow_threshold_ms:.1f}ms)"
            )
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        report = {
            "target_time_ms": self.target_time_ms,
            "slow_threshold_ms": self.slow_threshold_ms,
            "total_operations": sum(m.execution_count for m in self.metrics.values()),
            "operations": {},
            "summary": {
                "slowest_operation": None,
                "fastest_operation": None,
                "most_frequent_operation": None,
                "total_slow_operations": sum(m.slow_operations for m in self.metrics.values())
            },
            "recommendations": []
        }
        
        slowest_avg = 0
        fastest_avg = float('inf')
        most_frequent_count = 0
        
        for name, metrics in self.metrics.items():
            # Calculate recent performance (last 10 operations)
            recent_times = list(metrics.recent_times)[-10:]
            recent_avg = sum(recent_times) / len(recent_times) if recent_times else 0
            
            operation_data = {
                "execution_count": metrics.execution_count,
                "total_time_ms": metrics.total_time_ms,
                "avg_time_ms": metrics.avg_time_ms,
                "min_time_ms": metrics.min_time_ms if metrics.min_time_ms != float('inf') else 0,
                "max_time_ms": metrics.max_time_ms,
                "slow_operations": metrics.slow_operations,
                "slow_percentage": (metrics.slow_operations / metrics.execution_count * 100) if metrics.execution_count > 0 else 0,
                "recent_avg_ms": recent_avg,
                "last_updated": metrics.last_updated.isoformat()
            }
            
            report["operations"][name] = operation_data
            
            # Track summary statistics
            if metrics.avg_time_ms > slowest_avg:
                slowest_avg = metrics.avg_time_ms
                report["summary"]["slowest_operation"] = name
            
            if metrics.avg_time_ms < fastest_avg:
                fastest_avg = metrics.avg_time_ms
                report["summary"]["fastest_operation"] = name
            
            if metrics.execution_count > most_frequent_count:
                most_frequent_count = metrics.execution_count
                report["summary"]["most_frequent_operation"] = name
        
        # Generate recommendations
        report["recommendations"] = self._generate_recommendations()
        
        return report
    
    def _generate_recommendations(self) -> List[str]:
        """Generate performance optimization recommendations."""
        recommendations = []
        
        for name, metrics in self.metrics.items():
            slow_percentage = (metrics.slow_operations / metrics.execution_count * 100) if metrics.execution_count > 0 else 0
            
            # High slow operation percentage
            if slow_percentage > 30:
                recommendations.append(
                    f"Operation '{name}' is slow {slow_percentage:.1f}% of the time. "
                    f"Consider optimization or caching."
                )
            
            # Consistently slow operations
            if metrics.avg_time_ms > self.target_time_ms:
                recommendations.append(
                    f"Operation '{name}' averages {metrics.avg_time_ms:.1f}ms, "
                    f"exceeding target of {self.target_time_ms}ms. Requires optimization."
                )
            
            # High frequency operations that could benefit from caching
            if metrics.execution_count > 100 and metrics.avg_time_ms > 50:
                recommendations.append(
                    f"Operation '{name}' is executed frequently ({metrics.execution_count} times) "
                    f"with {metrics.avg_time_ms:.1f}ms average. Consider caching."
                )
        
        # General recommendations
        total_operations = sum(m.execution_count for m in self.metrics.values())
        total_slow = sum(m.slow_operations for m in self.metrics.values())
        
        if total_operations > 0:
            overall_slow_percentage = (total_slow / total_operations * 100)
            if overall_slow_percentage > 20:
                recommendations.append(
                    f"Overall slow operation rate is {overall_slow_percentage:.1f}%. "
                    f"Consider system-wide optimization."
                )
        
        return recommendations
    
    def reset_metrics(self) -> None:
        """Reset all performance metrics."""
        self.metrics.clear()
        self.consecutive_slow_counts.clear()
        logger.info("Algorithm performance metrics reset")
    
    def enable(self) -> None:
        """Enable performance monitoring."""
        self.enabled = True
    
    def disable(self) -> None:
        """Disable performance monitoring."""
        self.enabled = False


# Global performance monitor instance
algorithm_performance_monitor = AlgorithmPerformanceMonitor()


def monitor_algorithm_performance(operation_name: str):
    """
    Decorator to monitor algorithm operation performance.
    
    Args:
        operation_name: Name of the operation being monitored
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                execution_time_ms = (time.time() - start_time) * 1000
                algorithm_performance_monitor.record_operation(operation_name, execution_time_ms)
                return result
            except Exception as e:
                execution_time_ms = (time.time() - start_time) * 1000
                algorithm_performance_monitor.record_operation(f"{operation_name}_error", execution_time_ms)
                logger.error(f"Algorithm operation '{operation_name}' failed after {execution_time_ms:.1f}ms: {e}")
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                execution_time_ms = (time.time() - start_time) * 1000
                algorithm_performance_monitor.record_operation(operation_name, execution_time_ms)
                return result
            except Exception as e:
                execution_time_ms = (time.time() - start_time) * 1000
                algorithm_performance_monitor.record_operation(f"{operation_name}_error", execution_time_ms)
                logger.error(f"Algorithm operation '{operation_name}' failed after {execution_time_ms:.1f}ms: {e}")
                raise
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    
    return decorator


@asynccontextmanager
async def algorithm_performance_context(operation_name: str):
    """
    Context manager for monitoring algorithm performance.
    
    Args:
        operation_name: Name of the operation being monitored
    """
    start_time = time.time()
    try:
        yield
    finally:
        execution_time_ms = (time.time() - start_time) * 1000
        algorithm_performance_monitor.record_operation(operation_name, execution_time_ms)


class CacheManager:
    """
    Cache manager for algorithm data with TTL and performance optimization.
    """
    
    def __init__(self):
        self.caches: Dict[str, Dict[str, Any]] = {}
        self.cache_ttls: Dict[str, float] = {}
        self.cache_timestamps: Dict[str, Dict[str, datetime]] = {}
        self.hit_counts: Dict[str, int] = defaultdict(int)
        self.miss_counts: Dict[str, int] = defaultdict(int)
    
    def set_cache_ttl(self, cache_name: str, ttl_seconds: float) -> None:
        """Set TTL for a specific cache."""
        self.cache_ttls[cache_name] = ttl_seconds
        if cache_name not in self.caches:
            self.caches[cache_name] = {}
            self.cache_timestamps[cache_name] = {}
    
    def get(self, cache_name: str, key: str) -> Optional[Any]:
        """Get value from cache with TTL check."""
        if cache_name not in self.caches:
            self.miss_counts[cache_name] += 1
            return None
        
        if key not in self.caches[cache_name]:
            self.miss_counts[cache_name] += 1
            return None
        
        # Check TTL
        if cache_name in self.cache_ttls:
            timestamp = self.cache_timestamps[cache_name].get(key)
            if timestamp:
                age = (datetime.now(timezone.utc) - timestamp).total_seconds()
                if age > self.cache_ttls[cache_name]:
                    # Expired, remove from cache
                    del self.caches[cache_name][key]
                    del self.cache_timestamps[cache_name][key]
                    self.miss_counts[cache_name] += 1
                    return None
        
        self.hit_counts[cache_name] += 1
        return self.caches[cache_name][key]
    
    def set(self, cache_name: str, key: str, value: Any) -> None:
        """Set value in cache with timestamp."""
        if cache_name not in self.caches:
            self.caches[cache_name] = {}
            self.cache_timestamps[cache_name] = {}
        
        self.caches[cache_name][key] = value
        self.cache_timestamps[cache_name][key] = datetime.now(timezone.utc)
    
    def invalidate(self, cache_name: str, key: Optional[str] = None) -> None:
        """Invalidate cache entry or entire cache."""
        if cache_name not in self.caches:
            return
        
        if key is None:
            # Clear entire cache
            self.caches[cache_name].clear()
            self.cache_timestamps[cache_name].clear()
        else:
            # Clear specific key
            self.caches[cache_name].pop(key, None)
            self.cache_timestamps[cache_name].pop(key, None)
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics."""
        stats = {}
        
        for cache_name in self.caches:
            hits = self.hit_counts[cache_name]
            misses = self.miss_counts[cache_name]
            total_requests = hits + misses
            hit_rate = (hits / total_requests * 100) if total_requests > 0 else 0
            
            stats[cache_name] = {
                "size": len(self.caches[cache_name]),
                "hits": hits,
                "misses": misses,
                "hit_rate_percentage": hit_rate,
                "ttl_seconds": self.cache_ttls.get(cache_name, "No TTL")
            }
        
        return stats
    
    def clear_all_caches(self) -> None:
        """Clear all caches."""
        for cache_name in self.caches:
            self.caches[cache_name].clear()
            self.cache_timestamps[cache_name].clear()
        
        self.hit_counts.clear()
        self.miss_counts.clear()
        logger.info("All algorithm caches cleared")


# Global cache manager instance
algorithm_cache_manager = CacheManager()


def setup_algorithm_caches():
    """Setup algorithm-specific caches with appropriate TTLs."""
    algorithm_cache_manager.set_cache_ttl("engagement_data", 300)  # 5 minutes
    algorithm_cache_manager.set_cache_ttl("user_preferences", 1800)  # 30 minutes
    algorithm_cache_manager.set_cache_ttl("follow_relationships", 3600)  # 1 hour
    algorithm_cache_manager.set_cache_ttl("post_scores", 600)  # 10 minutes
    algorithm_cache_manager.set_cache_ttl("read_status", 300)  # 5 minutes
    
    logger.info("Algorithm caches initialized with TTL settings")


def get_algorithm_performance_report() -> Dict[str, Any]:
    """Get comprehensive algorithm performance report."""
    performance_report = algorithm_performance_monitor.get_performance_report()
    cache_stats = algorithm_cache_manager.get_cache_stats()
    
    return {
        "performance_metrics": performance_report,
        "cache_statistics": cache_stats,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# Initialize caches on module import
setup_algorithm_caches()