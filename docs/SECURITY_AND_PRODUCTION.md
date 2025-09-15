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

### Health Checks

```bash
# Application health
GET /health
Response: {"status": "healthy", "service": "grateful-api"}

# Database health
GET /health/db
Response: {"status": "healthy", "database": "connected"}
```

### Metrics to Monitor

#### Security Metrics
- Rate limit violations per hour
- Failed authentication attempts
- Invalid token usage
- Suspicious activity events

#### Performance Metrics
- Response times by endpoint
- Database query performance
- Memory and CPU usage
- Active connections

#### Database Performance Metrics
- Connection pool utilization
- Slow query count and rate
- Query failure rate
- Index usage statistics
- Database size and growth
- Backup success/failure rates
- Migration execution times

#### Business Metrics
- User registrations
- Post creation rate
- API usage patterns

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

### Alerting Rules

```yaml
# Example alerting configuration
alerts:
  # Security alerts
  - name: "High Rate Limit Violations"
    condition: "rate_limit_violations > 100/hour"
    severity: "warning"
    
  - name: "Failed Login Attempts"
    condition: "failed_logins > 50/hour"
    severity: "critical"
    
  # Performance alerts
  - name: "High Response Time"
    condition: "avg_response_time > 2000ms"
    severity: "warning"
    
  # Database performance alerts
  - name: "High Connection Pool Usage"
    condition: "connection_pool_utilization > 80%"
    severity: "warning"
    
  - name: "Slow Query Rate High"
    condition: "slow_query_rate > 10%"
    severity: "warning"
    
  - name: "Very Slow Query Detected"
    condition: "individual_query_time > 5s"
    severity: "critical"
    
  - name: "Query Failure Rate High"
    condition: "query_failure_rate > 5%"
    severity: "critical"
    
  - name: "Database Backup Failed"
    condition: "backup_age > 25_hours"
    severity: "critical"
    
  - name: "Database Size Growth"
    condition: "database_growth > 20%_per_week"
    severity: "warning"
    
  - name: "Unused Index Space"
    condition: "unused_index_size > 1GB"
    severity: "info"
```

#### Alert Integration

The system includes built-in alert callbacks that can be integrated with monitoring systems:

```python
# Add custom alert callback
from app.core.query_monitor import query_monitor

def send_to_monitoring_system(alert_data):
    """Send alert to external monitoring system."""
    # Integration with Datadog, New Relic, etc.
    pass

query_monitor.add_alert_callback(send_to_monitoring_system)
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