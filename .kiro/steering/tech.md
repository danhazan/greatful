# Technology Stack & Build System

## Architecture
- **Monorepo Structure**: Organized apps and packages for scalability
- **Backend**: FastAPI (Python) with async SQLAlchemy
- **Frontend**: Next.js with App Router (React, TypeScript)
- **Database**: PostgreSQL with Alembic migrations
- **Authentication**: JWT tokens with FastAPI security

## Tech Stack

### Backend (`apps/api/`)
- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn with async support
- **Database**: SQLAlchemy 2.0.23 with AsyncPG for PostgreSQL
- **Migrations**: Alembic 1.12.1
- **Authentication**: PyJWT 2.8.0, Passlib with bcrypt
- **Testing**: Pytest with async support, HTTPX for API testing
- **Environment**: python-dotenv for configuration

### Frontend (`apps/web/`)
- **Framework**: Next.js 14.0.4 with App Router
- **Language**: TypeScript with strict type checking
- **Styling**: Tailwind CSS with PostCSS
- **Icons**: Lucide React
- **Testing**: Jest with React Testing Library
- **Build**: Next.js built-in bundling and optimization

## Common Commands

### Backend Development
```bash
# Setup and run backend
cd apps/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

# Database operations
alembic upgrade head                    # Apply migrations
alembic revision --autogenerate -m "description"  # Create migration

# Testing
pytest                                  # Run all tests
pytest -v                              # Verbose output
pytest tests/unit/                     # Run specific test directory
```

### Frontend Development
```bash
# Setup and run frontend
cd apps/web
npm install
npm run dev

# Testing and quality
npm test                               # Run tests
npm run test:watch                     # Watch mode
npm run test:coverage                  # Coverage report
npm run type-check                     # TypeScript checking
npm run lint                          # ESLint

# Build
npm run build                         # Production build
npm start                             # Start production server
```

### Database Management
```bash
# PostgreSQL setup
createdb grateful
psql -U postgres -d grateful

# Connection check
psql -U postgres -d grateful -h localhost -c "\dt"
```

## Development Patterns

### API Structure
- All business logic in FastAPI backend
- RESTful endpoints under `/api/v1/`
- Async/await patterns throughout
- Pydantic models for request/response validation
- SQLAlchemy models with relationships

### Frontend Patterns
- App Router with TypeScript
- Server and client components separation
- Tailwind for consistent styling
- Component-based architecture
- API calls to FastAPI backend

### Testing Approach
- **Backend**: Pytest with async fixtures, in-memory SQLite for tests
- **Frontend**: Jest with React Testing Library, jsdom environment
- **Integration**: HTTPX async client for API testing
- **Isolation**: Each test gets fresh database state

## Environment Configuration
- Backend: `.env` file with database credentials
- Frontend: `.env.local` with API URL configuration
- CORS configured for localhost development
- Database connection pooling and async session management