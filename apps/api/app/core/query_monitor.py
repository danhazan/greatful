"""
Query performance monitoring and optimization utilities.
"""

import time
import logging
from typing import Dict, Any, Optional, List
from functools import wraps
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, event
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


class QueryPerformanceMonitor:
    """Monitor and log query performance metrics."""
    
    def __init__(self):
        self.query_stats: Dict[str, Dict[str, Any]] = {}
        self.slow_query_threshold = 1.0  # seconds
        self.enabled = True
    
    def record_query(
        self, 
        query_name: str, 
        execution_time: float, 
        row_count: Optional[int] = None
    ):
        """Record query execution statistics."""
        if not self.enabled:
            return
        
        if query_name not in self.query_stats:
            self.query_stats[query_name] = {
                "count": 0,
                "total_time": 0.0,
                "min_time": float('inf'),
                "max_time": 0.0,
                "avg_time": 0.0,
                "slow_queries": 0,
                "total_rows": 0
            }
        
        stats = self.query_stats[query_name]
        stats["count"] += 1
        stats["total_time"] += execution_time
        stats["min_time"] = min(stats["min_time"], execution_time)
        stats["max_time"] = max(stats["max_time"], execution_time)
        stats["avg_time"] = stats["total_time"] / stats["count"]
        
        if execution_time > self.slow_query_threshold:
            stats["slow_queries"] += 1
            logger.warning(
                f"Slow query detected: {query_name} took {execution_time:.3f}s "
                f"(threshold: {self.slow_query_threshold}s)"
            )
        
        if row_count is not None:
            stats["total_rows"] += row_count
    
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