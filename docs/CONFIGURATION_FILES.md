# Configuration Files Documentation

This document provides a comprehensive overview of all configuration files in the Grateful project, their purposes, and locations.

## 📁 Project Configuration Overview

The project uses a **monorepo structure** with separate configuration files for each component. This approach ensures:
- **Clear separation** of concerns
- **Component-specific** configuration
- **No conflicts** between frontend and backend settings
- **Easy maintenance** and updates

## 🌍 Environment Files

### Root Level Environment
**File**: `.env` (root)
**Purpose**: Global project settings
**Content**:
```env
# Not sure if needed, here just in case
# Check if can be utilized
SECRET_KEY_GLOBAL=your-super-secret-key-change-this-in-production
```
**Status**: ⚠️ **UNDER REVIEW** - May be removable if not used

### Backend Environment
**File**: `apps/api/.env`
**Purpose**: FastAPI backend configuration
**Content**:
```env
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:iamgreatful@localhost:5432/grateful

# Security Configuration
SECRET_KEY=your-super-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback/google
OAUTH_REDIRECT_URI_PRODUCTION=https://yourdomain.com/auth/callback/google

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Environment
ENVIRONMENT=development
```
**Key Settings**:
- **Database URL**: PostgreSQL connection with async driver
- **Secret Key**: JWT token encryption
- **OAuth Credentials**: Google and Facebook OAuth client credentials
- **OAuth Redirect URIs**: Callback URLs for OAuth flow (development and production)
- **CORS Origins**: Allowed frontend origins for API access

### Frontend Environment
**File**: `apps/web/.env.local` (Development)
**Purpose**: Next.js frontend configuration for local development
**Content**:
```env
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
DATABASE_URL=postgresql://postgres:iamgrateful@localhost:5432/grateful
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_JWT_ENCRYPTION=false
```

### Cloud Platform Environment Files

#### Vercel Production Environment
**Platform**: Vercel Dashboard → Environment Variables
**Purpose**: Next.js frontend production configuration
**Required Variables**:
```env
# Core Configuration
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-api.railway.app/api/v1
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Optional Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true
NEXT_PUBLIC_ENABLE_SW=true
NEXT_TELEMETRY_DISABLED=1
```

#### Railway Production Environment
**Platform**: Railway Dashboard → Variables
**Purpose**: FastAPI backend production configuration
**Required Variables**:
```env
# Database (Auto-provided by Railway)
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://user:pass@host:port

# Security
SECRET_KEY=your-super-secure-secret-key-at-least-64-characters-long
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS Configuration
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com

# Application Settings
ENVIRONMENT=production
LOG_LEVEL=INFO
ENABLE_DOCS=false

# Rate Limiting
DEFAULT_RATE_LIMIT=100
AUTH_RATE_LIMIT=10
UPLOAD_RATE_LIMIT=20

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_FILE_UPLOADS=true

# OAuth Configuration (Production)
GOOGLE_CLIENT_ID=your-production-google-client-id
GOOGLE_CLIENT_SECRET=your-production-google-client-secret
FACEBOOK_CLIENT_ID=your-production-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-production-facebook-client-secret
OAUTH_REDIRECT_URI_PRODUCTION=https://your-app.vercel.app/auth/callback/google
```
**Key Settings**:
- **NextAuth Secret**: Authentication encryption
- **Database URL**: Database connection (for any direct DB access)
- **NextAuth URL**: Authentication callback URL
- **API URL**: Backend API endpoint for proxy requests
- **JWT Encryption**: Disabled for development

### Frontend Environment Templates
**Files**: 
- `apps/web/.env.example` - Template for new developers
- `apps/web/.env.local` - Local development overrides

## ☁️ Cloud Platform Configuration

### Railway Configuration
**File**: `apps/api/railway.toml`
**Purpose**: Railway deployment configuration for backend
**Content**:
```toml
[build]
builder = "nixpacks"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"

[[services]]
name = "api"
source = "."

[services.api.build]
buildCommand = "pip install -r requirements.txt"

[services.api.deploy]
startCommand = "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT"
```
**Key Settings**:
- **Builder**: Nixpacks for automatic dependency detection
- **Health Check**: Endpoint for Railway health monitoring
- **Start Command**: Database migration + server startup
- **Restart Policy**: Automatic restart on failure

### Vercel Configuration
**File**: `apps/web/vercel.json` (Optional)
**Purpose**: Vercel deployment configuration for frontend
**Content**:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "functions": {
    "apps/web/src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```
**Key Settings**:
- **Framework**: Next.js automatic detection
- **Regions**: Deployment regions (iad1 = US East)
- **Functions**: API route timeout configuration

## 🐍 Python Configuration

### Backend Dependencies
**File**: `apps/api/requirements.txt`
**Purpose**: Python package dependencies for FastAPI backend
**Key Dependencies**:
- `fastapi` - Web framework
- `sqlalchemy` - Database ORM
- `alembic` - Database migrations
- `pytest` - Testing framework
- `uvicorn` - ASGI server

### Backend Testing Configuration
**File**: `apps/api/pytest.ini`
**Purpose**: Pytest configuration for backend tests
**Features**:
- Async test support
- Test database configuration
- Coverage reporting
- Custom test markers

## 🎨 Frontend Configuration

### Package Dependencies
**File**: `apps/web/package.json`
**Purpose**: Node.js dependencies and scripts for Next.js frontend
**Key Dependencies**:
- `next` - React framework
- `react` & `react-dom` - UI library
- `typescript` - Type safety
- `tailwindcss` - Styling
- `@radix-ui` - UI components
- `@testing-library/react` - Component testing
- `jest` - Testing framework
- `jest-environment-jsdom` - DOM testing environment
- `@jest/globals` - Jest globals for TypeScript
- `node-mocks-http` - HTTP request mocking

### TypeScript Configuration
**File**: `apps/web/tsconfig.json`
**Purpose**: TypeScript compiler configuration
**Features**:
- Strict type checking
- Next.js integration
- Path mapping
- Module resolution

### Testing Configuration
**File**: `apps/web/jest.config.js`
**Purpose**: Jest testing framework configuration
**Features**:
- **Test Environment**: `jsdom` for DOM testing
- **Setup File**: `src/tests/setup.ts` for global test configuration
- **Path Mapping**: `@/` maps to `src/` for imports
- **File Extensions**: Supports `.ts` and `.tsx` files
- **Module Transform**: Uses `ts-jest` for TypeScript compilation
- **Test Matching**: Finds tests in `src/tests/` and `src/app/` directories

### Test Setup
**File**: `apps/web/src/tests/setup.ts`
**Purpose**: Global test configuration and mocks
**Features**:
- Environment variable setup for tests
- Mock implementations for Next.js components
- Global Response and Request mocks
- Navigation and server component mocks

## 🗄️ Database Configuration

### Migration Configuration
**File**: `alembic.ini` (root)
**Purpose**: Alembic database migration configuration
**Key Settings**:
- **Script Location**: `%(here)s/alembic`
- **Database URL**: PostgreSQL connection
- **Migration Template**: Custom migration file format
- **Logging**: Migration execution logging

**Location**: Root level (correct for monorepo)
**Status**: ✅ **ACTIVE** - Used for all database migrations

## 🐳 Infrastructure Configuration

### Docker Compose
**File**: `infrastructure/docker-compose.yml`
**Purpose**: Multi-service local development setup
**Services**:
- **PostgreSQL**: Database server
- **Redis**: Caching and sessions
- **Backend**: FastAPI application
- **Frontend**: Next.js application

**Features**:
- **Volume mounts**: Persistent data storage
- **Network configuration**: Service communication
- **Environment variables**: Service-specific settings
- **Port mapping**: Local development access

## 📊 Configuration File Locations

### Project Structure
```
grateful/
├── .env                    # Global environment (under review)
├── alembic.ini            # Database migrations
├── apps/
│   ├── api/
│   │   ├── .env           # Backend environment
│   │   ├── requirements.txt # Python dependencies
│   │   └── pytest.ini     # Test configuration
│   └── web/
│       ├── .env.local     # Frontend environment
│       ├── .env.example   # Environment template
│       ├── package.json   # Node.js dependencies
│       ├── package-lock.json # Locked dependency versions
│       ├── jest.config.js # Jest testing configuration
│       ├── tsconfig.json  # TypeScript configuration
│       ├── next.config.js # Next.js configuration
│       └── tailwind.config.js # Tailwind CSS configuration
└── infrastructure/
    └── docker-compose.yml # Local development setup
```

## 🔧 Configuration Management

### Environment Variables
- **Development**: Use `.env` files for local development
- **Production**: Use environment variables or secrets management
- **Security**: Never commit sensitive values to version control

### Database Configuration
- **Development**: Local PostgreSQL with Docker
- **Testing**: PostgreSQL test database
- **Production**: Managed PostgreSQL service

### Frontend Configuration
- **Development**: Local API endpoints
- **Production**: Production API endpoints
- **Authentication**: NextAuth.js with JWT

## 🚀 Setup Instructions

### 1. Environment Setup
```bash
# Copy environment templates
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Edit environment files with your settings
nano apps/web/.env.local
nano apps/api/.env
```

### 2. Frontend Testing Setup
```bash
cd apps/web
npm install
npm test  # Run all tests
```

### 2. Database Setup
```bash
# Start database services
cd infrastructure
docker-compose up -d

# Run migrations
cd apps/api
alembic upgrade head
```

### 4. Dependencies Installation
```bash
# Backend dependencies
cd apps/api
pip install -r requirements.txt

# Frontend dependencies
cd apps/web
npm install
```

## ⚠️ Important Notes

### Security Considerations
- **Never commit** `.env` files to version control
- **Use strong secrets** in production
- **Rotate keys** regularly
- **Use environment variables** for sensitive data

### Development Workflow
- **Local development**: Use Docker Compose for services
- **Testing**: Use separate test database
- **Hot reloading**: Configured for both frontend and backend

### Production Deployment
- **Environment variables**: Set via deployment platform
- **Database**: Use managed PostgreSQL service
- **Secrets**: Use platform-specific secret management

## 🔍 Troubleshooting

### Common Issues
1. **Database Connection**: Check PostgreSQL service and credentials
2. **Environment Variables**: Ensure all required variables are set
3. **Port Conflicts**: Check if ports 3000, 8000, 5432 are available
4. **Dependencies**: Run `npm install` and `pip install -r requirements.txt`
5. **Test Failures**: Ensure Jest environment is properly configured with `jsdom`
6. **Lockfile Conflicts**: Remove conflicting `package-lock.json` files in parent directories

### Configuration Validation
- **Backend**: Check `uvicorn main:app --reload` starts successfully
- **Frontend**: Check `npm run dev` starts without errors
- **Database**: Check `alembic current` shows correct migration state

---

*Last updated: [Current Date]* 