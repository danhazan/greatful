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

### Sanitization Rules

The API automatically sanitizes all user input based on field types:

#### Field-Specific Sanitization

| Field Type | Rules |
|-----------|-------|
| `username` | Alphanumeric + `_.-`, max 50 chars |
| `email` | Lowercase, valid email format, max 254 chars |
| `post_content` | HTML escaped, line breaks normalized, max 2000 chars |
| `bio` | HTML escaped, max 500 chars |
| `url` | Auto-add HTTPS scheme, max 500 chars |

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
# Use SSL connections
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db?ssl=require

# Connection pooling
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
DB_POOL_TIMEOUT=30
```

### Query Security

- **Parameterized Queries**: All database queries use SQLAlchemy ORM
- **Input Validation**: All inputs validated before database operations
- **Connection Limits**: Configured connection pooling prevents exhaustion

### Backup Strategy

```bash
# Daily automated backups
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > backup_$(date +%Y%m%d).sql.gz

# Retention policy: 30 days
find /backups -name "backup_*.sql.gz" -mtime +30 -delete
```

## Performance Optimization

### Caching Strategy

```python
# Redis configuration for production
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=3600  # 1 hour default

# Cached endpoints
- User profiles: 15 minutes
- Post feeds: 5 minutes  
- Notification counts: 1 minute
```

### Database Optimization

```sql
-- Essential indexes
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_followed_id ON follows(followed_id);
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

#### Business Metrics
- User registrations
- Post creation rate
- API usage patterns

### Alerting Rules

```yaml
# Example alerting configuration
alerts:
  - name: "High Rate Limit Violations"
    condition: "rate_limit_violations > 100/hour"
    severity: "warning"
    
  - name: "Failed Login Attempts"
    condition: "failed_logins > 50/hour"
    severity: "critical"
    
  - name: "High Response Time"
    condition: "avg_response_time > 2000ms"
    severity: "warning"
```

## Deployment Checklist

### Pre-Deployment

- [ ] Update `.env.production` with secure values
- [ ] Verify SECRET_KEY is not default value
- [ ] Configure ALLOWED_ORIGINS for production domains
- [ ] Set up SSL/TLS certificates
- [ ] Configure database with SSL
- [ ] Set up backup strategy
- [ ] Configure monitoring and alerting

### Security Validation

- [ ] Run security tests: `pytest tests/unit/test_security_features.py`
- [ ] Verify rate limiting works: Test with multiple requests
- [ ] Check security headers: Use online security scanner
- [ ] Validate CORS configuration: Test from allowed/blocked origins
- [ ] Test input sanitization: Submit malicious payloads
- [ ] Verify audit logging: Check log output format

### Performance Testing

- [ ] Load test critical endpoints
- [ ] Verify database performance under load
- [ ] Test rate limiting under high traffic
- [ ] Monitor memory usage during peak load
- [ ] Validate caching effectiveness

### Post-Deployment

- [ ] Monitor security logs for anomalies
- [ ] Verify all health checks pass
- [ ] Test user registration and authentication
- [ ] Validate file upload functionality
- [ ] Monitor performance metrics
- [ ] Set up log aggregation and analysis

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
# Verify token format
echo $TOKEN | base64 -d | jq .

# Check token expiration
# Look for 'exp' claim in decoded token
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