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
pytest
pytest -v  # Verbose output
pytest -k "test_name"  # Run specific test
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
npm test
# or
yarn test
# or
pnpm test
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