# Command Line Execution Practices

## Core Principles

When executing commands in this workspace, follow these practices to ensure smooth development workflow and avoid common pitfalls.

## Safe Command Execution

### Always Use `| cat` for Interactive Commands
Many git and system commands open interactive viewers that can cause issues in automated environments. Always pipe to `cat` for these commands:

```bash
# ✅ CORRECT - Safe for automation
git log --oneline | cat
git show HEAD | cat
git diff | cat
git blame filename.py | cat
less filename.txt | cat
more filename.txt | cat

# ❌ WRONG - Opens interactive viewers
git log --oneline
git show HEAD
git diff
```

### Directory Navigation Best Practices
Never use `cd` in command execution. Instead, use the `path` parameter when available:

```bash
# ✅ CORRECT - Use path parameter
executeBash("pytest -v", path="apps/api")
executeBash("npm test", path="apps/web")

# ❌ WRONG - Don't use cd
executeBash("cd apps/api && pytest -v")
```

### Command Chaining Rules
Avoid command chaining operators (`&&`, `||`, `;`) as they're not supported. Execute commands separately:

```bash
# ✅ CORRECT - Separate commands
executeBash("source venv/bin/activate", path="apps/api")
executeBash("pytest -v", path="apps/api")

# ❌ WRONG - Command chaining
executeBash("source venv/bin/activate && pytest -v", path="apps/api")
```

## Project-Specific Commands

### Backend Development (FastAPI)

#### Environment Setup
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Running Tests
```bash
# Basic test execution
pytest

# Verbose output with coverage
pytest -v --cov=app

# Specific test categories
pytest tests/unit/
pytest tests/integration/
pytest tests/contract/

# Run specific test files
pytest tests/unit/test_user_service.py
pytest tests/integration/test_reactions_api.py

# Run tests matching pattern
pytest -k "test_create_post"
```

#### Database Operations
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Check migration status
alembic current

# Downgrade migration
alembic downgrade -1
```

#### Server Management
```bash
# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Quick server test (10 second timeout)
timeout 10s uvicorn main:app --reload --host 0.0.0.0 --port 8000 || true

# Check server health
curl http://localhost:8000/health
```

### Frontend Development (Next.js)

#### Package Management
```bash
# Install dependencies
npm install

# Install specific package
npm install package-name
npm install --save-dev package-name
```

#### Development Server
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

#### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test files
npm test PostCard.test.tsx
npm test -- --testPathPattern=components

# Run with coverage
npm test -- --coverage

# Type checking
npm run type-check
```

### Database Management

#### PostgreSQL Operations
```bash
# Connect to database
psql -U postgres -d grateful

# Check connection
pg_isready -h localhost -p 5432

# Grant privileges (run as superuser)
PGPASSWORD=iamgreatful psql -U postgres -h localhost -d grateful -c "GRANT ALL ON SCHEMA public TO grateful;"

# Reset database (development only)
dropdb -U postgres grateful
createdb -U postgres grateful
```

#### Database Queries
```bash
# List tables
psql -U postgres -d grateful -c "\dt"

# Describe table structure
psql -U postgres -d grateful -c "\d table_name"

# Run SQL query
psql -U postgres -d grateful -c "SELECT * FROM users LIMIT 5;"
```

## Git Operations

### Safe Git Commands
Always use `| cat` with git commands that might open interactive viewers:

```bash
# View commit history
git log --oneline -10 | cat
git log --graph --oneline | cat

# Show commit details
git show HEAD | cat
git show commit-hash | cat

# View differences
git diff | cat
git diff --cached | cat
git diff branch1..branch2 | cat

# Blame/annotate files
git blame filename.py | cat

# Show branch information
git branch -v | cat
git remote -v | cat
```

### Status and Information
```bash
# Check repository status
git status

# List files
git ls-files

# Show current branch
git branch --show-current

# Show remote information
git remote -v | cat
```

## System Monitoring

### Process Management
```bash
# Kill development servers
pkill -f "uvicorn\|npm.*dev" || true

# Check running processes
ps aux | grep uvicorn | cat
ps aux | grep node | cat

# Check port usage
lsof -i :8000
lsof -i :3000
```

### Resource Monitoring
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check system load
uptime

# Monitor processes
top -n 1 | cat
htop -n 1 | cat
```

### Service Status
```bash
# Check if services are running
pg_isready -h localhost -p 5432
redis-cli ping
curl -s http://localhost:8000/health
curl -s http://localhost:3000
```

## File Operations

### Safe File Viewing
```bash
# View file contents
cat filename.txt
head -20 filename.txt
tail -20 filename.txt

# View large files safely
head -100 large-file.log | cat
tail -100 large-file.log | cat

# Search in files
grep -n "search_term" filename.txt | cat
grep -r "search_term" directory/ | cat
```

### File Management
```bash
# Copy files
cp source.txt destination.txt
cp -r source_dir/ destination_dir/

# Move/rename files
mv old_name.txt new_name.txt

# Create directories
mkdir -p path/to/directory

# Remove files (be careful!)
rm filename.txt
rm -rf directory/
```

## Environment Management

### Environment Variables
```bash
# Check environment variables
env | grep VARIABLE_NAME | cat
echo $VARIABLE_NAME

# Set environment variables
export VARIABLE_NAME=value

# Load from .env file
source .env
```

### Virtual Environments
```bash
# Python virtual environment
python3 -m venv venv
source venv/bin/activate
deactivate

# Check Python environment
which python
python --version
pip list | cat
```

## Troubleshooting Commands

### Clear Caches
```bash
# Clear Python cache
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type f -name "*.pyc" -delete

# Clear Node.js cache
rm -rf node_modules/.cache
rm -rf .next

# Clear npm cache
npm cache clean --force
```

### Reset Development Environment
```bash
# Stop all services
pkill -f "uvicorn\|npm.*dev" || true

# Reset database (development)
dropdb -U postgres grateful || true
createdb -U postgres grateful

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Debug Information
```bash
# Check versions
python --version
node --version
npm --version
git --version

# Check system information
uname -a
lsb_release -a | cat

# Check network connectivity
ping -c 3 google.com
curl -I http://localhost:8000
```

## Testing Workflows

### Full Test Suite
```bash
# Backend tests
cd apps/api
source venv/bin/activate
pytest --cov=app

# Frontend tests
cd apps/web
npm run type-check
npm test

# Shared types validation
cd shared/types
npm run type-check
npm run build
```

### Contract Testing
```bash
# API contract validation
cd apps/api
source venv/bin/activate
pytest tests/contract/test_api_contracts.py -v

# Type consistency check
cd apps/web
npm run type-check
```

### Performance Testing
```bash
# Load testing with curl
for i in {1..10}; do curl -s http://localhost:8000/health; done

# Memory usage during tests
cd apps/api
source venv/bin/activate
/usr/bin/time -v pytest tests/unit/
```

## Error Handling

### Common Error Patterns
```bash
# Handle command failures gracefully
command_that_might_fail || true

# Check exit codes
if command; then
    echo "Success"
else
    echo "Failed with exit code $?"
fi

# Timeout long-running commands
timeout 30s long_running_command || echo "Command timed out"
```

### Log Analysis
```bash
# View recent logs
tail -f /var/log/application.log | cat
journalctl -u service-name --since "1 hour ago" | cat

# Search logs for errors
grep -i error /var/log/application.log | cat
grep -i "exception\|error\|fail" logfile.txt | cat
```

## Best Practices Summary

1. **Always use `| cat`** for commands that might open interactive viewers
2. **Never use `cd`** - use path parameters instead
3. **Avoid command chaining** - execute commands separately
4. **Handle failures gracefully** with `|| true` when appropriate
5. **Use timeouts** for potentially long-running commands
6. **Check service status** before running dependent commands
7. **Clear caches** when encountering unexpected issues
8. **Use verbose output** (`-v`) for debugging
9. **Pipe large outputs** to prevent overwhelming the terminal
10. **Test commands** in development before using in production

## Emergency Commands

### Kill All Development Processes
```bash
# Nuclear option - kills all development servers
pkill -f "uvicorn\|npm.*dev\|pytest\|jest" || true
```

### Reset Everything
```bash
# Complete development environment reset
pkill -f "uvicorn\|npm.*dev" || true
dropdb -U postgres grateful || true
createdb -U postgres grateful
cd apps/api && rm -rf __pycache__ && source venv/bin/activate && alembic upgrade head
cd apps/web && rm -rf .next node_modules/.cache && npm install
```

### Health Check All Services
```bash
# Quick health check of all services
echo "Database:" && pg_isready -h localhost -p 5432
echo "Backend:" && curl -s http://localhost:8000/health || echo "Backend not responding"
echo "Frontend:" && curl -s http://localhost:3000 || echo "Frontend not responding"
```