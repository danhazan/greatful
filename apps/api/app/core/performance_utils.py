"""
Performance monitoring and optimization utilities for database operations.
"""

import asyncio
import time
import logging
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.query_monitor import query_monitor, get_query_performance_report

logger = logging.getLogger(__name__)


class DatabasePerformanceMonitor:
    """Monitor database performance and provide optimization recommendations."""
    
    def __init__(self):
        self.connection_pool_stats = {}
        self.slow_query_threshold = 1.0  # seconds
        self.enabled = True
    
    async def check_connection_health(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Check database connection health and performance metrics.
        
        Args:
            db: Database session
            
        Returns:
            Dict containing connection health metrics
        """
        try:
            start_time = time.time()
            
            # Simple connectivity test
            await db.execute(text("SELECT 1"))
            
            connection_time = time.time() - start_time
            
            # Get connection pool stats (if available)
            pool_stats = {}
            if hasattr(db.bind, 'pool'):
                pool = db.bind.pool
                pool_stats = {
                    "size": pool.size(),
                    "checked_in": pool.checkedin(),
                    "checked_out": pool.checkedout(),
                    "overflow": pool.overflow(),
                    "invalid": pool.invalid()
                }
            
            return {
                "status": "healthy",
                "connection_time_ms": connection_time * 1000,
                "pool_stats": pool_stats,
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }
    
    async def analyze_table_performance(
        self, 
        db: AsyncSession, 
        table_name: str
    ) -> Dict[str, Any]:
        """
        Analyze performance characteristics of a specific table.
        
        Args:
            db: Database session
            table_name: Name of the table to analyze
            
        Returns:
            Dict containing performance analysis
        """
        try:
            # Get table size and row count
            size_query = text("""
                SELECT 
                    pg_size_pretty(pg_total_relation_size(:table_name)) as total_size,
                    pg_size_pretty(pg_relation_size(:table_name)) as table_size,
                    pg_size_pretty(pg_indexes_size(:table_name)) as indexes_size,
                    (SELECT reltuples::BIGINT FROM pg_class WHERE relname = :table_name) as estimated_rows
            """)
            
            result = await db.execute(size_query, {"table_name": table_name})
            size_info = result.fetchone()
            
            # Get index usage statistics
            index_query = text("""
                SELECT 
                    indexrelname as index_name,
                    idx_tup_read,
                    idx_tup_fetch,
                    idx_scan
                FROM pg_stat_user_indexes 
                WHERE relname = :table_name
                ORDER BY idx_scan DESC
            """)
            
            index_result = await db.execute(index_query, {"table_name": table_name})
            index_stats = [dict(row._mapping) for row in index_result.fetchall()]
            
            # Get sequential scan statistics
            seq_scan_query = text("""
                SELECT 
                    seq_scan,
                    seq_tup_read,
                    idx_scan,
                    idx_tup_fetch,
                    n_tup_ins,
                    n_tup_upd,
                    n_tup_del
                FROM pg_stat_user_tables 
                WHERE relname = :table_name
            """)
            
            seq_result = await db.execute(seq_scan_query, {"table_name": table_name})
            seq_stats = seq_result.fetchone()
            
            # Calculate performance metrics
            performance_score = 100  # Start with perfect score
            recommendations = []
            
            if seq_stats:
                # Check for excessive sequential scans
                if seq_stats.seq_scan > 0 and seq_stats.idx_scan > 0:
                    seq_ratio = seq_stats.seq_scan / (seq_stats.seq_scan + seq_stats.idx_scan)
                    if seq_ratio > 0.3:  # More than 30% sequential scans
                        performance_score -= 20
                        recommendations.append(
                            f"High sequential scan ratio ({seq_ratio:.1%}). Consider adding indexes."
                        )
                
                # Check for unused indexes
                unused_indexes = [idx for idx in index_stats if idx['idx_scan'] == 0]
                if unused_indexes:
                    performance_score -= 10
                    recommendations.append(
                        f"Found {len(unused_indexes)} unused indexes. Consider dropping them."
                    )
            
            return {
                "table_name": table_name,
                "size_info": {
                    "total_size": size_info.total_size if size_info else "Unknown",
                    "table_size": size_info.table_size if size_info else "Unknown",
                    "indexes_size": size_info.indexes_size if size_info else "Unknown",
                    "estimated_rows": size_info.estimated_rows if size_info else 0
                },
                "index_stats": index_stats,
                "scan_stats": dict(seq_stats._mapping) if seq_stats else {},
                "performance_score": performance_score,
                "recommendations": recommendations
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze table performance for {table_name}: {e}")
            return {
                "table_name": table_name,
                "error": str(e),
                "performance_score": 0,
                "recommendations": ["Unable to analyze table performance"]
            }
    
    async def get_slow_queries(self, db: AsyncSession, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get slow queries from PostgreSQL statistics.
        
        Args:
            db: Database session
            limit: Maximum number of queries to return
            
        Returns:
            List of slow query information
        """
        try:
            # This requires pg_stat_statements extension
            slow_query = text("""
                SELECT 
                    query,
                    calls,
                    total_exec_time,
                    mean_exec_time,
                    max_exec_time,
                    rows
                FROM pg_stat_statements 
                WHERE mean_exec_time > :threshold
                ORDER BY mean_exec_time DESC
                LIMIT :limit
            """)
            
            result = await db.execute(slow_query, {
                "threshold": self.slow_query_threshold * 1000,  # Convert to ms
                "limit": limit
            })
            
            return [dict(row._mapping) for row in result.fetchall()]
            
        except Exception as e:
            logger.warning(f"Could not retrieve slow queries (pg_stat_statements may not be enabled): {e}")
            return []
    
    def generate_performance_report(self) -> Dict[str, Any]:
        """Generate a comprehensive performance report."""
        query_report = get_query_performance_report()
        
        return {
            "timestamp": time.time(),
            "query_performance": query_report,
            "recommendations": self._generate_performance_recommendations(query_report),
            "monitoring_enabled": self.enabled
        }
    
    def _generate_performance_recommendations(self, query_report: Dict[str, Any]) -> List[str]:
        """Generate performance recommendations based on query statistics."""
        recommendations = []
        
        summary = query_report.get("summary", {})
        slow_queries = query_report.get("slow_queries", [])
        
        # Check overall performance
        if summary.get("slow_queries_percentage", 0) > 10:
            recommendations.append(
                "High percentage of slow queries detected. Consider query optimization or indexing."
            )
        
        if summary.get("average_query_time", 0) > 0.5:
            recommendations.append(
                "Average query time is high. Consider database optimization."
            )
        
        # Check for specific problematic queries
        for slow_query in slow_queries[:3]:  # Top 3 slow queries
            if slow_query["slow_percentage"] > 50:
                recommendations.append(
                    f"Query '{slow_query['query_name']}' is consistently slow. "
                    f"Consider optimization or caching."
                )
        
        # General recommendations
        if summary.get("total_queries", 0) > 1000:
            recommendations.append(
                "High query volume detected. Consider implementing query result caching."
            )
        
        return recommendations


# Global performance monitor instance
db_performance_monitor = DatabasePerformanceMonitor()


@asynccontextmanager
async def performance_monitoring(operation_name: str):
    """Context manager for monitoring operation performance."""
    start_time = time.time()
    try:
        yield
    finally:
        execution_time = time.time() - start_time
        if execution_time > db_performance_monitor.slow_query_threshold:
            logger.warning(
                f"Slow operation detected: {operation_name} took {execution_time:.3f}s"
            )


async def run_performance_diagnostics(db: AsyncSession) -> Dict[str, Any]:
    """
    Run comprehensive performance diagnostics.
    
    Args:
        db: Database session
        
    Returns:
        Dict containing diagnostic results
    """
    diagnostics = {
        "timestamp": time.time(),
        "connection_health": await db_performance_monitor.check_connection_health(db),
        "query_performance": db_performance_monitor.generate_performance_report(),
        "table_analysis": {}
    }
    
    # Analyze key tables
    key_tables = ["users", "posts", "emoji_reactions", "notifications", "likes"]
    
    for table in key_tables:
        try:
            analysis = await db_performance_monitor.analyze_table_performance(db, table)
            diagnostics["table_analysis"][table] = analysis
        except Exception as e:
            logger.error(f"Failed to analyze table {table}: {e}")
            diagnostics["table_analysis"][table] = {"error": str(e)}
    
    # Get slow queries
    try:
        slow_queries = await db_performance_monitor.get_slow_queries(db)
        diagnostics["slow_queries"] = slow_queries
    except Exception as e:
        logger.error(f"Failed to get slow queries: {e}")
        diagnostics["slow_queries"] = []
    
    return diagnostics


def enable_performance_monitoring():
    """Enable performance monitoring."""
    db_performance_monitor.enabled = True
    query_monitor.enable()
    logger.info("Performance monitoring enabled")


def disable_performance_monitoring():
    """Disable performance monitoring."""
    db_performance_monitor.enabled = False
    query_monitor.disable()
    logger.info("Performance monitoring disabled")


def set_slow_query_threshold(threshold_seconds: float):
    """Set the slow query threshold."""
    db_performance_monitor.slow_query_threshold = threshold_seconds
    query_monitor.set_slow_query_threshold(threshold_seconds)
    logger.info(f"Slow query threshold set to {threshold_seconds}s")