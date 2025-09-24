# Useful Commands for Grateful Development

## 🗄️ Database Commands

### PostgreSQL Setup and Maintenance

#### Grant All Privileges to a User on the public Schema

If you encounter `permission denied for schema public` errors, you may need to grant all privileges to your database user (e.g., `grateful`).

**Command:**
```bash
PGPASSWORD=iamgreatful psql -U postgres -h localhost -d grateful -c "GRANT ALL ON SCHEMA public TO grateful; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO grateful; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO grateful; GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO grateful;"
```

- Replace `grateful` with your actual database user if different.
- This command must be run as a superuser (e.g., `postgres`).
- It is safe to re-run if you change privileges or add new tables.

#### Create Database and User
```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database and user
CREATE DATABASE grateful;
CREATE USER grateful WITH PASSWORD 'iamgreatful';
GRANT ALL PRIVILEGES ON DATABASE grateful TO grateful;
\q
```

#### Reset Database (Development)
```bash
# Drop and recreate database
dropdb -U postgres grateful
createdb -U postgres grateful

# Or using psql
psql -U postgres -c "DROP DATABASE IF EXISTS grateful; CREATE DATABASE grateful;"
```

### Database Queries

#### Get all users
```bash
PGPASSWORD=iamgreatful psql -U grateful -h localhost -d grateful -c "SELECT id, username, email FROM users;" | cat
```

## 🚀 Development Commands

### Backend (FastAPI)

#### Setup Virtual Environment
```bash
cd apps/api
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Run Backend Server
```bash
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Run Backend Tests
```bash
cd apps/api
source venv/bin/activate

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test categories
pytest tests/unit/                    # Unit tests only
pytest tests/integration/             # Integration tests only
pytest tests/contract/                # API contract tests only

# Run specific test files
pytest tests/unit/test_user_service.py
pytest tests/integration/test_reactions_api.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test by name
pytest -k "test_create_post"
```

#### Test Backend Server Startup

A quick way to check if the server starts up correctly. The server will run for 10 seconds and then shut down.

```bash
cd apps/api
source venv/bin/activate
timeout 10s uvicorn main:app --reload --host 0.0.0.0 --port 8000 || true
```

#### Database Migrations
```bash
cd apps/api
source venv/bin/activate
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Frontend (Next.js)

#### Install Dependencies
```bash
cd apps/web
npm install
# or
yarn install
# or
pnpm install
```

#### Run Development Server
```bash
cd apps/web
npm run dev
# or
yarn dev
# or
pnpm dev
```

#### Run Tests
```bash
cd apps/web

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test files
npm test PostCard.test.tsx
npm test -- --testPathPattern=components

# Run with coverage
npm test -- --coverage

# Run API tests specifically
npm test -- tests/api/

# Type checking
npm run type-check
```

#### Build for Production
```bash
cd apps/web
npm run build
# or
yarn build
# or
pnpm build
```

## 🐳 Docker Commands

### Start All Services
```bash
cd infrastructure
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres
```

### Stop Services
```bash
docker-compose down
```

### Rebuild Services
```bash
docker-compose up -d --build
```

### Shared Types

#### Type Checking and Building
```bash
cd shared/types

# Install dependencies
npm install

# Type checking
npm run type-check

# Build shared types
npm run build

# Lint types
npm run lint

# Format types
npm run format
```

#### Validate Type Consistency
```bash
# Check that frontend uses shared types correctly
cd apps/web
npm run type-check

# Check that backend Python types are consistent
cd apps/api
source venv/bin/activate
python -c "from app.schemas.api import *; print('Python types OK')"

# Run contract tests to validate API consistency
pytest tests/contract/ -v
```

## 🔧 Utility Commands

### Check Service Status
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check if Redis is running
redis-cli ping

# Check if backend is responding
curl http://localhost:8000/health

# Check if frontend is responding
curl http://localhost:3000
```

### Environment Setup
```bash
# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Edit environment files
nano apps/api/.env
nano apps/web/.env.local
```

### Git Commands
```bash
# Check status
git status

# Add all changes
git add .

# Commit changes
git commit -m "description"

# Push to remote
git push origin main
```

## 🚨 Troubleshooting Commands

### Kill All Development Servers

This command is useful when you want to quickly stop all running development servers, including the FastAPI backend (`uvicorn`) and the Next.js frontend (`npm run dev`). The `|| true` part ensures that the command doesn't fail if one of the processes isn't running.

```bash
pkill -f "uvicorn\|npm.*dev" || true
```

### Clear Caches
```bash
# Clear Next.js cache
cd apps/web
rm -rf .next
rm -rf node_modules/.cache

# Clear Python cache
cd apps/api
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type f -name "*.pyc" -delete
```

### Reset Everything
```bash
# Stop all services
docker-compose down

# Remove volumes
docker-compose down -v

# Rebuild and start
docker-compose up -d --build
```

## 📊 Monitoring Commands

### Check Resource Usage
```bash
# Check Docker resource usage
docker stats

# Check disk usage
df -h

# Check memory usage
free -h
```

## 🔄 CI/CD Commands

### Run Full Test Suite (as CI would)
```bash
# Shared types validation
cd shared/types && npm run type-check && npm run build

# Backend tests (including contract validation)
cd apps/api && source venv/bin/activate && pytest --cov=app

# Frontend tests (including type checking)
cd apps/web && npm run type-check && npm test
```

### Validate Entire System
```bash
# Full system validation
cd shared/types && npm run build
cd apps/api && source venv/bin/activate && pytest tests/contract/
cd apps/web && npm run type-check && npm test

# Check API contract consistency
cd apps/api && source venv/bin/activate && pytest tests/contract/test_api_contracts.py -v

# Validate shared types are properly used
cd apps/web && npm run type-check
cd shared/types && npm run lint
```

## 📊 Production Monitoring Commands

### Health Checks

#### Application Health
```bash
# Basic health check
curl http://localhost:8000/health

# Detailed health with metrics
curl http://localhost:8000/health/detailed

# Database health
curl http://localhost:8000/health/database?include_stats=true

# Algorithm performance health
curl http://localhost:8000/health/algorithm

# Frontend health
curl http://localhost:3000/api/health
```

#### System Health Monitoring
```bash
# Check all services status
docker-compose ps

# Monitor resource usage
docker stats --no-stream

# Check disk usage
df -h

# Check memory usage
free -h

# Check system load
uptime

# Monitor network connections
netstat -tulpn | grep LISTEN
```

### Performance Monitoring

#### Database Performance
```bash
# Check database connection pool status
PGPASSWORD=password psql -h localhost -U grateful -d grateful_prod -c "
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  now() - query_start as duration
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start;"

# Check slow queries
PGPASSWORD=password psql -h localhost -U grateful -d grateful_prod -c "
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;"

# Check database size and table statistics
PGPASSWORD=password psql -h localhost -U grateful -d grateful_prod -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

#### Application Performance
```bash
# Get application metrics
curl http://localhost:8000/metrics

# Check algorithm performance
curl http://localhost:8000/api/v1/monitoring/performance?time_range_minutes=60

# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/v1/posts/feed

# Create curl timing format file
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF
```

## 💾 Backup and Recovery Commands

### Database Backup
```bash
# Create manual database backup
PGPASSWORD=password pg_dump \
  -h localhost \
  -U grateful \
  -d grateful_prod \
  --format=custom \
  --compress=9 \
  > backup_$(date +%Y%m%d_%H%M%S).dump

# Create compressed backup
PGPASSWORD=password pg_dump \
  -h localhost \
  -U grateful \
  -d grateful_prod \
  --format=custom \
  --compress=9 \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).dump.gz

# List available backups
ls -la /opt/grateful/backups/*.dump.gz

# Verify backup integrity
PGPASSWORD=password pg_restore --list backup_file.dump.gz
```

### Database Recovery
```bash
# Restore from backup (creates new database)
PGPASSWORD=password createdb grateful_restore
PGPASSWORD=password pg_restore \
  -h localhost \
  -U grateful \
  -d grateful_restore \
  --verbose \
  backup_file.dump

# Restore to existing database (drops existing data)
PGPASSWORD=password pg_restore \
  -h localhost \
  -U grateful \
  -d grateful_prod \
  --clean \
  --if-exists \
  --verbose \
  backup_file.dump
```

### Application Files Backup
```bash
# Backup application files
tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /opt/grateful \
  --exclude='backups' \
  --exclude='logs' \
  --exclude='data' \
  --exclude='.git' \
  .

# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /opt/grateful \
  uploads/

# Restore application files
tar -xzf app_backup_file.tar.gz -C /opt/grateful/
```

## 🔧 Maintenance Commands

### Daily Maintenance
```bash
# Check service status
docker-compose ps

# Check logs for errors
docker-compose logs --tail=100 backend | grep -i error
docker-compose logs --tail=100 frontend | grep -i error

# Clean old logs
find /opt/grateful/logs -name "*.log" -mtime +7 -exec gzip {} \;
find /opt/grateful/logs -name "*.gz" -mtime +30 -delete

# Update SSL certificates
sudo certbot renew --quiet

# Database maintenance
PGPASSWORD=password psql -h localhost -U grateful -d grateful_prod -c "VACUUM ANALYZE;"

# Check disk space
df -h | grep -E "(Filesystem|/dev/)"
```

### Weekly Maintenance
```bash
# System updates check
sudo apt update && sudo apt list --upgradable

# Docker cleanup
docker system prune -f
docker volume prune -f

# Database optimization
PGPASSWORD=password psql -h localhost -U grateful -d grateful_prod -c "REINDEX DATABASE grateful_prod;"

# Performance analysis
docker stats --no-stream
```

### Security Monitoring
```bash
# Check failed login attempts
grep "LOGIN_FAILURE" /opt/grateful/logs/security.log | grep "$(date +%Y-%m-%d)" | wc -l

# Check rate limit violations
grep "RATE_LIMIT_EXCEEDED" /opt/grateful/logs/security.log | grep "$(date +%Y-%m-%d)" | wc -l

# Check for suspicious activity
grep -E "(SQL injection|XSS|CSRF)" /opt/grateful/logs/security.log | grep "$(date +%Y-%m-%d)"

# Check SSL certificate expiration
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Check firewall status
sudo ufw status verbose

# Check fail2ban status
sudo fail2ban-client status
sudo fail2ban-client status nginx-http-auth
```

## 🚨 Incident Response Commands

### Emergency Procedures
```bash
# Stop all services immediately
docker-compose down

# Check system resources
df -h
free -h
top -bn1 | head -20

# Emergency service restart
docker-compose up -d

# Check service health after restart
sleep 30
curl -f http://localhost:8000/health
curl -f http://localhost:3000

# Create emergency backup
PGPASSWORD=password pg_dump \
  -h localhost \
  -U grateful \
  -d grateful_prod \
  --format=custom \
  > emergency_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Log Analysis for Incidents
```bash
# Check recent errors in all logs
find /opt/grateful/logs -name "*.log" -mtime -1 -exec grep -l "ERROR\|CRITICAL\|FATAL" {} \;

# Analyze nginx access logs for unusual patterns
tail -1000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -20

# Check for memory issues
dmesg | grep -i "killed process\|out of memory"

# Monitor real-time logs
tail -f /opt/grateful/logs/security.log /var/log/nginx/error.log
```

### Performance Troubleshooting
```bash
# Check for long-running database queries
PGPASSWORD=password psql -h localhost -U grateful -d grateful_prod -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# Check database locks
PGPASSWORD=password psql -h localhost -U grateful -d grateful_prod -c "
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;"

# Check application response times
for i in {1..10}; do
  curl -w "Response time: %{time_total}s\n" -o /dev/null -s http://localhost:8000/health
  sleep 1
done
```

## ☁️ Cloud Platform Commands

### Railway CLI Commands

#### Installation and Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to existing project
railway link

# Initialize new project
railway init
```

#### Deployment Commands
```bash
# Deploy current directory
railway up

# Deploy with detached mode (non-blocking)
railway up --detach

# Redeploy latest deployment
railway redeploy

# Check deployment status
railway status

# Open service in browser
railway open
```

#### Service Management
```bash
# List all services
railway service list

# Link to specific service
railway service link [service-name]

# Create new service
railway service create

# Delete service
railway service delete [service-name]
```

#### Environment Variables
```bash
# List all environment variables
railway variables

# Set environment variable
railway variables set KEY=value

# Set multiple variables
railway variables set KEY1=value1 KEY2=value2

# Delete environment variable
railway variables delete KEY

# Load variables from .env file
railway variables set --from-file .env
```

#### Volume Management
```bash
# List all volumes
railway volume list

# Create new volume
railway volume add --name volume-name --mount-path /path/to/mount

# Delete volume
railway volume delete --volume volume-name

# Detach volume from service
railway volume detach --volume volume-name

# Attach volume to service
railway volume attach --volume volume-name
```

#### Database Commands
```bash
# Connect to database
railway connect

# Connect to specific database service
railway connect postgres

# Run database migrations
railway run alembic upgrade head

# Execute SQL command
railway run psql $DATABASE_URL -c "SELECT * FROM users LIMIT 5;"

# Create database backup
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql
```

#### Logging and Monitoring
```bash
# View recent logs
railway logs

# Follow logs in real-time
railway logs --tail 100

# View logs for specific deployment
railway logs --deployment [deployment-id]

# View service metrics
railway metrics
```

#### Project Management
```bash
# List all projects
railway list

# Switch between projects
railway link [project-id]

# Create new project
railway init

# Get project information
railway status

# Open project dashboard
railway open
```

#### Domain Management
```bash
# List domains
railway domain

# Add custom domain
railway domain add yourdomain.com

# Remove domain
railway domain remove yourdomain.com

# Generate Railway domain
railway domain generate
```

#### Advanced Commands
```bash
# Run command in Railway environment
railway run [command]

# Shell into service environment
railway shell

# Port forward to local machine
railway connect --port 5432

# View build logs
railway logs --build

# Cancel deployment
railway cancel

# Scale service
railway scale --replicas 3
```

### Vercel Frontend Management ✅ **DEPLOYED**

**Current Deployment:**
- **URL**: https://greatful-gilt.vercel.app
- **Status**: Live and operational
- **Performance**: 200ms response time
- **Tests**: All passing (106 suites, 980 tests)

#### Deployment Commands
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View deployment logs
vercel logs [deployment-url]

# Set environment variables (needed after backend deployment)
vercel env add NEXT_PUBLIC_API_URL
vercel env add NODE_ENV production

# List environment variables
vercel env ls

# Remove environment variable
vercel env rm VARIABLE_NAME

# Test current deployment
curl -I https://greatful-gilt.vercel.app
```

#### Vercel Monitoring
```bash
# Check build logs
vercel logs --follow

# View analytics (requires Pro plan)
vercel analytics

# Check domain configuration
vercel domains ls

# Inspect deployment
vercel inspect [deployment-url]
```

### Railway Backend Management

#### Railway CLI Commands
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to existing project
railway link

# Deploy current directory
railway up

# View logs
railway logs

# Check service status
railway status

# Open service in browser
railway open

# Connect to database
railway connect postgres

# Run database migrations
railway run alembic upgrade head

# Set environment variables
railway variables set SECRET_KEY=your-secret-key

# List environment variables
railway variables

# Delete environment variable
railway variables delete VARIABLE_NAME
```

#### Railway Database Management
```bash
# Connect to PostgreSQL
railway connect postgres

# Create database backup
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql

# Check database size
railway run psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('railway'));"

# Monitor database connections
railway run psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
```

#### Railway Monitoring
```bash
# View service metrics
railway logs --follow

# Check resource usage
railway status

# Monitor deployments
railway deployments

# View build logs
railway logs --deployment [deployment-id]

# Check environment variables
railway variables

# Monitor database performance
railway connect postgres -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

### Cloud Platform Health Checks

#### Vercel Health Monitoring
```bash
# Check frontend health
curl https://your-app.vercel.app/api/health

# Test API connectivity from frontend
curl https://your-app.vercel.app/api/test-backend

# Check build status
vercel inspect https://your-app.vercel.app

# Monitor response times
for i in {1..10}; do
  curl -w "Response time: %{time_total}s\n" -o /dev/null -s https://your-app.vercel.app
  sleep 1
done
```

#### Railway Health Monitoring
```bash
# Check backend health
curl https://your-api.railway.app/health

# Check database connectivity
curl https://your-api.railway.app/health/database

# Monitor API response times
for i in {1..10}; do
  curl -w "Response time: %{time_total}s\n" -o /dev/null -s https://your-api.railway.app/health
  sleep 1
done

# Check specific endpoints
curl https://your-api.railway.app/api/v1/posts/feed
curl https://your-api.railway.app/api/v1/auth/me
```

### Cloud Platform Troubleshooting

#### Vercel Troubleshooting
```bash
# Check build errors
vercel logs --follow

# Inspect failed deployment
vercel inspect [failed-deployment-url]

# Check environment variables
vercel env ls

# Test local build
cd apps/web
npm run build

# Check for build issues
vercel build

# Redeploy with debug
vercel --debug
```

#### Railway Troubleshooting
```bash
# Check service logs
railway logs --tail 100

# Check deployment status
railway status

# Restart service
railway restart

# Check environment variables
railway variables

# Test database connection
railway connect postgres -c "SELECT 1;"

# Check disk usage
railway run df -h

# Monitor memory usage
railway run free -h

# Check running processes
railway run ps aux
```

### Cloud Platform Incident Response

#### Emergency Procedures
```bash
# Vercel: Rollback to previous deployment
vercel rollback [previous-deployment-url]

# Railway: Rollback to previous deployment
railway rollback [deployment-id]

# Quick health check of both platforms
echo "Frontend:" && curl -I https://your-app.vercel.app
echo "Backend:" && curl -I https://your-api.railway.app/health

# Check both platforms status
vercel ls
railway status
```

#### Performance Issues
```bash
# Vercel: Check edge network performance
curl -H "Accept-Encoding: gzip" -w "@curl-format.txt" https://your-app.vercel.app

# Railway: Check API performance
curl -w "@curl-format.txt" https://your-api.railway.app/health

# Monitor both platforms simultaneously
watch -n 5 'echo "Vercel:" && curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://your-app.vercel.app && echo "" && echo "Railway:" && curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://your-api.railway.app/health'
```

For comprehensive production deployment procedures, see [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md).
