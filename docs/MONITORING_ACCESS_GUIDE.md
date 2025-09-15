# Monitoring and Logging Access Guide

This comprehensive guide explains how to access logs, monitoring dashboards, and health check endpoints in the Grateful API.

## Table of Contents

- [Quick Start](#quick-start)
- [Security Overview](#security-overview)
- [Health Check Endpoints](#health-check-endpoints)
- [Accessing Logs](#accessing-logs)
- [Monitoring Dashboard](#monitoring-dashboard)
- [Error Tracking](#error-tracking)
- [Production Setup](#production-setup)

## Quick Start

### 🚀 **Setup Complete!**

Your monitoring system is now configured and ready to use!

### 🔑 **Access Configuration**

1. **Generate Monitoring Token:**
```bash
# Generate a secure monitoring token
MONITORING_TOKEN=$(openssl rand -hex 32)
echo "Your monitoring token: $MONITORING_TOKEN"
```

2. **Configure Environment:**
```bash
# Copy and edit monitoring configuration
cp apps/api/.env.monitoring.example apps/api/.env.monitoring

# Edit with your secure values
nano apps/api/.env.monitoring
```

3. **Set Allowed IPs:**
```bash
# Configure allowed IP addresses (localhost and private networks)
MONITORING_ALLOWED_IPS=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### 🎯 **Quick Access Commands**

#### Using the Monitoring Script (Recommended)
```bash
# Check all systems
./scripts/monitoring.sh all

# Individual checks
./scripts/monitoring.sh health          # Basic health
./scripts/monitoring.sh metrics         # System metrics
./scripts/monitoring.sh detailed        # Detailed health
./scripts/monitoring.sh alerts          # Active alerts
./scripts/monitoring.sh test-auth       # Test authentication
```

#### Direct API Access
```bash
# Public endpoints (no auth required)
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8000/api/errors/stats

# Secured endpoints (require token)
curl -H "Authorization: Bearer YOUR_MONITORING_TOKEN" \
     http://localhost:8000/metrics

curl -H "Authorization: Bearer YOUR_MONITORING_TOKEN" \
     http://localhost:8000/health/detailed
```

### 📊 **Available Endpoints**

#### Public Endpoints
- **`/health`** - Basic health check for load balancers
- **`/ready`** - Kubernetes readiness probe with dependency checks
- **`/api/errors/report`** - Frontend error reporting (rate limited)
- **`/api/errors/stats`** - Error statistics

#### Secured Endpoints (Require Token + IP Whitelist)
- **`/metrics`** - Comprehensive system metrics
- **`/health/detailed`** - Detailed system health overview
- **`/health/database`** - Database health with statistics
- **`/health/algorithm`** - Algorithm performance health
- **`/api/v1/monitoring/dashboard`** - Complete monitoring dashboard
- **`/api/v1/monitoring/alerts`** - Alert management
- **`/api/v1/monitoring/incidents`** - Incident management

### 🔒 **Security Features**

✅ **IP Whitelisting** - Only allowed networks can access monitoring
✅ **Token Authentication** - Secure token required for sensitive endpoints
✅ **Rate Limiting** - Prevents abuse of public endpoints
✅ **Audit Logging** - All access attempts are logged

### 🚨 **Monitoring Features**

✅ **Real-time Metrics** - CPU, memory, disk, database, algorithm performance
✅ **Health Checks** - Comprehensive dependency and component health
✅ **Error Tracking** - Frontend and backend error monitoring
✅ **Incident Management** - Automated incident detection and resolution
✅ **Performance Monitoring** - Algorithm performance tracking (300ms target)
✅ **Uptime Monitoring** - Continuous service availability monitoring

### 📈 **Example Monitoring Dashboard**

```bash
# Get complete system overview
./scripts/monitoring.sh all
```

This will show:
- ✅ Service health status
- 📊 System resource usage (CPU, memory, disk)
- 🗄️ Database connection pool status
- ⚡ Algorithm performance metrics
- 🚨 Active alerts and incidents
- 📝 Error statistics

### 🛠️ **Configuration Files**

- **`apps/api/.env.monitoring`** - Monitoring security configuration
- **`scripts/monitoring.sh`** - Convenient access script
- **`docs/MONITORING_ACCESS_GUIDE.md`** - This comprehensive guide

### 🔧 **Customization**

To modify monitoring settings, edit `apps/api/.env.monitoring`:

```bash
# Enable/disable IP whitelist
ENABLE_MONITORING_IP_WHITELIST=true

# Add your monitoring server IPs
MONITORING_ALLOWED_IPS=127.0.0.1,your.monitoring.server.ip

# Generate new token
MONITORING_TOKEN=$(openssl rand -hex 32)
```

## Security Overview

The monitoring system implements multiple security layers:

### **Public Endpoints** (No Authentication Required)
- `/health` - Basic health check for load balancers
- `/ready` - Kubernetes readiness probe
- `/api/errors/report` - Frontend error reporting (rate limited)

### **Restricted Endpoints** (Requires Authentication + IP Whitelist)
- `/metrics` - Comprehensive system metrics
- `/health/detailed` - Detailed system health
- `/health/database` - Database health with statistics
- `/health/algorithm` - Algorithm performance health
- `/api/v1/monitoring/*` - All monitoring dashboard endpoints

### **Security Configuration**

Create a `.env.monitoring` file based on the example:

```bash
# Copy the example configuration
cp .env.monitoring.example .env.monitoring

# Edit with your secure values
nano .env.monitoring
```

**Required Configuration:**
```bash
# Generate a secure monitoring token
MONITORING_TOKEN=$(openssl rand -hex 32)

# Configure allowed IP addresses (your monitoring server IPs)
MONITORING_ALLOWED_IPS=127.0.0.1,10.0.0.0/8,your.monitoring.server.ip

# Enable security features
ENABLE_MONITORING_IP_WHITELIST=true
ENABLE_MONITORING_TOKEN_AUTH=true
```

## Health Check Endpoints

### **Basic Health Check** (Public)
```bash
# Simple health check for load balancers
curl http://localhost:8000/health

# Response:
{
  "status": "healthy",
  "service": "grateful-api",
  "timestamp": "2025-01-08T10:00:00Z",
  "version": "1.0.0"
}
```

### **Readiness Check** (Public)
```bash
# Kubernetes readiness probe
curl http://localhost:8000/ready

# Response includes dependency checks:
{
  "status": "ready",
  "timestamp": "2025-01-08T10:00:00Z",
  "response_time_ms": 45.2,
  "checks": {
    "database": {"status": "healthy"},
    "algorithm": {"status": "healthy"},
    "filesystem": {"status": "healthy"}
  }
}
```

### **Comprehensive Metrics** (Secured)
```bash
# Requires monitoring token and IP whitelist
curl -H "Authorization: Bearer your-monitoring-token" \
     http://localhost:8000/metrics

# Or using query parameter (less secure)
curl "http://localhost:8000/metrics?token=your-monitoring-token"

# Response includes detailed system metrics:
{
  "timestamp": "2025-01-08T10:00:00Z",
  "database": {"status": "healthy", "connection_pool": {...}},
  "algorithm": {"status": "healthy", "operations": {...}},
  "system": {"cpu_percent": 25.5, "memory_percent": 45.2}
}
```

### **Detailed Health Check** (Secured)
```bash
# Complete system health overview
curl -H "Authorization: Bearer your-monitoring-token" \
     http://localhost:8000/health/detailed

# Response includes all components and issues:
{
  "status": "healthy",
  "issues": [],
  "components": {
    "database": {"status": "healthy"},
    "algorithm": {"status": "healthy"},
    "system": {"cpu_percent": 25.5}
  }
}
```

## Accessing Logs

### **Development Logs**

**Console Output:**
```bash
# Start server with logging
cd apps/api
PYTHONPATH=/home/user/grateful/apps/api uvicorn main:app --reload

# Logs appear in console with structured format
```

**Log Files:**
```bash
# If running with nohup
nohup uvicorn main:app --reload > server.log 2>&1 &

# View logs
tail -f server.log

# Search logs
grep "ERROR" server.log
grep "request_id" server.log | jq .
```

### **Production Logs**

**Structured JSON Logging:**
```bash
# Enable JSON logging for production
export LOG_FORMAT=json
export LOG_LEVEL=INFO
export ENVIRONMENT=production

# Logs will be in JSON format for log aggregation
```

**Log Aggregation Setup:**

**1. ELK Stack (Elasticsearch, Logstash, Kibana)**
```yaml
# docker-compose.yml for ELK
version: '3'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
  
  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"
  
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
```

**2. Grafana Loki**
```yaml
# docker-compose.yml for Loki
version: '3'
services:
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
  
  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

**3. Filebeat Configuration**
```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /path/to/grateful/logs/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["localhost:9200"]
  index: "grateful-api-%{+yyyy.MM.dd}"

setup.template.name: "grateful-api"
setup.template.pattern: "grateful-api-*"
```

### **Log Analysis Queries**

**Search by Request ID:**
```bash
# Find all logs for a specific request
grep "req-1234567890ab" server.log

# In Elasticsearch/Kibana
{
  "query": {
    "match": {
      "request_id": "req-1234567890ab"
    }
  }
}
```

**Error Analysis:**
```bash
# Find all errors in the last hour
grep "ERROR" server.log | grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')"

# In Elasticsearch/Kibana
{
  "query": {
    "bool": {
      "must": [
        {"match": {"level": "ERROR"}},
        {"range": {"timestamp": {"gte": "now-1h"}}}
      ]
    }
  }
}
```

**Performance Analysis:**
```bash
# Find slow requests (>1000ms)
grep "response_time_ms" server.log | jq 'select(.response_time_ms > 1000)'

# Algorithm performance issues
grep "algorithm_performance" server.log | jq 'select(.duration_ms > 300)'
```

## Monitoring Dashboard

### **API Endpoints**

**Dashboard Data:**
```bash
# Get complete monitoring dashboard (requires auth)
curl -H "Authorization: Bearer your-token" \
     "http://localhost:8000/api/v1/monitoring/dashboard?time_range_minutes=60"

# Response includes:
{
  "overall_status": "healthy",
  "current_metrics": {...},
  "uptime_stats": {...},
  "service_statuses": {...},
  "active_incidents": [],
  "alert_stats": {...}
}
```

**Alert Management:**
```bash
# Get alerts
curl -H "Authorization: Bearer your-token" \
     "http://localhost:8000/api/v1/monitoring/alerts?hours=24"

# Get incidents
curl -H "Authorization: Bearer your-token" \
     "http://localhost:8000/api/v1/monitoring/incidents"

# Resolve alert
curl -X POST -H "Authorization: Bearer your-token" \
     "http://localhost:8000/api/v1/monitoring/alerts/alert-id/resolve"
```

### **Grafana Dashboard Setup**

**1. Install Grafana:**
```bash
# Docker
docker run -d -p 3000:3000 --name grafana grafana/grafana

# Access: http://localhost:3000 (admin/admin)
```

**2. Configure Data Source:**
```json
{
  "name": "Grateful API",
  "type": "prometheus",
  "url": "http://localhost:8000/metrics",
  "access": "proxy",
  "basicAuth": false,
  "httpHeaderName1": "Authorization",
  "httpHeaderValue1": "Bearer your-monitoring-token"
}
```

**3. Import Dashboard:**
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
            "expr": "api_response_time_ms",
            "legendFormat": "Response Time"
          }
        ]
      },
      {
        "title": "Algorithm Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "feed_algorithm_time_ms",
            "legendFormat": "Feed Generation Time"
          }
        ]
      }
    ]
  }
}
```

### **Custom Monitoring Scripts**

**Health Check Script:**
```bash
#!/bin/bash
# health-check.sh

TOKEN="your-monitoring-token"
API_URL="http://localhost:8000"

# Check basic health
echo "=== Basic Health ==="
curl -s "$API_URL/health" | jq .

# Check detailed health (with auth)
echo "=== Detailed Health ==="
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/health/detailed" | jq .

# Check metrics
echo "=== System Metrics ==="
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/metrics" | jq '.system'
```

**Alert Check Script:**
```bash
#!/bin/bash
# check-alerts.sh

TOKEN="your-monitoring-token"
API_URL="http://localhost:8000"

# Get active alerts
ALERTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
         "$API_URL/api/v1/monitoring/alerts" | jq '.active_alerts | length')

if [ "$ALERTS" -gt 0 ]; then
    echo "⚠️  $ALERTS active alerts found!"
    curl -s -H "Authorization: Bearer $TOKEN" \
         "$API_URL/api/v1/monitoring/alerts" | jq '.active_alerts'
else
    echo "✅ No active alerts"
fi
```

## Error Tracking

### **Frontend Error Reporting**

**Automatic Error Tracking:**
```typescript
// Frontend errors are automatically reported
import { trackedFetch } from '@/utils/errorTracking';

// Use trackedFetch instead of regular fetch
const response = await trackedFetch('/api/v1/posts');
```

**Manual Error Reporting:**
```typescript
import { reportError } from '@/utils/errorTracking';

// Report custom errors
reportError('Custom error message', {
  component: 'MyComponent',
  action: 'button_click',
  additional_data: {...}
});
```

### **Error Statistics**

```bash
# Get error statistics
curl http://localhost:8000/api/errors/stats

# Response:
{
  "timestamp": "2025-01-08T10:00:00Z",
  "stats": {
    "total_errors_24h": 45,
    "critical_errors_24h": 2,
    "error_rate_per_hour": 1.9,
    "top_error_types": ["javascript", "api", "component"],
    "error_trends": {...}
  }
}
```

## Production Setup

### **1. Environment Configuration**

```bash
# Production environment variables
export ENVIRONMENT=production
export LOG_LEVEL=INFO
export LOG_FORMAT=json
export ENABLE_MONITORING_IP_WHITELIST=true
export ENABLE_MONITORING_TOKEN_AUTH=true
export MONITORING_TOKEN=$(openssl rand -hex 32)
export MONITORING_ALLOWED_IPS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
```

### **2. Kubernetes Deployment**

```yaml
# k8s-monitoring.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: monitoring-config
data:
  MONITORING_TOKEN: "your-secure-token"
  MONITORING_ALLOWED_IPS: "10.0.0.0/8,172.16.0.0/12"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grateful-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: grateful-api:latest
        envFrom:
        - configMapRef:
            name: monitoring-config
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### **3. Load Balancer Configuration**

```nginx
# nginx.conf
upstream grateful_api {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api.grateful.com;

    # Health checks (public)
    location /health {
        proxy_pass http://grateful_api;
    }

    location /ready {
        proxy_pass http://grateful_api;
    }

    # Monitoring endpoints (restricted)
    location /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://grateful_api;
    }

    location /api/v1/monitoring/ {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://grateful_api;
    }
}
```

### **4. Monitoring Alerts Setup**

```bash
# Set up email alerts
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=alerts@yourdomain.com
export SMTP_PASSWORD=your-app-password
export ALERT_EMAIL_TO=admin@yourdomain.com,devops@yourdomain.com

# Set up Slack alerts
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

## Security Best Practices

### **1. Token Management**
- Generate strong monitoring tokens (32+ characters)
- Rotate tokens regularly
- Store tokens securely (environment variables, secrets management)
- Use different tokens for different environments

### **2. Network Security**
- Use IP whitelisting for monitoring endpoints
- Deploy behind a VPN or private network
- Use HTTPS in production
- Implement rate limiting

### **3. Access Control**
- Limit monitoring access to authorized personnel
- Use separate tokens for different monitoring systems
- Log all monitoring access attempts
- Implement token expiration if needed

### **4. Monitoring the Monitoring**
- Monitor the monitoring system itself
- Set up alerts for monitoring system failures
- Have backup monitoring systems
- Regular health checks of monitoring infrastructure

## Next Steps

### 🚀 **Production Deployment**

1. **Set up Grafana Dashboard** - Use `/metrics` endpoint as data source
2. **Configure Alerts** - Set up email/Slack notifications
3. **Production Deployment** - Update IP whitelist for production servers
4. **Log Aggregation** - Set up ELK stack or similar for log analysis

### 📞 **Support**

- **Documentation:** This comprehensive guide
- **Health Check:** `./scripts/monitoring.sh health`
- **Test Auth:** `./scripts/monitoring.sh test-auth`
- **Configuration:** `apps/api/.env.monitoring`

---

**🎉 Your monitoring system is ready! All endpoints are secured and operational.**

## Troubleshooting

### **Common Issues**

**1. Access Denied Errors:**
```bash
# Check IP whitelist
curl -v http://localhost:8000/metrics
# Look for 403 Forbidden

# Solution: Add your IP to MONITORING_ALLOWED_IPS
```

**2. Invalid Token Errors:**
```bash
# Check token authentication
curl -H "Authorization: Bearer wrong-token" http://localhost:8000/metrics
# Look for 401 Unauthorized

# Solution: Use correct MONITORING_TOKEN
```

**3. Health Check Failures:**
```bash
# Check service status
curl http://localhost:8000/health
# Look for "unhealthy" status

# Check detailed health
curl -H "Authorization: Bearer token" http://localhost:8000/health/detailed
# Look for specific component issues
```

### **Debug Commands**

```bash
# Check monitoring configuration
env | grep MONITORING

# Test token authentication
echo "Authorization: Bearer $MONITORING_TOKEN"

# Verify IP whitelist
curl -H "Authorization: Bearer $MONITORING_TOKEN" \
     "http://localhost:8000/metrics" -v

# Check logs for access attempts
grep "monitoring_access" server.log
```

This comprehensive guide provides secure access to all monitoring and logging capabilities while maintaining proper security controls.