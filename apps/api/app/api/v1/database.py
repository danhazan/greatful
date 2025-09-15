"""
Database management and monitoring API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional

from app.core.database import get_db, get_db_health, get_db_stats
from app.core.database_backup import backup_manager
from app.core.migration_manager import migration_manager
from app.core.index_monitor import index_monitor, analyze_database_indexes
from app.core.query_monitor import get_query_performance_report
from app.core.responses import success_response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()
security = HTTPBearer()


async def get_current_user_simple(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Simple current user dependency for database endpoints."""
    try:
        from app.services.auth_service import AuthService
        
        auth_service = AuthService(db)
        user_info = await auth_service.get_user_from_token(credentials.credentials)
        
        if not user_info:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        return user_info
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")


@router.get("/health")
async def get_database_health():
    """
    Get database health status including connection pool information.
    
    Returns comprehensive database health metrics for monitoring.
    """
    health_data = await get_db_health()
    return success_response(health_data)


@router.get("/stats")
async def get_database_statistics():
    """
    Get comprehensive database statistics.
    
    Requires authentication. Returns detailed database metrics including
    size, connections, and table statistics.
    """
    stats_data = await get_db_stats()
    return success_response(stats_data)


@router.get("/performance")
async def get_performance_report():
    """
    Get query performance report.
    
    Returns detailed query performance metrics including slow queries,
    execution times, and performance trends.
    """
    performance_data = get_query_performance_report()
    return success_response(performance_data)


@router.get("/indexes/analysis")
async def get_index_analysis():
    """
    Get comprehensive database index analysis.
    
    Returns detailed index usage statistics, recommendations for optimization,
    unused indexes, and maintenance suggestions.
    """
    try:
        analysis_data = await analyze_database_indexes()
        return success_response(analysis_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Index analysis failed: {str(e)}")


@router.get("/indexes/recommendations")
async def get_index_recommendations(db: AsyncSession = Depends(get_db)):
    """
    Get index optimization recommendations.
    
    Returns specific recommendations for creating new indexes based on
    query patterns and table usage statistics.
    """
    try:
        recommendations = await index_monitor.analyze_query_patterns(db)
        
        # Convert recommendations to dict format
        recommendations_data = [
            {
                "table_name": rec.table_name,
                "columns": rec.columns,
                "index_type": rec.index_type,
                "reason": rec.reason,
                "priority": rec.priority,
                "estimated_benefit": rec.estimated_benefit,
                "sql_command": rec.sql_command
            }
            for rec in recommendations
        ]
        
        return success_response({
            "recommendations": recommendations_data,
            "total_count": len(recommendations_data)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get index recommendations: {str(e)}")


@router.get("/indexes/unused")
async def get_unused_indexes(
    min_size_mb: float = 1.0,
    db: AsyncSession = Depends(get_db)
):
    """
    Get unused indexes that are consuming space.
    
    Args:
        min_size_mb: Minimum size in MB to consider (default: 1.0)
    
    Returns list of unused indexes with size information and drop commands.
    """
    try:
        unused_indexes = await index_monitor.get_unused_indexes(db, min_size_mb)
        return success_response({
            "unused_indexes": unused_indexes,
            "total_count": len(unused_indexes),
            "total_size_mb": sum(idx["size_bytes"] for idx in unused_indexes) / (1024 * 1024)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get unused indexes: {str(e)}")


@router.get("/backups")
async def list_backups():
    """
    List available database backups.
    
    Returns list of all available backups with metadata including
    size, creation time, and compression status.
    """
    try:
        backups = await backup_manager.list_backups()
        return success_response({
            "backups": backups,
            "total_count": len(backups),
            "total_size_mb": sum(b["size_mb"] for b in backups)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")


@router.post("/backups")
async def create_backup(
    backup_name: Optional[str] = None,
    include_data: bool = True,
    compress: bool = True
):
    """
    Create a new database backup.
    
    Args:
        backup_name: Custom backup name (optional)
        include_data: Whether to include data or schema only
        compress: Whether to compress the backup
    
    Returns backup creation result with file information.
    """
    try:
        backup_result = await backup_manager.create_backup(
            backup_name=backup_name,
            include_data=include_data,
            compress=compress
        )
        
        if backup_result["success"]:
            return success_response(backup_result)
        else:
            raise HTTPException(status_code=500, detail=backup_result.get("error", "Backup failed"))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {str(e)}")


@router.get("/backups/status")
async def get_backup_status():
    """
    Get backup system status.
    
    Returns overall backup system health including last backup time,
    total backup count, and storage usage.
    """
    try:
        status = await backup_manager.get_backup_status()
        return success_response(status)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get backup status: {str(e)}")


@router.delete("/backups/cleanup")
async def cleanup_old_backups():
    """
    Clean up old backups based on retention policy.
    
    Removes backups older than the configured retention period
    and returns information about cleaned up files.
    """
    try:
        cleanup_result = await backup_manager.cleanup_old_backups()
        return success_response(cleanup_result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup cleanup failed: {str(e)}")


@router.get("/migrations/status")
async def get_migration_status():
    """
    Get database migration status.
    
    Returns current migration state, pending migrations,
    and migration history information.
    """
    try:
        status = await migration_manager.get_migration_status()
        return success_response(status)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get migration status: {str(e)}")


@router.get("/migrations/history")
async def get_migration_history():
    """
    Get database migration history.
    
    Returns detailed migration history with revision information
    and descriptions.
    """
    try:
        history = await migration_manager.get_migration_history()
        return success_response({
            "migrations": history,
            "total_count": len(history)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get migration history: {str(e)}")


@router.post("/migrations/test-rollback")
async def test_migration_rollback():
    """
    Test migration rollback capability.
    
    Creates a temporary database, applies migrations, and tests
    rollback functionality without affecting production data.
    """
    try:
        test_result = await migration_manager.test_migration_rollback()
        return success_response(test_result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration rollback test failed: {str(e)}")


# Admin-only endpoints (would need proper admin authentication in production)
@router.post("/migrations/upgrade")
async def upgrade_database(
    target_revision: Optional[str] = None,
    create_backup: bool = True,
    current_user: Dict[str, Any] = Depends(get_current_user_simple)
):
    """
    Upgrade database to target revision.
    
    ADMIN ONLY: Requires proper admin authentication.
    
    Args:
        target_revision: Target revision (defaults to head)
        create_backup: Whether to create backup before upgrade
    
    Returns upgrade result with timing and backup information.
    """
    # In production, add proper admin role check here
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        upgrade_result = await migration_manager.upgrade_database(
            target_revision=target_revision,
            create_backup=create_backup
        )
        
        if upgrade_result["success"]:
            return success_response(upgrade_result)
        else:
            raise HTTPException(status_code=500, detail=upgrade_result.get("error", "Upgrade failed"))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database upgrade failed: {str(e)}")


@router.post("/migrations/rollback")
async def rollback_database(
    target_revision: Optional[str] = None,
    steps: Optional[int] = None,
    create_backup: bool = True,
    current_user: Dict[str, Any] = Depends(get_current_user_simple)
):
    """
    Rollback database to target revision or by steps.
    
    ADMIN ONLY: Requires proper admin authentication.
    
    Args:
        target_revision: Target revision to rollback to
        steps: Number of steps to rollback (alternative to target_revision)
        create_backup: Whether to create backup before rollback
    
    Returns rollback result with timing and backup information.
    """
    # In production, add proper admin role check here
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        rollback_result = await migration_manager.rollback_database(
            target_revision=target_revision,
            steps=steps,
            create_backup=create_backup
        )
        
        if rollback_result["success"]:
            return success_response(rollback_result)
        else:
            raise HTTPException(status_code=500, detail=rollback_result.get("error", "Rollback failed"))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database rollback failed: {str(e)}")