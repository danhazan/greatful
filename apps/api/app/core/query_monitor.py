"""
Query performance monitoring and optimization utilities with production alerting.
"""

import time
import logging
import os
import json
from typing import Dict, Any, Optional, List, Callable
from functools import wraps
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, UTC
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, event
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Production monitoring configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
SLOW_QUERY_THRESHOLDS = {
    "development": 1.0,  # 1 second
    "staging": 0.5,      # 500ms
    "production": 0.3    # 300ms
}

ALERT_THRESHOLDS = {
    "slow_query_rate": 0.1,      # 10% of queries are slow
    "very_slow_query": 5.0,      # Individual query > 5 seconds
    "query_failure_rate": 0.05,  # 5% of queries fail
    "connection_pool_usage": 0.8  # 80% pool utilization
}


class QueryPerformanceMonitor:
    """Monitor and log query performance metrics with production alerting."""
    
    def __init__(self):
        self.query_stats: Dict[str, Dict[str, Any]] = {}
        self.slow_query_threshold = SLOW_QUERY_THRESHOLDS.get(ENVIRONMENT, 1.0)
        self.enabled = True
        self.alert_callbacks: List[Callable] = []
        self.recent_queries: List[Dict[str, Any]] = []
        self.max_recent_queries = 1000
        self.alert_cooldown: Dict[str, datetime] = {}
        self.alert_cooldown_minutes = 5
    
    def record_query(
        self, 
        query_name: str, 
        execution_time: float, 
        row_count: Optional[int] = None,
        success: bool = True,
        error: Optional[str] = None
    ):
        """Record query execution statistics with enhanced monitoring."""
        if not self.enabled:
            return
        
        # Initialize stats if needed
        if query_name not in self.query_stats:
            self.query_stats[query_name] = {
                "count": 0,
                "total_time": 0.0,
                "min_time": float('inf'),
                "max_time": 0.0,
                "avg_time": 0.0,
                "slow_queries": 0,
                "failed_queries": 0,
                "total_rows": 0,
                "last_executed": None
            }
        
        stats = self.query_stats[query_name]
        stats["count"] += 1
        stats["last_executed"] = datetime.now(UTC)
        
        if success:
            stats["total_time"] += execution_time
            stats["min_time"] = min(stats["min_time"], execution_time)
            stats["max_time"] = max(stats["max_time"], execution_time)
            stats["avg_time"] = stats["total_time"] / (stats["count"] - stats["failed_queries"])
            
            if row_count is not None:
                stats["total_rows"] += row_count
        else:
            stats["failed_queries"] += 1
        
        # Record recent query for trend analysis
        recent_query = {
            "query_name": query_name,
            "execution_time": execution_time,
            "timestamp": datetime.now(UTC),
            "success": success,
            "error": error,
            "row_count": row_count
        }
        self.recent_queries.append(recent_query)
        
        # Maintain recent queries limit
        if len(self.recent_queries) > self.max_recent_queries:
            self.recent_queries = self.recent_queries[-self.max_recent_queries:]
        
        # Check for alerts
        self._check_alerts(query_name, execution_time, success)
    
    def _check_alerts(self, query_name: str, execution_time: float, success: bool):
        """Check if any alert conditions are met."""
        current_time = datetime.now(UTC)
        
        # Very slow query alert
        if execution_time > ALERT_THRESHOLDS["very_slow_query"]:
            alert_key = f"very_slow_query_{query_name}"
            if self._should_alert(alert_key, current_time):
                self._trigger_alert("very_slow_query", {
                    "query_name": query_name,
                    "execution_time": execution_time,
                    "threshold": ALERT_THRESHOLDS["very_slow_query"]
                })
        
        # Slow query rate alert
        stats = self.query_stats[query_name]
        if stats["count"] >= 10:  # Only check after sufficient samples
            slow_rate = stats["slow_queries"] / stats["count"]
            if slow_rate > ALERT_THRESHOLDS["slow_query_rate"]:
                alert_key = f"slow_query_rate_{query_name}"
                if self._should_alert(alert_key, current_time):
                    self._trigger_alert("slow_query_rate", {
                        "query_name": query_name,
                        "slow_rate": slow_rate,
                        "threshold": ALERT_THRESHOLDS["slow_query_rate"],
                        "total_queries": stats["count"],
                        "slow_queries": stats["slow_queries"]
                    })
        
        # Query failure rate alert
        if not success and stats["count"] >= 10:
            failure_rate = stats["failed_queries"] / stats["count"]
            if failure_rate > ALERT_THRESHOLDS["query_failure_rate"]:
                alert_key = f"query_failure_rate_{query_name}"
                if self._should_alert(alert_key, current_time):
                    self._trigger_alert("query_failure_rate", {
                        "query_name": query_name,
                        "failure_rate": failure_rate,
                        "threshold": ALERT_THRESHOLDS["query_failure_rate"],
                        "total_queries": stats["count"],
                        "failed_queries": stats["failed_queries"]
                    })
    
    def _should_alert(self, alert_key: str, current_time: datetime) -> bool:
        """Check if enough time has passed since last alert."""
        if alert_key in self.alert_cooldown:
            time_since_last = current_time - self.alert_cooldown[alert_key]
            if time_since_last.total_seconds() < (self.alert_cooldown_minutes * 60):
                return False
        
        self.alert_cooldown[alert_key] = current_time
        return True
    
    def _trigger_alert(self, alert_type: str, data: Dict[str, Any]):
        """Trigger alert callbacks and log alert."""
        alert_data = {
            "alert_type": alert_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "environment": ENVIRONMENT,
            "data": data
        }
        
        # Log alert
        logger.error(f"PERFORMANCE ALERT: {alert_type} - {json.dumps(data)}")
        
        # Call registered alert callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert_data)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")
    
    def add_alert_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """Add a callback function to be called when alerts are triggered."""
        self.alert_callbacks.append(callback)
    
    def get_recent_performance_trends(self, minutes: int = 60) -> Dict[str, Any]:
        """Get performance trends for the last N minutes."""
        cutoff_time = datetime.now(UTC) - timedelta(minutes=minutes)
        recent = [q for q in self.recent_queries if q["timestamp"] > cutoff_time]
        
        if not recent:
            return {"period_minutes": minutes, "queries": 0}
        
        total_queries = len(recent)
        successful_queries = [q for q in recent if q["success"]]
        failed_queries = [q for q in recent if not q["success"]]
        slow_queries = [q for q in successful_queries if q["execution_time"] > self.slow_query_threshold]
        
        avg_time = sum(q["execution_time"] for q in successful_queries) / len(successful_queries) if successful_queries else 0
        
        return {
            "period_minutes": minutes,
            "total_queries": total_queries,
            "successful_queries": len(successful_queries),
            "failed_queries": len(failed_queries),
            "slow_queries": len(slow_queries),
            "success_rate": len(successful_queries) / total_queries if total_queries > 0 else 0,
            "slow_query_rate": len(slow_queries) / len(successful_queries) if successful_queries else 0,
            "average_execution_time": avg_time,
            "queries_per_minute": total_queries / minutes if minutes > 0 else 0
        }
    
    def get_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get all query statistics."""
        return self.query_stats.copy()
    
    def get_slow_queries(self) -> List[Dict[str, Any]]:
        """Get queries that frequently exceed the slow query threshold."""
        slow_queries = []
        for query_name, stats in self.query_stats.items():
            if stats["slow_queries"] > 0:
                slow_queries.append({
                    "query_name": query_name,
                    "slow_count": stats["slow_queries"],
                    "total_count": stats["count"],
                    "slow_percentage": (stats["slow_queries"] / stats["count"]) * 100,
                    "max_time": stats["max_time"],
                    "avg_time": stats["avg_time"]
                })
        
        return sorted(slow_queries, key=lambda x: x["slow_percentage"], reverse=True)
    
    def reset_stats(self):
        """Reset all query statistics."""
        self.query_stats.clear()
    
    def set_slow_query_threshold(self, threshold: float):
        """Set the slow query threshold in seconds."""
        self.slow_query_threshold = threshold
    
    def enable(self):
        """Enable query monitoring."""
        self.enabled = True
    
    def disable(self):
        """Disable query monitoring."""
        self.enabled = False


# Global query monitor instance
query_monitor = QueryPerformanceMonitor()


def monitor_query(query_name: str):
    """Decorator to monitor query performance."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                # Try to get row count from result
                row_count = None
                if hasattr(result, 'rowcount'):
                    row_count = result.rowcount
                elif hasattr(result, 'scalars'):
                    try:
                        scalars = result.scalars().all()
                        row_count = len(scalars) if scalars else 0
                    except:
                        pass
                
                query_monitor.record_query(query_name, execution_time, row_count)
                
                logger.debug(
                    f"Query '{query_name}' executed in {execution_time:.3f}s"
                    + (f" ({row_count} rows)" if row_count is not None else "")
                )
                
                return result
            except Exception as e:
                execution_time = time.time() - start_time
                logger.error(f"Query '{query_name}' failed after {execution_time:.3f}s: {e}")
                raise
        return wrapper
    return decorator


@asynccontextmanager
async def query_timer(query_name: str):
    """Context manager for timing queries."""
    start_time = time.time()
    try:
        yield
    finally:
        execution_time = time.time() - start_time
        query_monitor.record_query(query_name, execution_time)


class QueryOptimizer:
    """Utilities for query optimization and analysis."""
    
    @staticmethod
    async def analyze_query_plan(
        db: AsyncSession, 
        query: str, 
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze query execution plan.
        
        Args:
            db: Database session
            query: SQL query to analyze
            params: Query parameters
            
        Returns:
            Dict containing query plan analysis
        """
        try:
            # PostgreSQL EXPLAIN ANALYZE
            explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"
            
            if params:
                result = await db.execute(text(explain_query), params)
            else:
                result = await db.execute(text(explain_query))
            
            plan_data = result.fetchone()[0]
            
            # Extract key metrics
            execution_time = plan_data[0]["Execution Time"]
            planning_time = plan_data[0]["Planning Time"]
            
            return {
                "execution_time_ms": execution_time,
                "planning_time_ms": planning_time,
                "total_time_ms": execution_time + planning_time,
                "plan": plan_data[0]["Plan"],
                "triggers": plan_data[0].get("Triggers", [])
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze query plan: {e}")
            return {"error": str(e)}
    
    @staticmethod
    async def suggest_indexes(
        db: AsyncSession, 
        table_name: str
    ) -> List[Dict[str, Any]]:
        """
        Suggest indexes for a table based on query patterns.
        
        Args:
            db: Database session
            table_name: Name of the table to analyze
            
        Returns:
            List of index suggestions
        """
        try:
            # Get table statistics
            stats_query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    attname,
                    n_distinct,
                    correlation
                FROM pg_stats 
                WHERE tablename = :table_name
                ORDER BY n_distinct DESC
            """)
            
            result = await db.execute(stats_query, {"table_name": table_name})
            stats = result.fetchall()
            
            suggestions = []
            for stat in stats:
                # Suggest index for columns with high selectivity
                if stat.n_distinct and stat.n_distinct > 10:
                    suggestions.append({
                        "column": stat.attname,
                        "type": "btree",
                        "reason": f"High selectivity (n_distinct: {stat.n_distinct})",
                        "sql": f"CREATE INDEX idx_{table_name}_{stat.attname} ON {table_name} ({stat.attname});"
                    })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Failed to suggest indexes for {table_name}: {e}")
            return []
    
    @staticmethod
    async def get_table_stats(
        db: AsyncSession, 
        table_name: str
    ) -> Dict[str, Any]:
        """
        Get comprehensive table statistics.
        
        Args:
            db: Database session
            table_name: Name of the table
            
        Returns:
            Dict containing table statistics
        """
        try:
            # Get basic table info
            table_info_query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    tableowner,
                    tablespace,
                    hasindexes,
                    hasrules,
                    hastriggers
                FROM pg_tables 
                WHERE tablename = :table_name
            """)
            
            # Get table size
            size_query = text("""
                SELECT 
                    pg_size_pretty(pg_total_relation_size(:table_name)) as total_size,
                    pg_size_pretty(pg_relation_size(:table_name)) as table_size,
                    pg_size_pretty(pg_indexes_size(:table_name)) as indexes_size
            """)
            
            # Get row count estimate
            count_query = text("""
                SELECT reltuples::BIGINT as estimated_rows
                FROM pg_class 
                WHERE relname = :table_name
            """)
            
            table_info_result = await db.execute(table_info_query, {"table_name": table_name})
            size_result = await db.execute(size_query, {"table_name": table_name})
            count_result = await db.execute(count_query, {"table_name": table_name})
            
            table_info = table_info_result.fetchone()
            size_info = size_result.fetchone()
            count_info = count_result.fetchone()
            
            return {
                "table_name": table_name,
                "schema": table_info.schemaname if table_info else None,
                "owner": table_info.tableowner if table_info else None,
                "has_indexes": table_info.hasindexes if table_info else False,
                "has_rules": table_info.hasrules if table_info else False,
                "has_triggers": table_info.hastriggers if table_info else False,
                "total_size": size_info.total_size if size_info else None,
                "table_size": size_info.table_size if size_info else None,
                "indexes_size": size_info.indexes_size if size_info else None,
                "estimated_rows": count_info.estimated_rows if count_info else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get table stats for {table_name}: {e}")
            return {"error": str(e)}


# SQLAlchemy event listeners for automatic query monitoring
@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Record query start time."""
    context._query_start_time = time.time()


@event.listens_for(Engine, "after_cursor_execute")
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Record query completion and log slow queries."""
    if hasattr(context, '_query_start_time'):
        execution_time = time.time() - context._query_start_time
        
        # Extract query type from statement
        query_type = statement.strip().split()[0].upper() if statement.strip() else "UNKNOWN"
        
        # Log slow queries
        if execution_time > query_monitor.slow_query_threshold:
            logger.warning(
                f"Slow {query_type} query: {execution_time:.3f}s\n"
                f"Statement: {statement[:200]}{'...' if len(statement) > 200 else ''}"
            )
        
        # Record in monitor
        query_monitor.record_query(f"auto_{query_type.lower()}", execution_time)


def get_query_performance_report() -> Dict[str, Any]:
    """Generate a comprehensive query performance report."""
    stats = query_monitor.get_stats()
    slow_queries = query_monitor.get_slow_queries()
    
    total_queries = sum(stat["count"] for stat in stats.values())
    total_time = sum(stat["total_time"] for stat in stats.values())
    total_slow = sum(stat["slow_queries"] for stat in stats.values())
    
    return {
        "summary": {
            "total_queries": total_queries,
            "total_execution_time": total_time,
            "average_query_time": total_time / total_queries if total_queries > 0 else 0,
            "slow_queries_count": total_slow,
            "slow_queries_percentage": (total_slow / total_queries * 100) if total_queries > 0 else 0
        },
        "query_stats": stats,
        "slow_queries": slow_queries,
        "recommendations": _generate_recommendations(stats, slow_queries)
    }


def _generate_recommendations(
    stats: Dict[str, Dict[str, Any]], 
    slow_queries: List[Dict[str, Any]]
) -> List[str]:
    """Generate performance recommendations based on query statistics."""
    recommendations = []
    
    # Check for frequently slow queries
    for slow_query in slow_queries:
        if slow_query["slow_percentage"] > 50:
            recommendations.append(
                f"Query '{slow_query['query_name']}' is slow {slow_query['slow_percentage']:.1f}% "
                f"of the time. Consider optimizing or adding indexes."
            )
    
    # Check for high-frequency queries
    for query_name, stat in stats.items():
        if stat["count"] > 100 and stat["avg_time"] > 0.1:
            recommendations.append(
                f"Query '{query_name}' is executed frequently ({stat['count']} times) "
                f"with average time {stat['avg_time']:.3f}s. Consider caching or optimization."
            )
    
    # General recommendations
    total_queries = sum(stat["count"] for stat in stats.values())
    if total_queries > 1000:
        recommendations.append(
            "High query volume detected. Consider implementing query result caching."
        )
    
    return recommendations