"""
Database configuration and session management with production optimizations.
"""

import os
import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from sqlalchemy import event, text

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:iamgreatful@localhost:5432/grateful"
)

logger.info(f"Raw DATABASE_URL: {DATABASE_URL[:50] if DATABASE_URL else 'None'}...")

# Convert postgresql:// to postgresql+asyncpg:// for Railway compatibility
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    logger.info(f"Converted DATABASE_URL: {DATABASE_URL[:50]}...")
else:
    logger.info(f"Using DATABASE_URL as-is: {DATABASE_URL[:50] if DATABASE_URL else 'None'}...")

# Production database configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Connection pool settings based on environment
POOL_SETTINGS = {
    "development": {
        "pool_size": 10,  # Increased for load testing
        "max_overflow": 20,  # Increased for load testing
        "pool_timeout": 30,
        "pool_recycle": 3600,  # 1 hour
        "pool_pre_ping": True,
        "echo": False,  # Disable SQL logging for better performance
    },
    "staging": {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 3600,  # 1 hour
        "pool_pre_ping": True,
        "echo": False,
    },
    "production": {
        "pool_size": 20,
        "max_overflow": 30,
        "pool_timeout": 30,
        "pool_recycle": 1800,  # 30 minutes
        "pool_pre_ping": True,
        "echo": False,
        "connect_args": {
            "server_settings": {
                "application_name": "grateful_api",
                "jit": "off",  # Disable JIT for consistent performance
            },
            "command_timeout": 60,
            "statement_cache_size": 0,  # Disable statement cache for production
        }
    }
}

def get_engine_config() -> Dict[str, Any]:
    """Get database engine configuration based on environment."""
    config = POOL_SETTINGS.get(ENVIRONMENT, POOL_SETTINGS["development"]).copy()
    
    # Add SSL configuration for production
    if ENVIRONMENT == "production":
        ssl_mode = os.getenv("DB_SSL_MODE", "require")
        if ssl_mode != "disable":
            if "connect_args" not in config:
                config["connect_args"] = {}
            config["connect_args"]["ssl"] = ssl_mode
    
    return config

# Create async engine with production optimizations
engine_config = get_engine_config()
engine = create_async_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    **engine_config
)

# Create async session factory
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Create declarative base
Base = declarative_base()

# Connection pool monitoring
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Set database connection parameters for optimization."""
    if "postgresql" in str(dbapi_connection):
        # PostgreSQL-specific optimizations
        with dbapi_connection.cursor() as cursor:
            # Set connection-level parameters for performance
            cursor.execute("SET statement_timeout = '60s'")
            cursor.execute("SET lock_timeout = '30s'")
            cursor.execute("SET idle_in_transaction_session_timeout = '300s'")

@event.listens_for(engine.sync_engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Log connection checkout for monitoring."""
    logger.debug(f"Connection checked out from pool. Pool size: {engine.pool.size()}")

@event.listens_for(engine.sync_engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    """Log connection checkin for monitoring."""
    logger.debug(f"Connection checked in to pool. Pool size: {engine.pool.size()}")

async def get_db() -> AsyncSession:
    """
    Dependency to get database session with proper error handling.
    """
    async with async_session() as session:
        try:
            yield session
        except Exception as e:
            logger.exception(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    """
    Create database tables.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db_health() -> Dict[str, Any]:
    """
    Check database health and connection pool status.
    
    Returns:
        Dict containing database health information
    """
    try:
        async with engine.begin() as conn:
            # Test basic connectivity
            result = await conn.execute(text("SELECT 1"))
            result.fetchone()
            
            # Get connection pool stats
            pool = engine.pool
            pool_status = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow()
            }
            
            # Add invalid count if available (not all pool types have this)
            if hasattr(pool, 'invalid'):
                pool_status["invalid"] = pool.invalid()
            
            return {
                "status": "healthy",
                "database": "connected",
                "pool": pool_status,
                "environment": ENVIRONMENT
            }
            
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "environment": ENVIRONMENT
        }

async def get_db_stats() -> Dict[str, Any]:
    """
    Get comprehensive database statistics for monitoring.
    
    Returns:
        Dict containing database statistics
    """
    try:
        async with engine.begin() as conn:
            # Get database size
            size_result = await conn.execute(text("""
                SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
            """))
            db_size = size_result.fetchone()[0]
            
            # Get connection stats
            conn_result = await conn.execute(text("""
                SELECT 
                    count(*) as total_connections,
                    count(*) FILTER (WHERE state = 'active') as active_connections,
                    count(*) FILTER (WHERE state = 'idle') as idle_connections
                FROM pg_stat_activity 
                WHERE datname = current_database()
            """))
            conn_stats = conn_result.fetchone()
            
            # Get table stats
            table_result = await conn.execute(text("""
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    n_live_tup as live_tuples,
                    n_dead_tup as dead_tuples
                FROM pg_stat_user_tables
                ORDER BY n_live_tup DESC
                LIMIT 10
            """))
            table_stats = [dict(row._mapping) for row in table_result.fetchall()]
            
            return {
                "database_size": db_size,
                "connections": {
                    "total": conn_stats.total_connections,
                    "active": conn_stats.active_connections,
                    "idle": conn_stats.idle_connections
                },
                "tables": table_stats,
                "pool": {
                    "size": engine.pool.size(),
                    "checked_in": engine.pool.checkedin(),
                    "checked_out": engine.pool.checkedout(),
                    "overflow": engine.pool.overflow()
                }
            }
            
    except Exception as e:
        logger.error(f"Failed to get database stats: {e}")
        return {"error": str(e)}

def get_engine() -> AsyncEngine:
    """Get the database engine instance."""
    return engine