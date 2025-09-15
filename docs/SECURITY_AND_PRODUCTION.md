# Security and Production Deployment Guide

This document provides comprehensive guidance for deploying and maintaining the Grateful API in a production environment with enterprise-grade security.

## Table of Contents

- [Security Overview](#security-overview)
- [Rate Limiting](#rate-limiting)
- [Input Sanitization](#input-sanitization)
- [Authentication & Authorization](#authentication--authorization)
- [Security Headers](#security-headers)
- [Audit Logging](#audit-logging)
- [Production Configuration](#production-configuration)
- [Database Security](#database-security)
- [Performance Optimization](#performance-optimization)
- [Monitoring & Alerting](#monitoring--alerting)
- [Deployment Checklist](#deployment-checklist)

## Security Overview

The Grateful API implements multiple layers of security to protect against common web application vulnerabilities:

- **Rate Limiting**: Prevents abuse and ensures fair resource usage
- **Input Sanitization**: Protects against XSS and injection attacks
- **Security Headers**: Implements browser-level security controls
- **JWT Security**: Secure token-based authentication with refresh tokens
- **Audit Logging**: Comprehensive security event tracking
- **Request Size Limits**: Prevents resource exhaustion attacks

## Rate Limiting

### Implementation

The API uses an in-memory sliding window rate limiter with endpoint-specific limits:

```python
# Rate limits (requests per minute)
RATE_LIMITS = {
    "default": 100,        # General API endpoints
    "auth": 10,           # Authentication endpoints
    "upload": 20,         # File upload endpoints
    "public": 200,        # Public endpoints (no auth)
}
```

### Endpoint-Specific Limits

| Endpoint Pattern | Limit (per minute) | Purpose |
|-----------------|-------------------|---------|
| `POST:/api/v1/auth/*` | 10 | Prevent brute force attacks |
| `POST:/api/v1/posts` | 30 | Prevent spam posting |
| `POST:/api/v1/posts/*/reactions` | 60 | Allow normal interaction |
| `POST:/api/v1/posts/*/share` | 20 | Prevent share spam |
| `POST:/api/v1/follows/*` | 30 | Prevent follow spam |
| `GET:/api/v1/notifications` | 120 | Allow frequent checking |
| Default | 100 | General protection |

### Rate Limit Headers

All responses include rate limiting information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1694728800
```

### Configuration

Rate limits can be configured via environment variables:

```bash
DEFAULT_RATE_LIMIT=100
AUTH_RATE_LIMIT=10
UPLOAD_RATE_LIMIT=20
```

## Input Sanitization

### Implementation Strategy

The API uses a two-layer approach for input sanitization:

1. **Middleware Layer**: Prepares sanitization mappings without consuming request body
2. **Endpoint Layer**: Applies sanitization using utility functions

This approach avoids request body consumption issues while maintaining security.

### Sanitization Rules

The API automatically sanitizes user input based on field types:

#### Field-Specific Sanitization

| Field Type | Rules | Applied To |
|-----------|-------|------------|
| `username` | Alphanumeric + `_.-`, max 50 chars | Registration, profile updates |
| `email` | Lowercase, valid email format, max 254 chars | Registration (not login) |
| `post_content` | HTML escaped, line breaks normalized, max 2000 chars | Post creation |
| `bio` | HTML escaped, max 500 chars | Profile updates |
| `url` | Auto-add HTTPS scheme, max 500 chars | Profile websites |
| `password` | No sanitization (preserved for authentication) | Login/registration |

#### Authentication-Specific Rules

- **Login**: Email and password are NOT sanitized to preserve exact values for authentication
- **Registration**: Email is sanitized for storage, password is preserved
- **Case Sensitivity**: Database lookups are case-sensitive, sanitization accounts for this

#### File Upload Validation

```python
# Allowed file types
ALLOWED_TYPES = [
    'image/jpeg',
    'image/png', 
    'image/webp',
    'image/gif'
]

# Size limits
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
```

### XSS Prevention

All user-generated content is HTML-escaped:

```python
# Input: <script>alert('xss')</script>
# Output: &lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;
```

### Usage in Endpoints

```python
from app.core.input_sanitization import sanitize_request_data

# In endpoint handlers
@router.post("/posts")
async def create_post(post: PostCreate, request: Request):
    # Sanitize input data using middleware mappings
    sanitized_data = sanitize_request_data(request, post.model_dump())
    
    # Use sanitized data for storage
    result = await post_service.create_post(**sanitized_data)
```

## Authentication & Authorization

### JWT Token System

The API uses a dual-token system for enhanced security:

#### Access Tokens
- **Purpose**: API authentication
- **Expiration**: 1 hour (configurable)
- **Claims**: `sub`, `iat`, `exp`, `jti`, `type`

#### Refresh Tokens
- **Purpose**: Renew access tokens
- **Expiration**: 30 days (configurable)
- **Claims**: `sub`, `iat`, `exp`, `jti`, `type`

### Token Configuration

```bash
# Environment variables
SECRET_KEY=your-super-secure-secret-key-at-least-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
```

### Security Features

- **Token Type Validation**: Ensures correct token type for each endpoint
- **JWT ID (jti)**: Unique identifier for token revocation
- **Secure Secret Key**: Minimum 32 characters, validated in production

## Security Headers

### Implemented Headers

The API automatically adds comprehensive security headers:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### CORS Configuration

Production CORS settings:

```python
CORS_CONFIG = {
    "allow_origins": ["https://yourdomain.com"],
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    "allow_headers": ["Authorization", "Content-Type", "X-Request-ID"],
    "expose_headers": ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
    "max_age": 86400
}
```

## Audit Logging

### Security Events

The system logs all security-relevant events:

#### Event Types

| Event Type | Severity | Description |
|-----------|----------|-------------|
| `LOGIN_SUCCESS` | INFO | Successful authentication |
| `LOGIN_FAILURE` | WARNING | Failed login attempt |
| `RATE_LIMIT_EXCEEDED` | WARNING | Rate limit violation |
| `INVALID_TOKEN` | WARNING | Invalid JWT token usage |
| `PERMISSION_DENIED` | WARNING | Authorization failure |
| `SUSPICIOUS_ACTIVITY` | ERROR | Potential security threat |

#### Log Format

```json
{
  "timestamp": "2025-09-14T22:00:00Z",
  "event_type": "LOGIN_FAILURE",
  "user_id": null,
  "severity": "WARNING",
  "details": {
    "username": "user@example.com",
    "failure_reason": "Invalid password"
  },
  "request_id": "req-123456",
  "method": "POST",
  "path": "/api/v1/auth/login",
  "client_ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

### Log Configuration

```bash
# Environment variables
LOG_LEVEL=INFO
SECURITY_LOG_LEVEL=INFO
```

## Production Configuration

### Environment Variables

Create a `.env.production` file with secure values:

```bash
# Environment
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db

# Security
SECRET_KEY=your-super-secure-secret-key-at-least-32-characters-long
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
DEFAULT_RATE_LIMIT=100
AUTH_RATE_LIMIT=10
UPLOAD_RATE_LIMIT=20

# Request Limits
MAX_REQUEST_SIZE=10485760
MAX_UPLOAD_SIZE=10485760

# SSL/TLS
SSL_REDIRECT=true
HSTS_MAX_AGE=31536000

# Features
ENABLE_REGISTRATION=true
ENABLE_FILE_UPLOADS=true
ENABLE_DOCS=false
```

### Configuration Validation

The system validates production configuration on startup:

```python
# Automatic validation checks
- SECRET_KEY must not be default value
- SECRET_KEY must be at least 32 characters
- ALLOWED_ORIGINS must use HTTPS in production
- ACCESS_TOKEN_EXPIRE_MINUTES should not exceed 24 hours
```

## Database Security

### Connection Security

```bash
# Use SSL connections with production-optimized pooling
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db?ssl=require

# Environment-specific connection pooling
# Development
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600

# Production
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
DB_SSL_MODE=require
```

### Production Database Configuration

The system automatically configures database connections based on environment:

#### Connection Pool Settings

| Environment | Pool Size | Max Overflow | Recycle Time | SSL Required |
|-------------|-----------|--------------|--------------|--------------|
| Development | 5 | 10 | 1 hour | No |
| Staging | 10 | 20 | 1 hour | Yes |
| Production | 20 | 30 | 30 minutes | Yes |

#### Connection Monitoring

The system includes comprehensive connection pool monitoring:

```python
# Health check endpoint includes pool status
GET /health/db
{
  "status": "healthy",
  "database": "connected",
  "pool": {
    "size": 20,
    "checked_in": 18,
    "checked_out": 2,
    "overflow": 0,
    "invalid": 0
  }
}
```

### Query Security and Performance

- **Parameterized Queries**: All database queries use SQLAlchemy ORM
- **Input Validation**: All inputs validated before database operations
- **Connection Limits**: Environment-specific connection pooling prevents exhaustion
- **Query Monitoring**: Automatic slow query detection and alerting
- **Connection Optimization**: Production-specific connection parameters

#### Query Performance Monitoring

```python
# Automatic slow query detection
SLOW_QUERY_THRESHOLDS = {
    "development": 1.0,  # 1 second
    "staging": 0.5,      # 500ms
    "production": 0.3    # 300ms
}

# Performance alerts triggered for:
# - Individual queries > 5 seconds
# - > 10% of queries are slow
# - > 5% query failure rate
# - > 80% connection pool utilization
```

### Database Backup and Recovery

#### Automated Backup System

The system includes a comprehensive backup management system:

```python
# Backup configuration
BACKUP_CONFIG = {
    "backup_dir": "/var/backups/grateful",
    "retention_days": 30,
    "compress": True,
    "max_backup_size_gb": 10,
    "backup_timeout_minutes": 60
}
```

#### Backup Types

1. **Daily Automated Backups**
   - Full database backup with compression
   - Automatic cleanup of old backups
   - Integrity verification
   - Size and duration monitoring

2. **Pre-Migration Backups**
   - Automatic backup before any migration
   - Named with migration context
   - Quick rollback capability

3. **On-Demand Backups**
   - Manual backup creation
   - Custom naming and options
   - Schema-only or full data options

#### Backup Commands

```bash
# Create daily backup (automated)
python -c "
import asyncio
from app.core.database_backup import create_daily_backup
asyncio.run(create_daily_backup())
"

# Manual backup creation
python -c "
import asyncio
from app.core.database_backup import backup_manager
asyncio.run(backup_manager.create_backup('manual_backup_name'))
"

# List available backups
python -c "
import asyncio
from app.core.database_backup import backup_manager
result = asyncio.run(backup_manager.list_backups())
print(result)
"

# Cleanup old backups
python -c "
import asyncio
from app.core.database_backup import cleanup_old_backups
asyncio.run(cleanup_old_backups())
"
```

#### Recovery Procedures

```bash
# Restore from backup
python -c "
import asyncio
from app.core.database_backup import backup_manager
asyncio.run(backup_manager.restore_backup('/path/to/backup.sql.gz'))
"

# Test restore to different database
python -c "
import asyncio
from app.core.database_backup import backup_manager
asyncio.run(backup_manager.restore_backup(
    '/path/to/backup.sql.gz',
    target_database='grateful_test',
    drop_existing=True
))
"
```

### Migration Management and Rollback

#### Safe Migration Procedures

The system includes comprehensive migration management:

```python
# Safe upgrade with automatic backup
from app.core.migration_manager import safe_upgrade
result = await safe_upgrade()  # Upgrades to head with backup

# Safe rollback with backup
from app.core.migration_manager import safe_rollback
result = await safe_rollback(steps=1)  # Rollback 1 step with backup
```

#### Migration Testing

```python
# Test migration rollback capability
from app.core.migration_manager import test_rollback_capability
result = await test_rollback_capability()
```

#### Migration Commands

```bash
# Check migration status
python -c "
import asyncio
from app.core.migration_manager import migration_manager
result = asyncio.run(migration_manager.get_migration_status())
print(result)
"

# Safe upgrade with backup
python -c "
import asyncio
from app.core.migration_manager import safe_upgrade
result = asyncio.run(safe_upgrade())
print(result)
"

# Safe rollback
python -c "
import asyncio
from app.core.migration_manager import safe_rollback
result = asyncio.run(safe_rollback(steps=1))
print(result)
"
```

## Performance Optimization

### Algorithm Performance Configuration

The system includes production-optimized algorithm settings:

```python
# Production algorithm configuration
PRODUCTION_PERFORMANCE_CONFIG = {
    'cache_settings': {
        'feed_cache_ttl': 300,  # 5 minutes
        'user_preference_cache_ttl': 1800,  # 30 minutes
        'algorithm_config_cache_ttl': 3600,  # 1 hour
        'post_score_cache_ttl': 600,  # 10 minutes
    },
    'query_optimization': {
        'batch_size': 100,
        'max_feed_size': 50,
        'prefetch_relationships': ['user', 'reactions', 'shares'],
        'use_query_hints': True,
    },
    'algorithm_tuning': {
        'score_calculation_timeout': 30,
        'max_concurrent_calculations': 10,
        'enable_score_caching': True,
        'recalculate_scores_interval': 3600,
    }
}
```

### Database Index Monitoring

The system includes comprehensive index monitoring and optimization:

#### Index Analysis Commands

```bash
# Generate comprehensive index report
python -c "
import asyncio
from app.core.index_monitor import analyze_database_indexes
result = asyncio.run(analyze_database_indexes())
print(result)
"

# Get index recommendations
python -c "
import asyncio
from app.core.index_monitor import get_index_recommendations
result = asyncio.run(get_index_recommendations())
for rec in result:
    print(f'{rec.table_name}: {rec.reason} - {rec.sql_command}')
"
```

#### Automated Index Recommendations

The system analyzes query patterns and suggests indexes for:

1. **High Sequential Scan Tables**
   - Tables with > 30% sequential scan ratio
   - Recommendations for WHERE clause columns

2. **Application-Specific Patterns**
   - Feed queries: `posts(created_at DESC)`
   - User profiles: `posts(user_id, created_at DESC)`
   - Notifications: `notifications(user_id, created_at DESC)`
   - Unread notifications: Partial index on `is_read = false`

3. **Relationship Queries**
   - Follow relationships: `follows(follower_id)`, `follows(followed_id)`
   - Engagement queries: Composite indexes on interaction tables

### Database Optimization

#### Essential Production Indexes

```sql
-- Feed optimization
CREATE INDEX CONCURRENTLY idx_posts_created_at_desc ON posts (created_at DESC);
CREATE INDEX CONCURRENTLY idx_posts_user_created ON posts (user_id, created_at DESC);

-- Notification optimization
CREATE INDEX CONCURRENTLY idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_notifications_unread ON notifications (user_id, created_at DESC) WHERE is_read = false;

-- Relationship optimization
CREATE INDEX CONCURRENTLY idx_follows_follower_id ON follows (follower_id);
CREATE INDEX CONCURRENTLY idx_follows_followed_id ON follows (followed_id);

-- Engagement optimization
CREATE INDEX CONCURRENTLY idx_emoji_reactions_post_id ON emoji_reactions (post_id);
CREATE INDEX CONCURRENTLY idx_likes_post_id ON likes (post_id);
CREATE INDEX CONCURRENTLY idx_shares_post_id ON shares (post_id);
```

#### Index Maintenance

```bash
# Check for unused indexes
python -c "
import asyncio
from app.core.index_monitor import index_monitor
from app.core.database import get_db

async def check_unused():
    async with get_db().__anext__() as db:
        unused = await index_monitor.get_unused_indexes(db)
        for idx in unused:
            print(f'Unused: {idx[\"table\"]}.{idx[\"index\"]} ({idx[\"size\"]})')

asyncio.run(check_unused())
"

# Find duplicate indexes
python -c "
import asyncio
from app.core.index_monitor import index_monitor
from app.core.database import get_db

async def check_duplicates():
    async with get_db().__anext__() as db:
        duplicates = await index_monitor.get_duplicate_indexes(db)
        for dup in duplicates:
            print(f'Duplicate on {dup[\"table\"]}.{dup[\"columns\"]}: {dup[\"index_names\"]}')

asyncio.run(check_duplicates())
"
```

### Caching Strategy

```python
# Redis configuration for production
REDIS_URL=redis://localhost:6379/0

# Environment-specific cache TTL
CACHE_SETTINGS = {
    'development': {
        'feed_cache_ttl': 60,  # 1 minute for testing
        'user_preference_cache_ttl': 300,  # 5 minutes
    },
    'production': {
        'feed_cache_ttl': 300,  # 5 minutes
        'user_preference_cache_ttl': 1800,  # 30 minutes
        'algorithm_config_cache_ttl': 3600,  # 1 hour
        'post_score_cache_ttl': 600,  # 10 minutes
    }
}
```

### Query Performance Monitoring

The system includes comprehensive query monitoring:

```python
# Performance monitoring features
- Automatic slow query detection
- Query failure rate tracking
- Connection pool utilization monitoring
- Performance trend analysis
- Alert system for performance degradation
```

#### Performance Alerts

```python
# Alert thresholds
ALERT_THRESHOLDS = {
    "slow_query_rate": 0.1,      # 10% of queries are slow
    "very_slow_query": 5.0,      # Individual query > 5 seconds
    "query_failure_rate": 0.05,  # 5% of queries fail
    "connection_pool_usage": 0.8  # 80% pool utilization
}
```

### Request Size Limits

| Endpoint | Size Limit | Purpose |
|----------|------------|---------|
| Auth endpoints | 1-2KB | Prevent large payloads |
| Profile photo upload | 10MB | Image uploads |
| Post creation | 5MB | Posts with images |
| General API | 1MB | Default protection |

## Monitoring & Alerting

### Comprehensive Health Check System

The system provides multiple health check endpoints for different monitoring needs:

#### Basic Health Checks
```bash
# Basic application health (for load balancers)
GET /health
Response: {"status": "healthy", "service": "grateful-api", "timestamp": "2025-01-08T10:00:00Z", "version": "1.0.0"}

# Readiness check (for Kubernetes)
GET /ready
Response: {
  "status": "ready",
  "timestamp": "2025-01-08T10:00:00Z",
  "response_time_ms": 45.2,
  "checks": {
    "database": {"status": "healthy", "details": {...}},
    "algorithm": {"status": "healthy", "target_time_ms": 300},
    "filesystem": {"status": "healthy", "uploads_writable": true}
  }
}

# Comprehensive metrics (for monitoring systems)
GET /metrics
Response: {
  "timestamp": "2025-01-08T10:00:00Z",
  "service": "grateful-api",
  "database": {"status": "healthy", "connection_pool": {...}},
  "algorithm": {"status": "healthy", "operations": {...}},
  "system": {"cpu_percent": 25.5, "memory_percent": 45.2}
}
```

#### Detailed Health Checks
```bash
# Database-specific health
GET /health/database?include_stats=true
Response: {
  "status": "healthy",
  "database": "connected",
  "pool": {"size": 20, "checked_out": 2, "utilization": 10},
  "statistics": {"database_size": "2.5 GB", "connections": {...}}
}

# Algorithm performance health
GET /health/algorithm
Response: {
  "status": "healthy",
  "target_time_ms": 300,
  "summary": {"total_operations": 1250, "slow_operations_percentage": 5.2},
  "feed_performance": {"optimized_feed_generation": {"avg_time_ms": 245.3}},
  "recommendations": ["Consider caching for high-frequency operations"]
}

# Complete system health overview
GET /health/detailed
Response: {
  "status": "healthy",
  "timestamp": "2025-01-08T10:00:00Z",
  "response_time_ms": 125.4,
  "issues": [],
  "components": {
    "database": {"status": "healthy", "connection_pool": {...}},
    "algorithm": {"status": "healthy", "cache_hit_rate": 85.2},
    "system": {"cpu_percent": 25.5, "memory_percent": 45.2}
  }
}
```

### Comprehensive Monitoring Dashboard

The system includes a comprehensive monitoring dashboard accessible via API endpoints:

#### Monitoring Dashboard API
```bash
# Get complete monitoring dashboard
GET /api/v1/monitoring/dashboard?time_range_minutes=60
Response: {
  "overall_status": "healthy",
  "current_metrics": {...},
  "uptime_stats": {...},
  "service_statuses": {"database": "healthy", "algorithm": "healthy"},
  "active_incidents": [],
  "alert_stats": {...},
  "summary": {
    "services_monitored": 4,
    "healthy_services": 4,
    "active_incidents": 0,
    "critical_alerts_24h": 0
  }
}

# Get alert history and statistics
GET /api/v1/monitoring/alerts?hours=24&severity=critical
Response: {
  "active_alerts": [],
  "alert_history": [...],
  "statistics": {...},
  "summary": {"active_count": 0, "critical_alerts_24h": 0}
}

# Get incident information
GET /api/v1/monitoring/incidents
Response: {
  "active_incidents": [],
  "uptime_stats": {...},
  "summary": {"active_incidents": 0, "services_healthy": 4}
}

# Get detailed performance metrics
GET /api/v1/monitoring/performance?time_range_minutes=60
Response: {
  "algorithm_performance": {...},
  "database_performance": {...},
  "system_performance": {...},
  "metrics_trends": {...}
}
```

### Metrics to Monitor

#### Security Metrics
- Rate limit violations per hour
- Failed authentication attempts
- Invalid token usage
- Suspicious activity events
- Frontend JavaScript errors and API failures
- Security incident alerts

#### Performance Metrics
- Response times by endpoint (target: <1000ms)
- Feed algorithm performance (target: <300ms)
- Database query performance
- Memory and CPU usage
- Active connections
- Cache hit rates
- Frontend error rates

#### Database Performance Metrics
- Connection pool utilization (alert: >80%)
- Slow query count and rate (alert: >10%)
- Query failure rate (alert: >5%)
- Index usage statistics
- Database size and growth
- Backup success/failure rates
- Migration execution times

#### Algorithm Performance Metrics
- Feed generation time (target: <300ms)
- Cache hit rates (target: >70%)
- Algorithm operation counts
- Performance degradation alerts
- User preference calculation times

#### Business Metrics
- User registrations
- Post creation rate
- API usage patterns
- User engagement metrics
- Error rates by feature

#### System Resource Metrics
- CPU usage (alert: >90%)
- Memory usage (alert: >90%)
- Disk usage (alert: >90%)
- Network I/O
- Process health

### Database Performance Monitoring

#### Key Database Metrics

```python
# Monitor these database metrics
{
    "connection_pool": {
        "size": 20,
        "checked_in": 18,
        "checked_out": 2,
        "overflow": 0,
        "utilization_percentage": 10
    },
    "query_performance": {
        "slow_queries_per_hour": 5,
        "average_query_time": 0.15,
        "query_failure_rate": 0.01,
        "slowest_query_time": 2.3
    },
    "backup_status": {
        "last_backup_age_hours": 12,
        "backup_success_rate": 1.0,
        "total_backup_size_gb": 2.5
    },
    "index_health": {
        "unused_indexes": 2,
        "duplicate_indexes": 0,
        "total_index_size_gb": 0.8
    }
}
```

#### Performance Monitoring Commands

```bash
# Get database health status
curl http://localhost:8000/health/db

# Get comprehensive database stats
python -c "
import asyncio
from app.core.database import get_db_stats
result = asyncio.run(get_db_stats())
print(result)
"

# Get query performance report
python -c "
import asyncio
from app.core.query_monitor import get_query_performance_report
result = get_query_performance_report()
print(result)
"

# Get backup status
python -c "
import asyncio
from app.core.database_backup import backup_manager
result = asyncio.run(backup_manager.get_backup_status())
print(result)
"
```

### Advanced Error Alerting System

The system includes a comprehensive error alerting system with multiple channels:

#### Alert Channels
- **Log Alerts**: Structured logging with severity levels
- **Email Alerts**: HTML email notifications with detailed information
- **Slack Alerts**: Real-time Slack notifications with color coding
- **Webhook Alerts**: Custom webhook integration for external systems

#### Alert Configuration
```python
# Setup email alerts
from app.core.error_alerting import setup_email_alerts
setup_email_alerts(
    smtp_host="smtp.gmail.com",
    smtp_port=587,
    smtp_user="alerts@yourdomain.com",
    smtp_password="your-app-password",
    from_email="alerts@yourdomain.com",
    to_emails=["admin@yourdomain.com", "devops@yourdomain.com"]
)

# Setup Slack alerts
from app.core.error_alerting import setup_slack_alerts
setup_slack_alerts("https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK")

# Setup webhook alerts
from app.core.error_alerting import setup_webhook_alerts
setup_webhook_alerts("https://your-monitoring-system.com/webhook")
```

### Alerting Rules and Thresholds

#### Critical Alerts (Immediate Response Required)
```yaml
# Database alerts
- name: "Database Connection Failure"
  condition: "database_status != healthy"
  severity: "critical"
  rate_limit: "5 minutes"
  
- name: "Very Slow Query Detected"
  condition: "individual_query_time > 5s"
  severity: "critical"
  rate_limit: "5 minutes"

# Algorithm performance alerts  
- name: "Algorithm Performance Critical"
  condition: "feed_algorithm_time > 500ms"
  severity: "critical"
  rate_limit: "5 minutes"

# System resource alerts
- name: "Critical System Resource Usage"
  condition: "cpu_usage > 90% OR memory_usage > 90% OR disk_usage > 90%"
  severity: "critical"
  rate_limit: "15 minutes"

# Security alerts
- name: "Security Incident Detected"
  condition: "suspicious_activity_detected"
  severity: "emergency"
  rate_limit: "1 minute"

# Frontend critical errors
- name: "Frontend Critical Error"
  condition: "frontend_critical_errors > 0"
  severity: "critical"
  rate_limit: "5 minutes"
```

#### Warning Alerts (Monitor and Investigate)
```yaml
# Performance alerts
- name: "High API Response Time"
  condition: "avg_response_time > 1000ms"
  severity: "warning"
  rate_limit: "10 minutes"
  
- name: "Algorithm Performance Degraded"
  condition: "feed_algorithm_time > 300ms"
  severity: "warning"
  rate_limit: "10 minutes"

# Database performance alerts
- name: "High Connection Pool Usage"
  condition: "connection_pool_utilization > 80%"
  severity: "warning"
  rate_limit: "15 minutes"
  
- name: "Slow Query Rate High"
  condition: "slow_query_rate > 10%"
  severity: "warning"
  rate_limit: "10 minutes"

# System alerts
- name: "High System Resource Usage"
  condition: "cpu_usage > 80% OR memory_usage > 80%"
  severity: "warning"
  rate_limit: "15 minutes"

# Cache performance
- name: "Low Cache Hit Rate"
  condition: "cache_hit_rate < 70%"
  severity: "warning"
  rate_limit: "15 minutes"
```

#### Info Alerts (Informational)
```yaml
# Recovery alerts
- name: "Service Recovered"
  condition: "service_status_changed_to_healthy"
  severity: "info"
  rate_limit: "5 minutes"

# Maintenance alerts
- name: "Database Backup Completed"
  condition: "backup_completed_successfully"
  severity: "info"
  rate_limit: "24 hours"
```

### Uptime Monitoring and Incident Response

The system includes automated uptime monitoring with incident management:

#### Uptime Monitoring Features
- **Automated Health Checks**: Continuous monitoring of critical services
- **Incident Detection**: Automatic incident creation for service failures
- **Incident Escalation**: Severity escalation based on failure duration
- **Recovery Detection**: Automatic incident resolution when services recover
- **Status Page Integration**: Real-time service status information

#### Monitored Services
- **Database**: Connection health, query performance, pool utilization
- **Algorithm Performance**: Feed generation times, cache performance
- **API Endpoints**: Response times, error rates, availability
- **System Resources**: CPU, memory, disk usage

#### Incident Response Procedures

##### Automatic Response (Immediate)
1. **Detection**: Health check failure triggers incident creation
2. **Alerting**: Immediate alerts sent via configured channels
3. **Escalation**: Severity increases with failure duration
4. **Documentation**: All incidents logged with timestamps and details

##### Manual Response (Human Intervention)
1. **Investigation**: Review incident details and system metrics
2. **Diagnosis**: Identify root cause using monitoring data
3. **Mitigation**: Apply fixes or workarounds
4. **Resolution**: Mark incident as resolved when service recovers
5. **Post-Mortem**: Document lessons learned and improvements

#### Incident Management API
```bash
# Get active incidents
GET /api/v1/monitoring/incidents
Response: {
  "active_incidents": [
    {
      "id": "incident-1704715200-database",
      "title": "Database Service Issues",
      "severity": "critical",
      "status": "investigating",
      "affected_services": ["database"],
      "started_at": "2025-01-08T10:00:00Z",
      "updates": [...]
    }
  ]
}

# Resolve incident manually
POST /api/v1/monitoring/alerts/{alert_id}/resolve
Response: {
  "status": "success",
  "message": "Alert resolved successfully",
  "resolved_by": 123,
  "timestamp": "2025-01-08T10:30:00Z"
}
```

### Frontend Error Tracking and Reporting

The system includes comprehensive frontend error tracking for JavaScript errors and API failures:

#### Frontend Error Types Tracked
- **JavaScript Errors**: Runtime errors, syntax errors, unhandled promise rejections
- **API Errors**: Failed API requests, network errors, timeout errors
- **Component Errors**: React component errors caught by error boundaries
- **Network Errors**: Connection failures, DNS resolution errors

#### Error Tracking Features
- **Automatic Error Detection**: Global error handlers capture all unhandled errors
- **Rate Limiting**: Prevents error spam with configurable rate limits
- **Error Deduplication**: Groups similar errors to reduce noise
- **Session Tracking**: Associates errors with user sessions for debugging
- **User Context**: Links errors to authenticated users when available
- **Batch Reporting**: Efficient error reporting with periodic batching

#### Error Reporting Configuration
```typescript
// Frontend error tracking configuration
const errorTrackingConfig = {
  maxQueueSize: 50,
  reportingInterval: 30000, // 30 seconds
  rateLimitWindow: 60000, // 1 minute
  maxErrorsPerWindow: 10,
  enabledInProduction: true,
  enabledInDevelopment: false
};
```

#### Error Severity Classification
- **Critical**: ChunkLoadError, Script errors, major component failures
- **High**: TypeError, ReferenceError, API 5xx errors
- **Medium**: Component warnings, API 4xx errors
- **Low**: Minor warnings, deprecated API usage

#### Error Reporting API
```bash
# Frontend error reporting endpoint
POST /api/v1/errors/report
Request: {
  "errors": [
    {
      "id": "error-1704715200-abc123",
      "timestamp": "2025-01-08T10:00:00Z",
      "type": "javascript",
      "severity": "high",
      "message": "TypeError: Cannot read property 'map' of undefined",
      "stack": "TypeError: Cannot read property...",
      "url": "https://app.grateful.com/feed",
      "userAgent": "Mozilla/5.0...",
      "userId": "123",
      "sessionId": "session-abc123",
      "metadata": {
        "filename": "feed.js",
        "lineno": 45,
        "colno": 12,
        "pathname": "/feed"
      }
    }
  ],
  "sessionId": "session-abc123",
  "userId": "123",
  "timestamp": "2025-01-08T10:00:00Z",
  "userAgent": "Mozilla/5.0...",
  "url": "https://app.grateful.com/feed"
}

Response: {
  "status": "success",
  "processed_count": 1,
  "critical_count": 0,
  "errors": [
    {
      "id": "error-1704715200-abc123",
      "processed": true,
      "severity": "high"
    }
  ]
}

# Get error statistics
GET /api/v1/errors/stats
Response: {
  "timestamp": "2025-01-08T10:00:00Z",
  "stats": {
    "total_errors_24h": 45,
    "critical_errors_24h": 2,
    "error_rate_per_hour": 1.9,
    "top_error_types": ["javascript", "api", "component"],
    "affected_users": 12,
    "error_trends": {
      "javascript": 25,
      "api": 15,
      "network": 3,
      "component": 2
    }
  }
}
```

#### Error Boundary Implementation
```typescript
// React Error Boundary for component error tracking
import { ErrorBoundary, withErrorBoundary } from '@/components/ErrorBoundary';

// Wrap components with error boundary
const SafeComponent = withErrorBoundary(MyComponent, 
  <div>Something went wrong</div>,
  (error, errorInfo) => {
    console.error('Component error:', error, errorInfo);
  }
);

// Use error boundary in app layout
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

#### Enhanced Fetch with Error Tracking
```typescript
// Automatic API error tracking
import { trackedFetch } from '@/utils/errorTracking';

// Use trackedFetch instead of regular fetch
const response = await trackedFetch('/api/v1/posts', {
  method: 'POST',
  body: JSON.stringify(postData)
});
// Automatically reports API errors for non-2xx responses
```

### Production Monitoring Setup

#### Required Monitoring Infrastructure

##### 1. Application Performance Monitoring (APM)
```bash
# Install monitoring dependencies
pip install prometheus-client
pip install sentry-sdk[fastapi]
npm install @sentry/react @sentry/tracing
```

##### 2. Log Aggregation
```bash
# Configure structured logging
export LOG_FORMAT=json
export LOG_LEVEL=INFO
export ENABLE_REQUEST_LOGGING=true
export ENABLE_PERFORMANCE_LOGGING=true
```

##### 3. Metrics Collection
```bash
# Prometheus metrics endpoint
GET /metrics
# Returns Prometheus-formatted metrics for:
# - HTTP request duration and count
# - Database connection pool metrics
# - Algorithm performance metrics
# - System resource usage
# - Custom business metrics
```

##### 4. Health Check Integration
```bash
# Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10

# Kubernetes readiness probe  
readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
```

##### 5. Load Balancer Health Checks
```bash
# Configure load balancer to use health endpoint
# AWS ALB Target Group Health Check:
# - Protocol: HTTP
# - Path: /health
# - Healthy threshold: 2
# - Unhealthy threshold: 3
# - Timeout: 5 seconds
# - Interval: 30 seconds
```

#### Monitoring Dashboard Setup

##### 1. Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "Grateful API Monitoring",
    "panels": [
      {
        "title": "API Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Algorithm Performance",
        "type": "graph", 
        "targets": [
          {
            "expr": "rate(algorithm_operation_duration_seconds_sum[5m]) / rate(algorithm_operation_duration_seconds_count[5m])",
            "legendFormat": "Average feed generation time"
          }
        ]
      },
      {
        "title": "Database Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "database_connection_pool_utilization",
            "legendFormat": "Connection pool utilization"
          }
        ]
      },
      {
        "title": "Error Rates",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx error rate"
          }
        ]
      }
    ]
  }
}
```

##### 2. Alert Manager Configuration
```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@yourdomain.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  email_configs:
  - to: 'admin@yourdomain.com'
    subject: 'Grateful API Alert: {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      {{ end }}
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts'
    title: 'Grateful API Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

##### 3. Prometheus Rules
```yaml
# prometheus-rules.yml
groups:
- name: grateful-api
  rules:
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High API response time"
      description: "95th percentile response time is {{ $value }}s"

  - alert: AlgorithmPerformanceDegraded
    expr: rate(algorithm_operation_duration_seconds_sum[5m]) / rate(algorithm_operation_duration_seconds_count[5m]) > 0.3
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Algorithm performance degraded"
      description: "Feed algorithm taking {{ $value }}s on average"

  - alert: DatabaseConnectionPoolHigh
    expr: database_connection_pool_utilization > 0.8
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High database connection pool usage"
      description: "Connection pool utilization is {{ $value }}%"

  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate"
      description: "Error rate is {{ $value }} requests/second"
```

#### Incident Response Procedures

##### 1. Incident Classification
```yaml
# Incident severity levels and response times
Severity Levels:
  P0 - Critical:
    - Service completely down
    - Data loss or corruption
    - Security breach
    - Response time: Immediate (< 15 minutes)
    
  P1 - High:
    - Major feature unavailable
    - Performance severely degraded (>5s response times)
    - Database connection issues
    - Response time: 1 hour
    
  P2 - Medium:
    - Minor feature issues
    - Performance degraded (1-5s response times)
    - Non-critical errors
    - Response time: 4 hours
    
  P3 - Low:
    - Cosmetic issues
    - Minor performance issues
    - Enhancement requests
    - Response time: Next business day
```

##### 2. Incident Response Workflow
```mermaid
graph TD
    A[Alert Triggered] --> B[Incident Created]
    B --> C[Assess Severity]
    C --> D{Severity Level}
    D -->|P0/P1| E[Immediate Response]
    D -->|P2/P3| F[Schedule Response]
    E --> G[Investigate & Diagnose]
    F --> G
    G --> H[Implement Fix]
    H --> I[Verify Resolution]
    I --> J{Fixed?}
    J -->|No| G
    J -->|Yes| K[Close Incident]
    K --> L[Post-Mortem]
```

##### 3. Automated Incident Response
```python
# Automated response procedures
AUTOMATED_RESPONSES = {
    "database_connection_failure": [
        "restart_connection_pool",
        "check_database_health", 
        "escalate_if_not_resolved"
    ],
    "high_memory_usage": [
        "trigger_garbage_collection",
        "restart_worker_processes",
        "scale_horizontally"
    ],
    "algorithm_performance_degraded": [
        "clear_algorithm_cache",
        "restart_algorithm_service",
        "fallback_to_simple_algorithm"
    ]
}
```

##### 4. Communication Templates
```markdown
# Incident Communication Templates

## Initial Incident Report
Subject: [P{severity}] {service} - {brief_description}

We are currently investigating an issue with {service_name}.

**Impact**: {impact_description}
**Started**: {start_time}
**Status**: Investigating
**ETA**: {estimated_resolution_time}

We will provide updates every {update_interval} minutes.

## Incident Update
Subject: [UPDATE] [P{severity}] {service} - {brief_description}

**Update**: {update_description}
**Current Status**: {current_status}
**Next Update**: {next_update_time}

## Incident Resolution
Subject: [RESOLVED] [P{severity}] {service} - {brief_description}

The incident has been resolved.

**Resolution**: {resolution_description}
**Root Cause**: {root_cause}
**Duration**: {total_duration}
**Preventive Measures**: {prevention_measures}
```

### Monitoring Best Practices

#### 1. Metric Collection Strategy
- **Golden Signals**: Latency, Traffic, Errors, Saturation
- **Business Metrics**: User registrations, post creation, engagement
- **Infrastructure Metrics**: CPU, memory, disk, network
- **Application Metrics**: Response times, error rates, throughput

#### 2. Alert Fatigue Prevention
- **Meaningful Alerts**: Only alert on actionable issues
- **Alert Grouping**: Group related alerts to reduce noise
- **Rate Limiting**: Prevent alert spam with rate limiting
- **Escalation Policies**: Escalate unacknowledged alerts

#### 3. Dashboard Design
- **Executive Dashboard**: High-level business and health metrics
- **Operations Dashboard**: Detailed system and performance metrics
- **Developer Dashboard**: Application-specific metrics and errors
- **Mobile-Friendly**: Ensure dashboards work on mobile devices

#### 4. Monitoring Coverage
- **End-to-End Monitoring**: Monitor complete user journeys
- **Dependency Monitoring**: Monitor external dependencies
- **Synthetic Monitoring**: Proactive monitoring with synthetic tests
- **Real User Monitoring**: Track actual user experienceve alert manually
POST /api/v1/monitoring/alerts/{alert_id}/resolve
Response: {
  "status": "success",
  "message": "Alert resolved successfully",
  "resolved_by": 123
}
```

### Frontend Error Tracking

The system includes comprehensive frontend error tracking:

#### Error Types Tracked
- **JavaScript Errors**: Runtime errors, syntax errors, reference errors
- **API Errors**: Failed API calls, network errors, timeout errors
- **Component Errors**: React component crashes, rendering errors
- **Network Errors**: Connection failures, DNS resolution errors

#### Error Reporting Features
- **Automatic Detection**: Global error handlers capture all errors
- **Rate Limiting**: Prevents error spam (max 10 errors per minute per type)
- **Batching**: Errors sent in batches every 30 seconds
- **Session Tracking**: Errors linked to user sessions
- **User Context**: User ID and session information included
- **Stack Traces**: Full error stack traces for debugging

#### Frontend Error API
```bash
# Report frontend errors (automatic)
POST /api/errors/report
Request: {
  "errors": [
    {
      "id": "error-1704715200-abc123",
      "type": "javascript",
      "severity": "critical",
      "message": "ChunkLoadError: Loading chunk 2 failed",
      "stack": "Error: Loading chunk 2 failed...",
      "url": "https://app.yourdomain.com/feed",
      "userAgent": "Mozilla/5.0...",
      "sessionId": "session-1704715200-xyz789",
      "userId": "123",
      "metadata": {...}
    }
  ]
}

# Get error statistics
GET /api/errors/stats
Response: {
  "stats": {
    "total_errors_24h": 45,
    "critical_errors_24h": 3,
    "error_rate_per_hour": 1.8,
    "top_error_types": ["javascript", "api", "network"],
    "affected_users": 12
  }
}
```

#### Alert Integration

The system includes built-in alert callbacks that can be integrated with monitoring systems:

```python
# Add custom alert callback
from app.core.error_alerting import alert_manager

# Setup multiple alert channels
setup_email_alerts(...)  # Email notifications
setup_slack_alerts(...)  # Slack integration
setup_webhook_alerts(...)  # Custom webhook

# Custom alert rules
alert_manager.add_custom_rule(
    rule_name="custom_performance_alert",
    alert_type=AlertType.ALGORITHM_PERFORMANCE,
    severity=AlertSeverity.WARNING,
    title="Custom Performance Alert",
    message_template="Custom condition met: {details}",
    rate_limit_minutes=10
)
```

## Deployment Checklist

### Pre-Deployment

- [ ] Update `.env.production` with secure values
- [ ] Verify SECRET_KEY is not default value
- [ ] Configure ALLOWED_ORIGINS for production domains
- [ ] Set up SSL/TLS certificates
- [ ] Configure database with SSL and connection pooling
- [ ] Set up automated backup strategy with retention policy
- [ ] Configure database performance monitoring
- [ ] Set up index monitoring and optimization
- [ ] Configure migration rollback procedures
- [ ] Set up performance alerting thresholds
- [ ] Configure monitoring and alerting

### Security Validation

- [ ] Run security tests: `pytest tests/unit/test_security_features.py`
- [ ] Verify rate limiting works: Test with multiple requests
- [ ] Check security headers: Use online security scanner
- [ ] Validate CORS configuration: Test from allowed/blocked origins
- [ ] Test input sanitization: Submit malicious payloads to endpoints
- [ ] Verify authentication works: Test login/signup flows
- [ ] Check middleware functionality: Ensure no request body consumption issues
- [ ] Verify audit logging: Check log output format

### Performance Testing

- [ ] Load test critical endpoints
- [ ] Verify database performance under load
- [ ] Test connection pool behavior under high concurrency
- [ ] Validate query performance with production data volumes
- [ ] Test backup and restore procedures
- [ ] Verify migration rollback capabilities
- [ ] Test rate limiting under high traffic
- [ ] Monitor memory usage during peak load
- [ ] Validate caching effectiveness
- [ ] Test index recommendations and optimizations

### Post-Deployment

- [ ] Monitor security logs for anomalies
- [ ] Verify all health checks pass (including database health)
- [ ] Test user registration and authentication
- [ ] Validate file upload functionality
- [ ] Monitor performance metrics and database performance
- [ ] Verify backup system is running and successful
- [ ] Check database connection pool utilization
- [ ] Monitor query performance and slow query rates
- [ ] Validate index usage and optimization recommendations
- [ ] Set up log aggregation and analysis
- [ ] Test migration procedures in staging environment
- [ ] Verify alert system is functioning correctly

## Security Incident Response

### Detection

Monitor for these indicators:
- Unusual rate limit violations
- Multiple failed authentication attempts
- Suspicious user agent patterns
- Unexpected traffic spikes
- Invalid token usage patterns

### Response Procedures

1. **Immediate Response**
   - Review security logs
   - Identify affected users/endpoints
   - Implement temporary rate limit reductions if needed

2. **Investigation**
   - Analyze attack patterns
   - Check for data breaches
   - Review system integrity

3. **Mitigation**
   - Block malicious IP addresses
   - Revoke compromised tokens
   - Update security configurations

4. **Recovery**
   - Restore normal operations
   - Update security measures
   - Document lessons learned

## Compliance Considerations

### Data Protection

- **GDPR Compliance**: User data handling and deletion
- **Data Encryption**: At rest and in transit
- **Access Controls**: Role-based permissions
- **Audit Trails**: Complete activity logging

### Security Standards

- **OWASP Top 10**: Protection against common vulnerabilities
- **Security Headers**: Comprehensive browser protection
- **Input Validation**: Prevent injection attacks
- **Authentication**: Secure token management

## Troubleshooting

### Common Issues

#### Rate Limiting False Positives
```bash
# Check rate limit status
curl -H "Authorization: Bearer $TOKEN" \
     -I https://api.yourdomain.com/api/v1/posts

# Look for headers:
# X-RateLimit-Remaining: 95
# X-RateLimit-Reset: 1694728800
```

#### Authentication Issues
```bash
# Test login endpoint
curl -X POST "http://localhost:8000/api/v1/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password"}'

# Verify token format
echo $TOKEN | base64 -d | jq .

# Check token expiration
# Look for 'exp' claim in decoded token

# Test with case-sensitive emails
# Database lookups are case-sensitive, ensure exact email match
```

#### Input Sanitization Issues
```bash
# Test endpoint-level sanitization
curl -X POST "http://localhost:8000/api/v1/posts" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"content": "<script>alert(\"xss\")</script>"}'

# Verify XSS content is escaped in response
# Check that malicious content is sanitized but functionality preserved
```

#### Security Header Issues
```bash
# Test security headers
curl -I https://api.yourdomain.com/health

# Verify CSP, HSTS, and other security headers
```

### Log Analysis

```bash
# Search for security events
grep "SECURITY" /var/log/grateful-api.log

# Monitor rate limiting
grep "rate_limit_exceeded" /var/log/grateful-api.log

# Check authentication failures
grep "LOGIN_FAILURE" /var/log/grateful-api.log
```

## Updates and Maintenance

### Security Updates

- **Regular Updates**: Keep dependencies updated
- **Security Patches**: Apply critical patches immediately
- **Configuration Review**: Quarterly security configuration review
- **Penetration Testing**: Annual security assessments

### Monitoring Updates

- **Log Rotation**: Configure log rotation to prevent disk space issues
- **Metric Collection**: Ensure monitoring systems are functioning
- **Alert Testing**: Regularly test alerting mechanisms
- **Backup Verification**: Test backup restoration procedures

---

For additional support or security concerns, please refer to the development team or security team contacts.