# Grateful Project: Architecture & Setup Guide

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Database Setup](#2-database-setup)
  - [3. Backend (FastAPI) Setup](#3-backend-fastapi-setup)
  - [4. Frontend (Next.js) Setup](#4-frontend-nextjs-setup)
  - [5. Running the Full Stack](#5-running-the-full-stack)
- [Common Tasks](#common-tasks)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

---

## Overview

This project is a modern web application with a FastAPI backend, a Next.js frontend, and a PostgreSQL database. All authentication and business logic are handled by the backend; the frontend acts as a proxy for user and authentication requests.

---

## Project Structure

The Grateful project is organized for clarity and modularity, with each main component in its own directory. Here’s an overview of the folder tree and what each part does:

```text
grateful/
├── apps/
│   ├── api/         # FastAPI backend with service layer architecture
│   │   ├── app/
│   │   │   ├── api/v1/      # API endpoints (thin controllers)
│   │   │   ├── core/        # Infrastructure (database, security, exceptions, middleware)
│   │   │   ├── services/    # Business logic layer (service classes)
│   │   │   └── models/      # SQLAlchemy database models
│   │   └── tests/           # Comprehensive test suite (unit + integration)
│   └── web/         # Next.js frontend (UI, static assets, SSR)
├── infrastructure/  # Docker, docker-compose, deployment configs
├── docs/            # Documentation (PRD, architecture, guides)
├── tools/           # Developer scripts and utilities (health checks, etc.)
├── alembic/         # Database migrations (Alembic config and versions)
├── alembic.ini      # Alembic configuration file
├── README.md        # Project overview and quickstart
└── ...              # Other config and dotfiles
```

### Main Components
- **Backend (`apps/api/`)**: FastAPI app, all business logic, DB models, API endpoints, migrations
- **Frontend (`apps/web/`)**: Next.js app, all UI, static assets, SSR, API proxying
- **Infrastructure**: Docker and deployment setup for local and production
- **Docs**: All documentation, including PRD, setup, and troubleshooting



### Key Files & Folders
- `apps/api/main.py` – FastAPI entrypoint
- `apps/api/app/` – Backend app code (models, routes, core logic)
- `apps/web/pages/` or `src/app/` – Next.js pages and routes
- `alembic/` – Database migration configuration and version history
- `alembic.ini` – Alembic configuration file (root level)
- `infrastructure/docker-compose.yml` – Multi-service local dev setup
- `docs/ARCHITECTURE_AND_SETUP.md` – This guide
- `README.md` – Project summary and quickstart

See each folder’s README (if present) for more details.

---

## Architecture

- **Backend:** FastAPI (Python, SQLAlchemy, JWT) with Service Layer Architecture and Shared Types
  - Location: `apps/api`
  - **Service Layer**: Business logic separated into service classes (AuthService, UserService, ReactionService, NotificationService, MentionService)
  - **NotificationFactory**: Unified notification creation system (`app/core/notification_factory.py`) - eliminates common notification issues
  - **Repository Pattern**: Standardized data access layer with query builders and performance monitoring
  - **Shared Type System**: Comprehensive type definitions shared between frontend and backend (`shared/types/`)
  - **API Contract Validation**: Runtime validation of requests/responses against shared type contracts
  - **Standardized Responses**: Consistent API response formatting with structured error handling
  - **Custom Exceptions**: Proper HTTP status codes, error hierarchies, and detailed error messages
  - **Middleware**: Request validation, error handling, performance monitoring, and logging
  - **OpenAPI Integration**: Automatic schema generation and validation from shared types
  - Handles all business logic, authentication, database access, and type safety
- **Frontend:** Next.js (React, TypeScript)
  - Location: `apps/web`
  - Proxies authentication and user-related requests to the backend
- **Database:** PostgreSQL
  - Used by the backend for persistent storage with async SQLAlchemy

---

## Implemented Features

### Social Interaction System

The Grateful platform includes a comprehensive social interaction system with the following features:

#### 🎭 Emoji Reaction System
- **8 Positive Emojis**: Users can react with 😍, 🤗, 🙏, 💪, 🌟, 🔥, 🥰, 👏
- **One Reaction Per User**: Users can change their reaction but only have one active reaction per post
- **Real-time Updates**: Reaction counts update immediately with optimistic UI updates
- **Reaction Viewer**: Modal showing all users and their reactions for each post

#### 💜 Hearts/Likes System
- **Heart Posts**: Users can heart/like posts with visual feedback
- **Heart Counter**: Display of total hearts with click-to-view functionality
- **Hearts Viewer**: Modal showing all users who hearted a specific post
- **Optimistic Updates**: Immediate UI feedback with server synchronization

#### 🔗 Share System
- **URL Sharing**: Copy post links to clipboard with success feedback
- **Share Modal**: Clean popup interface for sharing options
- **Share Analytics**: Track sharing methods and engagement metrics
- **Authentication Aware**: Logged-out users see share counters, logged-in users can interact

#### 👥 Mention System
- **@Username Detection**: Automatic parsing of @username mentions in post content
- **Autocomplete Search**: Real-time user search with debounced API calls (300ms)
- **Batch Validation**: Efficient validation of multiple usernames to highlight only existing users
- **Mention Notifications**: Automatic notifications when users are mentioned in posts
- **Profile Navigation**: Click mentions to navigate to user profiles
- **Smart Highlighting**: Only validated usernames (existing users) get purple highlighting

#### 🔔 Enhanced Notification System
- **Multiple Types**: Emoji reactions, hearts, mentions, follows, shares
- **Notification Batching**: Intelligent batching to prevent spam (e.g., "3 people reacted to your post")
- **Rate Limiting**: Configurable limits per notification type (max 5/hour per type)
- **Real-time Updates**: Polling-based updates every 30 seconds
- **Batch Operations**: Mark individual or all notifications as read
- **Unread Counter**: Shows count of unread parent notifications in navbar

#### 👤 User Profile System
- **Profile Management**: Edit username, bio, and profile image
- **User Stats**: Display posts count, followers, following, join date
- **Public Profiles**: View other users' profiles and posts
- **Profile Navigation**: Click usernames/avatars throughout the app to view profiles

#### 📱 Mobile-Optimized Design
- **Responsive Components**: All modals and interactions work on mobile
- **Touch-Friendly**: Optimized for touch interactions and gestures
- **Purple Theme**: Consistent purple branding with purple heart emoji (💜)
- **Visual Hierarchy**: Different post types (Daily 3x, Photo 2x, Spontaneous 1x sizing)

### Technical Implementation

#### Frontend Architecture
- **Component-Based**: Reusable React components (PostCard, EmojiPicker, ReactionViewer, etc.)
- **TypeScript**: Full type safety with shared type definitions
- **Optimistic Updates**: Immediate UI feedback with server synchronization
- **Error Handling**: Graceful error handling with user-friendly messages
- **Performance**: Debounced searches, efficient re-renders, lazy loading

#### Backend Architecture
- **Service Layer**: Clean separation of business logic (UserService, ReactionService, NotificationService)
- **NotificationFactory**: Centralized notification creation with built-in error handling and consistency
- **Repository Pattern**: Standardized data access with query optimization
- **API Contract Validation**: Runtime validation against shared type definitions
- **Performance Monitoring**: Query performance tracking and optimization
- **Rate Limiting**: Configurable rate limits for search and validation endpoints

#### Database Design
- **Efficient Schema**: Optimized for social interactions with proper indexing
- **No Mention Table**: Content-parsing approach for mentions (no additional tables needed)
- **Batch Operations**: Single queries for validating multiple usernames
- **Relationship Optimization**: Efficient loading of user relationships and engagement data

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+
- PostgreSQL 14+

---

## Setup Instructions

### 1. Clone the Repository

```sh
git clone <repo-url>
cd grateful
```

### 2. Database Setup

1. Install PostgreSQL and ensure it is running.
2. Create a database and user:
   ```sh
   psql -U postgres
   CREATE DATABASE grateful;
   CREATE USER grateful WITH PASSWORD 'iamgreatful';
   GRANT ALL PRIVILEGES ON DATABASE grateful TO grateful;
   \q
   ```
3. (Optional) Update credentials in `.env` files if you use different values.

### 3. Backend (FastAPI) Setup

```sh
cd apps/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit as needed
alembic upgrade head  # Run DB migrations
uvicorn main:app --reload  # Start the backend
```

- The backend will run on `http://localhost:8000` by default.

### 4. Frontend (Next.js) Setup

```sh
cd ../../apps/web
cp .env.example .env.local  # Edit API URL as needed
npm install
npm run build
npm run dev
```

- The frontend will run on `http://localhost:3000` by default.
- Ensure `NEXT_PUBLIC_API_URL` in `.env.local` points to your backend (e.g., `http://localhost:8000/api/v1`).

### 5. Running the Full Stack

- Start the backend (see above)
- Start the frontend (see above)
- Visit `http://localhost:3000` in your browser

---

## Common Tasks

### Backend Development

- **Run backend server (dev):**
  ```sh
  cd apps/api
  source venv/bin/activate
  uvicorn main:app --reload
  ```

- **Run backend tests:**
  ```sh
  cd apps/api
  source venv/bin/activate
  pytest                    # All tests
  pytest -v                 # Verbose output
  pytest tests/unit/        # Unit tests only
  pytest tests/integration/ # Integration tests only
  pytest tests/contract/    # API contract tests only
  ```

- **Run tests with coverage:**
  ```sh
  cd apps/api
  source venv/bin/activate
  pytest --cov=app --cov-report=html
  ```

- **Create database migration:**
  ```sh
  cd apps/api
  source venv/bin/activate
  alembic revision --autogenerate -m "description"
  alembic upgrade head
  ```

- **Validate shared types:**
  ```sh
  cd shared/types
  npm run type-check        # TypeScript type checking
  npm run build            # Build shared types
  ```

- **Check API documentation:**
  - Visit [http://localhost:8000/docs](http://localhost:8000/docs) for interactive API docs with shared type schemas
  - Visit [http://localhost:8000/redoc](http://localhost:8000/redoc) for alternative docs
  - Visit [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json) for OpenAPI schema

### Frontend Development

- **Run frontend server (dev):**
  ```sh
  cd apps/web
  npm run dev
  ```

- **Run frontend tests:**
  ```sh
  cd apps/web
  npm test
  ```

- **Build frontend for production:**
  ```sh
  cd apps/web
  npm run build
  ```

- **Lint frontend code:**
  ```sh
  cd apps/web
  npm run lint
  ```

- **Type-check frontend code:**
  ```sh
  cd apps/web
  npm run type-check
  ```

### Database & Infrastructure

- **Run Postgres locally (WSL2):**
  - Start PostgreSQL cluster:
    ```sh
    sudo pg_ctlcluster 16 main start
    ```
  - Stop PostgreSQL cluster:
    ```sh
    sudo pg_ctlcluster 16 main stop
    ```
  - Check status:
    ```sh
    sudo pg_ctlcluster 16 main status
    ```
  - **Credentials**: See the [README](../README.md) for default Postgres user and password.
  
  **Common psql commands:**
  ```sh
  # Connect to database
  psql -U postgres -d grateful -h localhost
  
  # Connect as postgres superuser (for admin tasks)
  PGPASSWORD=iamgreatful psql -U postgres -h localhost -d grateful
  
  # List all databases
  psql -U postgres -h localhost -c "\l"
  
  # List all tables in current database
  psql -U postgres -d grateful -h localhost -c "\dt"
  ```

- **Run all services with Docker Compose:**
  ```sh
  cd infrastructure
  docker-compose up -d
  docker-compose down
  ```

### Other Useful Tasks

- **Check if services are running (Docker):**
  ```sh
  docker-compose ps
  ```

- **Check backend health:**
  ```sh
  curl http://localhost:8000/health
  ```

- **Check frontend health:**
  ```sh
  curl http://localhost:3000
  ```

- **Copy environment files:**
  ```sh
  cp apps/api/.env.example apps/api/.env
  cp apps/web/.env.example apps/web/.env.local
  ```

- **Run all tests (as CI would):**
  ```sh
  # Backend
  cd apps/api && source venv/bin/activate && pytest
  # Frontend
  cd apps/web && npm test
  ```

---

## Development Workflow

1. **Start Development Environment:**
   - Backend: `cd apps/api && uvicorn main:app --reload`
   - Frontend: `cd apps/web && npm run dev`

2. **Database Changes:**
   - Modify models in `apps/api/app/models/`
   - Generate migration: `alembic revision --autogenerate -m "description"`
   - Apply migration: `alembic upgrade head`

3. **API Changes:**
   - Add endpoints in `apps/api/app/api/v1/`
   - Update schemas in `apps/api/app/schemas/`
   - Test with pytest

4. **Frontend Changes:**
   - Modify components in `apps/web/src/`
   - Test with `npm test`
   - Build with `npm run build`

---

## Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Ensure PostgreSQL is running
   - Check credentials in `.env` files
   - Run database setup commands from [USEFUL_COMMANDS.md](./USEFUL_COMMANDS.md)

2. **Port Already in Use:**
   - Backend: Change port in uvicorn command or kill existing process
   - Frontend: Change port in package.json or kill existing process

3. **Module Not Found Errors:**
   - Backend: Ensure virtual environment is activated
   - Frontend: Run `npm install` to install dependencies

### Getting Help

- Check [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for common problems
- Review [USEFUL_COMMANDS.md](./USEFUL_COMMANDS.md) for command reference
- See [DATABASE_STRUCTURE.md](./DATABASE_STRUCTURE.md) for database schema
- See [GRATEFUL_PRD.md](./GRATEFUL_PRD.md) for project requirements 