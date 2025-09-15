"""
Database index monitoring and optimization recommendations.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from dataclasses import dataclass

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class IndexRecommendation:
    """Represents an index recommendation."""
    table_name: str
    columns: List[str]
    index_type: str
    reason: str
    priority: str  # 'high', 'medium', 'low'
    estimated_benefit: str
    sql_command: str


@dataclass
class IndexUsageStats:
    """Represents index usage statistics."""
    schema_name: str
    table_name: str
    index_name: str
    index_size: str
    index_scans: int
    tuples_read: int
    tuples_fetched: int
    usage_ratio: float
    last_used: Optional[datetime]


class DatabaseIndexMonitor:
    """Monitor database indexes and provide optimization recommendations."""
    
    def __init__(self):
        self.monitoring_enabled = True
        self.recommendation_cache: Dict[str, List[IndexRecommendation]] = {}
        self.cache_ttl = timedelta(hours=1)
        self.last_analysis = {}
    
    async def get_index_usage_stats(self, db: AsyncSession) -> List[IndexUsageStats]:
        """Get comprehensive index usage statistics."""
        try:
            query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                    idx_scan as index_scans,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_fetched,
                    CASE 
                        WHEN idx_scan = 0 THEN 0
                        ELSE round((idx_tup_fetch::numeric / idx_tup_read::numeric) * 100, 2)
                    END as usage_ratio
                FROM pg_stat_user_indexes
                ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC
            """)
            
            result = await db.execute(query)
            rows = result.fetchall()
            
            stats = []
            for row in rows:
                stats.append(IndexUsageStats(
                    schema_name=row.schemaname,
                    table_name=row.tablename,
                    index_name=row.indexname,
                    index_size=row.index_size,
                    index_scans=row.index_scans,
                    tuples_read=row.tuples_read,
                    tuples_fetched=row.tuples_fetched,
                    usage_ratio=row.usage_ratio or 0.0,
                    last_used=None  # PostgreSQL doesn't track last used time by default
                ))
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get index usage stats: {e}")
            return []
    
    async def get_unused_indexes(self, db: AsyncSession, min_size_mb: float = 1.0) -> List[Dict[str, Any]]:
        """Find unused indexes that are consuming space."""
        try:
            query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                    pg_relation_size(indexrelid) as size_bytes,
                    idx_scan as scans
                FROM pg_stat_user_indexes
                WHERE idx_scan = 0 
                    AND pg_relation_size(indexrelid) > :min_size_bytes
                ORDER BY pg_relation_size(indexrelid) DESC
            """)
            
            min_size_bytes = int(min_size_mb * 1024 * 1024)
            result = await db.execute(query, {"min_size_bytes": min_size_bytes})
            rows = result.fetchall()
            
            unused_indexes = []
            for row in rows:
                unused_indexes.append({
                    "schema": row.schemaname,
                    "table": row.tablename,
                    "index": row.indexname,
                    "size": row.index_size,
                    "size_bytes": row.size_bytes,
                    "scans": row.scans,
                    "drop_sql": f"DROP INDEX IF EXISTS {row.schemaname}.{row.indexname};"
                })
            
            return unused_indexes
            
        except Exception as e:
            logger.error(f"Failed to find unused indexes: {e}")
            return []
    
    async def get_duplicate_indexes(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Find duplicate or redundant indexes."""
        try:
            query = text("""
                SELECT 
                    t.schemaname,
                    t.tablename,
                    array_agg(t.indexname) as index_names,
                    array_agg(pg_size_pretty(pg_relation_size(t.indexrelid))) as index_sizes,
                    array_agg(pg_relation_size(t.indexrelid)) as size_bytes,
                    t.index_columns
                FROM (
                    SELECT 
                        schemaname,
                        tablename,
                        indexname,
                        indexrelid,
                        array_to_string(array_agg(attname ORDER BY attnum), ',') as index_columns
                    FROM pg_stat_user_indexes
                    JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
                    JOIN pg_attribute ON pg_index.indrelid = pg_attribute.attrelid 
                        AND pg_attribute.attnum = ANY(pg_index.indkey)
                    GROUP BY schemaname, tablename, indexname, indexrelid
                ) t
                GROUP BY t.schemaname, t.tablename, t.index_columns
                HAVING count(*) > 1
                ORDER BY sum(pg_relation_size(t.indexrelid)) DESC
            """)
            
            result = await db.execute(query)
            rows = result.fetchall()
            
            duplicates = []
            for row in rows:
                duplicates.append({
                    "schema": row.schemaname,
                    "table": row.tablename,
                    "columns": row.index_columns,
                    "index_names": row.index_names,
                    "index_sizes": row.index_sizes,
                    "total_size_bytes": sum(row.size_bytes),
                    "recommendation": f"Consider keeping only one index on columns: {row.index_columns}"
                })
            
            return duplicates
            
        except Exception as e:
            logger.error(f"Failed to find duplicate indexes: {e}")
            return []
    
    async def analyze_query_patterns(self, db: AsyncSession) -> List[IndexRecommendation]:
        """Analyze query patterns and suggest new indexes."""
        try:
            # Get table statistics to identify high-activity tables
            table_stats_query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins + n_tup_upd + n_tup_del as total_modifications,
                    seq_scan,
                    seq_tup_read,
                    idx_scan,
                    idx_tup_fetch,
                    n_live_tup
                FROM pg_stat_user_tables
                WHERE n_live_tup > 100  -- Only tables with significant data
                ORDER BY seq_scan DESC, total_modifications DESC
                LIMIT 20
            """)
            
            result = await db.execute(table_stats_query)
            table_stats = result.fetchall()
            
            recommendations = []
            
            for table in table_stats:
                table_name = table.tablename
                
                # High sequential scan ratio suggests missing indexes
                if table.seq_scan > 0 and table.idx_scan > 0:
                    seq_ratio = table.seq_scan / (table.seq_scan + table.idx_scan)
                    if seq_ratio > 0.3:  # More than 30% sequential scans
                        recommendations.append(IndexRecommendation(
                            table_name=table_name,
                            columns=["<analyze_frequent_where_clauses>"],
                            index_type="btree",
                            reason=f"High sequential scan ratio ({seq_ratio:.1%})",
                            priority="high",
                            estimated_benefit="Reduce sequential scans",
                            sql_command=f"-- Analyze WHERE clauses for {table_name} to determine columns"
                        ))
                
                # Large tables with many modifications might benefit from partial indexes
                if table.total_modifications > 10000 and table.n_live_tup > 10000:
                    recommendations.append(IndexRecommendation(
                        table_name=table_name,
                        columns=["<status_or_active_column>"],
                        index_type="btree (partial)",
                        reason=f"High modification rate ({table.total_modifications} ops)",
                        priority="medium",
                        estimated_benefit="Improve query performance on active records",
                        sql_command=f"-- CREATE INDEX idx_{table_name}_active ON {table_name} (status) WHERE status = 'active';"
                    ))
            
            # Add specific recommendations for known application patterns
            app_specific_recommendations = await self._get_application_specific_recommendations(db)
            recommendations.extend(app_specific_recommendations)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to analyze query patterns: {e}")
            return []
    
    async def _get_application_specific_recommendations(self, db: AsyncSession) -> List[IndexRecommendation]:
        """Get recommendations specific to the Grateful application."""
        recommendations = []
        
        try:
            # Check if posts table has proper indexes for feed queries
            posts_indexes_query = text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'posts' AND schemaname = 'public'
            """)
            
            result = await db.execute(posts_indexes_query)
            existing_indexes = {row.indexname: row.indexdef for row in result.fetchall()}
            
            # Recommend feed optimization indexes
            if not any("created_at" in idx and "DESC" in idx for idx in existing_indexes.values()):
                recommendations.append(IndexRecommendation(
                    table_name="posts",
                    columns=["created_at DESC"],
                    index_type="btree",
                    reason="Feed queries order by created_at DESC",
                    priority="high",
                    estimated_benefit="Faster feed loading",
                    sql_command="CREATE INDEX CONCURRENTLY idx_posts_created_at_desc ON posts (created_at DESC);"
                ))
            
            # Recommend user-specific post queries
            if not any("user_id" in idx and "created_at" in idx for idx in existing_indexes.values()):
                recommendations.append(IndexRecommendation(
                    table_name="posts",
                    columns=["user_id", "created_at DESC"],
                    index_type="btree",
                    reason="User profile post queries",
                    priority="high",
                    estimated_benefit="Faster user profile loading",
                    sql_command="CREATE INDEX CONCURRENTLY idx_posts_user_created ON posts (user_id, created_at DESC);"
                ))
            
            # Check notifications table
            notifications_indexes_query = text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'notifications' AND schemaname = 'public'
            """)
            
            result = await db.execute(notifications_indexes_query)
            notif_indexes = {row.indexname: row.indexdef for row in result.fetchall()}
            
            if not any("user_id" in idx and "created_at" in idx for idx in notif_indexes.values()):
                recommendations.append(IndexRecommendation(
                    table_name="notifications",
                    columns=["user_id", "created_at DESC"],
                    index_type="btree",
                    reason="User notification queries",
                    priority="high",
                    estimated_benefit="Faster notification loading",
                    sql_command="CREATE INDEX CONCURRENTLY idx_notifications_user_created ON notifications (user_id, created_at DESC);"
                ))
            
            # Recommend partial index for unread notifications
            if not any("is_read" in idx and "WHERE" in idx for idx in notif_indexes.values()):
                recommendations.append(IndexRecommendation(
                    table_name="notifications",
                    columns=["user_id", "created_at DESC"],
                    index_type="btree (partial)",
                    reason="Unread notification queries are common",
                    priority="medium",
                    estimated_benefit="Faster unread notification counts",
                    sql_command="CREATE INDEX CONCURRENTLY idx_notifications_unread ON notifications (user_id, created_at DESC) WHERE is_read = false;"
                ))
            
            # Check follows table for relationship queries
            follows_indexes_query = text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'follows' AND schemaname = 'public'
            """)
            
            result = await db.execute(follows_indexes_query)
            follow_indexes = {row.indexname: row.indexdef for row in result.fetchall()}
            
            if not any("follower_id" in idx for idx in follow_indexes.values()):
                recommendations.append(IndexRecommendation(
                    table_name="follows",
                    columns=["follower_id"],
                    index_type="btree",
                    reason="Following list queries",
                    priority="medium",
                    estimated_benefit="Faster following list retrieval",
                    sql_command="CREATE INDEX CONCURRENTLY idx_follows_follower_id ON follows (follower_id);"
                ))
            
            if not any("followed_id" in idx for idx in follow_indexes.values()):
                recommendations.append(IndexRecommendation(
                    table_name="follows",
                    columns=["followed_id"],
                    index_type="btree",
                    reason="Follower list queries",
                    priority="medium",
                    estimated_benefit="Faster follower list retrieval",
                    sql_command="CREATE INDEX CONCURRENTLY idx_follows_followed_id ON follows (followed_id);"
                ))
            
        except Exception as e:
            logger.error(f"Failed to get application-specific recommendations: {e}")
        
        return recommendations
    
    async def get_index_maintenance_recommendations(self, db: AsyncSession) -> Dict[str, Any]:
        """Get recommendations for index maintenance."""
        try:
            # Check for bloated indexes
            bloat_query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                    pg_relation_size(indexrelid) as size_bytes
                FROM pg_stat_user_indexes
                WHERE pg_relation_size(indexrelid) > 10485760  -- > 10MB
                ORDER BY pg_relation_size(indexrelid) DESC
                LIMIT 10
            """)
            
            result = await db.execute(bloat_query)
            large_indexes = result.fetchall()
            
            maintenance_recommendations = {
                "reindex_candidates": [],
                "vacuum_recommendations": [],
                "monitoring_suggestions": []
            }
            
            for idx in large_indexes:
                maintenance_recommendations["reindex_candidates"].append({
                    "schema": idx.schemaname,
                    "table": idx.tablename,
                    "index": idx.indexname,
                    "size": idx.index_size,
                    "recommendation": f"Consider REINDEX CONCURRENTLY {idx.indexname} if performance degrades",
                    "sql": f"REINDEX INDEX CONCURRENTLY {idx.indexname};"
                })
            
            # General maintenance recommendations
            maintenance_recommendations["vacuum_recommendations"] = [
                "Run VACUUM ANALYZE regularly on high-activity tables",
                "Consider auto-vacuum tuning for better performance",
                "Monitor table and index bloat weekly"
            ]
            
            maintenance_recommendations["monitoring_suggestions"] = [
                "Set up alerts for unused indexes consuming > 100MB",
                "Monitor index scan ratios weekly",
                "Track query performance trends",
                "Review index recommendations monthly"
            ]
            
            return maintenance_recommendations
            
        except Exception as e:
            logger.error(f"Failed to get maintenance recommendations: {e}")
            return {}
    
    async def generate_comprehensive_report(self, db: AsyncSession) -> Dict[str, Any]:
        """Generate a comprehensive index analysis report."""
        try:
            logger.info("Generating comprehensive index analysis report")
            
            # Gather all analysis data
            usage_stats = await self.get_index_usage_stats(db)
            unused_indexes = await self.get_unused_indexes(db)
            duplicate_indexes = await self.get_duplicate_indexes(db)
            recommendations = await self.analyze_query_patterns(db)
            maintenance = await self.get_index_maintenance_recommendations(db)
            
            # Calculate summary statistics
            total_indexes = len(usage_stats)
            unused_count = len(unused_indexes)
            duplicate_count = len(duplicate_indexes)
            
            total_unused_size = sum(idx["size_bytes"] for idx in unused_indexes)
            total_duplicate_size = sum(dup["total_size_bytes"] for dup in duplicate_indexes)
            
            # Categorize recommendations by priority
            high_priority = [r for r in recommendations if r.priority == "high"]
            medium_priority = [r for r in recommendations if r.priority == "medium"]
            low_priority = [r for r in recommendations if r.priority == "low"]
            
            report = {
                "timestamp": datetime.utcnow().isoformat(),
                "summary": {
                    "total_indexes": total_indexes,
                    "unused_indexes": unused_count,
                    "duplicate_indexes": duplicate_count,
                    "total_unused_size_mb": round(total_unused_size / (1024 * 1024), 2),
                    "total_duplicate_size_mb": round(total_duplicate_size / (1024 * 1024), 2),
                    "recommendations_count": len(recommendations)
                },
                "usage_statistics": [
                    {
                        "table": stat.table_name,
                        "index": stat.index_name,
                        "size": stat.index_size,
                        "scans": stat.index_scans,
                        "usage_ratio": stat.usage_ratio
                    }
                    for stat in usage_stats[:20]  # Top 20
                ],
                "unused_indexes": unused_indexes,
                "duplicate_indexes": duplicate_indexes,
                "recommendations": {
                    "high_priority": [
                        {
                            "table": r.table_name,
                            "columns": r.columns,
                            "reason": r.reason,
                            "sql": r.sql_command
                        }
                        for r in high_priority
                    ],
                    "medium_priority": [
                        {
                            "table": r.table_name,
                            "columns": r.columns,
                            "reason": r.reason,
                            "sql": r.sql_command
                        }
                        for r in medium_priority
                    ],
                    "low_priority": [
                        {
                            "table": r.table_name,
                            "columns": r.columns,
                            "reason": r.reason,
                            "sql": r.sql_command
                        }
                        for r in low_priority
                    ]
                },
                "maintenance": maintenance
            }
            
            logger.info(f"Index analysis complete: {total_indexes} indexes analyzed, {len(recommendations)} recommendations")
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate comprehensive report: {e}")
            return {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


# Global index monitor instance
index_monitor = DatabaseIndexMonitor()


async def analyze_database_indexes() -> Dict[str, Any]:
    """Analyze database indexes and return comprehensive report."""
    async with get_db().__anext__() as db:
        return await index_monitor.generate_comprehensive_report(db)


async def get_index_recommendations() -> List[IndexRecommendation]:
    """Get index recommendations for the database."""
    async with get_db().__anext__() as db:
        return await index_monitor.analyze_query_patterns(db)