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
?options=-csearch_path=public
postgresql+asyncpg://postgres:iamgreatful@localhost:5432/grateful
SECRET_KEY=your-super-secret-key-change-this-in-production
```
**Key Settings**:
- **Database URL**: PostgreSQL connection with async driver
- **Secret Key**: JWT token encryption
- **Search Path**: PostgreSQL schema configuration

### Frontend Environment
**File**: `apps/web/.env.local`
**Purpose**: Next.js frontend configuration
**Content**:
```env
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
DATABASE_URL=postgresql://postgres:iamgrateful@localhost:5432/grateful
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_JWT_ENCRYPTION=false
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