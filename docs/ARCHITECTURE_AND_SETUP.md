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
  - **Service Layer**: Business logic separated into service classes (AuthService, UserService, ReactionService, NotificationService, MentionService, AlgorithmService)
  - **AlgorithmService**: Advanced feed ranking with engagement scoring and social signals (`app/services/algorithm_service.py`)
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
- **Rate Limiting**: Configurable limits per notification type (max 5/hour per type)
- **Real-time Updates**: Polling-based updates every 30 seconds
- **Batch Operations**: Mark individual or all notifications as read
- **Unread Counter**: Shows count of unread notifications in navbar

#### 🧠 Enhanced Feed Algorithm
- **Engagement Scoring**: Weighted scoring system (Hearts×1.0, Reactions×1.5, Shares×4.0)
- **Content Type Bonuses**: Photo posts (+2.5), Daily gratitude posts (+3.0)
- **Relationship Multipliers**: Posts from followed users get 2.0x boost
- **80/20 Feed Split**: 80% algorithm-scored posts, 20% recent posts for discovery
- **Trending Algorithm**: Time-window based trending with recency bonuses
- **Performance Optimized**: Cached engagement counts and efficient queries

#### 👥 Follow System
- **Follow/Unfollow**: Users can follow and unfollow other users with optimistic UI updates
- **Follow Status**: Real-time follow status checking with mutual follow detection
- **Followers/Following Lists**: Paginated lists of followers and following with follow status
- **Follow Statistics**: Comprehensive stats including followers, following, and pending counts
- **Follow Suggestions**: Intelligent suggestions based on mutual connections
- **Follow Notifications**: Automatic notifications when users gain new followers
- **Self-Follow Prevention**: Database constraints and validation prevent self-following
- **Bulk Operations**: Efficient bulk checking of follow status for multiple users

#### 📝 Enhanced Post System
- **Automatic Type Detection**: Intelligent post categorization based on content analysis
  - Photo posts: Image with no text content (0 characters)
  - Spontaneous posts: Text-only under 20 words (5000 character limit)
  - Daily gratitude: All other content (5000 character limit)
- **Rich Content Support**: HTML formatted content with `rich_content` field for enhanced display
- **Post Styling**: JSON-based styling system with `post_style` field for colors, fonts, and themes
- **Location Integration**: Structured location data with coordinates using existing OpenStreetMap integration
  - Reuses location services from user profile system
  - Supports both simple location strings and structured JSON data
  - Includes coordinates, place IDs, and address components
- **Drag-and-Drop Upload**: Modern image upload interface with preview and validation
- **Content Analysis Service**: Real-time content analysis for type detection and character limits
- **Generous Character Limits**: No artificial restrictions - both daily and spontaneous posts support 5000 characters

#### 👤 User Profile System
- **Profile Management**: Edit username, bio, and profile image
- **User Stats**: Display posts count, followers, following, join date
- **Public Profiles**: View other users' profiles and posts
- **Profile Navigation**: Click usernames/avatars throughout the app to view profiles

#### 💬 Comment System
- **CommentsModal Component**: Full-featured modal for viewing and creating comments
  - **Lazy Loading Strategy**: Replies are only fetched when user clicks "X replies" button, optimizing performance for posts with many comments
  - **Single-Level Nesting**: Comments can have replies, but replies cannot have replies (prevents deep threading complexity)
  - **Emoji Support**: Full Unicode emoji support in comment content with proper rendering
  - **Character Limit**: 500 characters per comment/reply with real-time counter
  - **User Navigation**: Clickable usernames and profile pictures navigate to user profiles
  - **Relative Timestamps**: Human-readable time display (e.g., "2h ago", "5m ago")
  - **Reply Management**: Inline reply input with cancel functionality
  - **Mobile Optimization**: 44px minimum touch targets, responsive design, touch-friendly interactions
  - **Accessibility**: Full ARIA labels, keyboard navigation support, screen reader compatible
  - **Visual Indentation**: Replies are visually indented to show hierarchy
  - **Loading States**: Clear loading indicators for async operations (posting, loading replies)
  - **Error Handling**: User-friendly error messages with toast notifications
- **Performance Optimization**: Comments list loads top-level comments only; replies fetched on-demand
- **Backend API**: RESTful endpoints for creating comments, replies, and fetching comment threads
- **Database Design**: Efficient schema with parent_comment_id for single-level nesting

#### 📱 Mobile-Optimized Design
- **Responsive Components**: All modals and interactions work on mobile
- **Touch-Friendly**: Optimized for touch interactions and gestures
- **Purple Theme**: Consistent purple branding with purple heart emoji (💜)
- **Visual Hierarchy**: Different post types (Daily 3x, Photo 2x, Spontaneous 1x sizing)

### Technical Implementation

#### Frontend Architecture
- **Component-Based**: Reusable React components (PostCard, EmojiPicker, ReactionViewer, CommentsModal, etc.)
- **TypeScript**: Full type safety with shared type definitions
- **Optimistic Updates**: Immediate UI feedback with server synchronization
- **Error Handling**: Graceful error handling with user-friendly messages
- **Performance**: Debounced searches, efficient re-renders, lazy loading
- **Lazy Loading Strategy**: Comments modal implements lazy loading for replies - only fetches reply data when user expands a comment thread

#### Backend Architecture
- **Service Layer**: Clean separation of business logic (UserService, ReactionService, NotificationService, FollowService)
- **NotificationFactory**: Centralized notification creation with built-in error handling and consistency
- **Advanced Notification Batching**: Generic batching system with specialized batchers for different interaction types
- **Repository Pattern**: Standardized data access with query optimization
- **API Contract Validation**: Runtime validation against shared type definitions
- **Performance Monitoring**: Query performance tracking and optimization
- **Rate Limiting**: Configurable rate limits for search and validation endpoints
- **Follow System**: Comprehensive follow relationship management with mutual follow detection

#### Database Design
- **Efficient Schema**: Optimized for social interactions with proper indexing
- **No Mention Table**: Content-parsing approach for mentions (no additional tables needed)
- **Follow Relationships**: Dedicated follows table with unique constraints and self-follow prevention
- **Batch Operations**: Single queries for validating multiple usernames and checking follow status
- **Relationship Optimization**: Efficient loading of user relationships and engagement data
- **Performance Indexes**: Strategic indexes on follow relationships for fast queries

---

## Prerequisites

### Development Environment
- Python 3.10+
- Node.js 18+
- npm 9+
- PostgreSQL 14+

### Production Environment
- Ubuntu 20.04 LTS or newer (recommended)
- Docker 20.10+ with Docker Compose
- Minimum 4 CPU cores, 8GB RAM, 100GB SSD
- SSL certificate and domain name
- Load balancer (for high availability)

For detailed production setup, see [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md).

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

### 3.1. OAuth Provider Configuration

The Grateful platform supports OAuth authentication with Google and Facebook. Follow these steps to configure OAuth providers:

#### Google OAuth Setup

1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing project
   - Enable the Google+ API and Google OAuth2 API

2. **Configure OAuth Consent Screen:**
   - Navigate to "APIs & Services" → "OAuth consent screen"
   - Choose "External" user type for public applications
   - Fill in application information:
     - App name: "Grateful"
     - User support email: Your support email
     - Developer contact information: Your email
   - Add scopes: `openid`, `email`, `profile`
   - Add test users if in development mode

3. **Create OAuth Credentials:**
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "Grateful Web Client"
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/auth/callback/google`
     - Production: `https://your-domain.com/auth/callback/google`

4. **Configure Environment Variables:**
   ```bash
   # Add to apps/api/.env
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```

#### Facebook OAuth Setup

1. **Create Facebook App:**
   - Go to [Facebook for Developers](https://developers.facebook.com/)
   - Click "Create App" → "Consumer" → "Next"
   - Enter app display name: "Grateful"
   - Enter app contact email

2. **Configure Facebook Login:**
   - In your app dashboard, click "Add Product" → "Facebook Login"
   - Choose "Web" platform
   - Enter Site URL: `https://your-domain.com` (production) or `http://localhost:3000` (development)

3. **Configure OAuth Redirect URIs:**
   - Navigate to "Facebook Login" → "Settings"
   - Add Valid OAuth Redirect URIs:
     - Development: `http://localhost:3000/auth/callback/facebook`
     - Production: `https://your-domain.com/auth/callback/facebook`

4. **Configure Environment Variables:**
   ```bash
   # Add to apps/api/.env
   FACEBOOK_CLIENT_ID=your_facebook_app_id_here
   FACEBOOK_CLIENT_SECRET=your_facebook_app_secret_here
   ```

#### OAuth Environment Configuration

Configure OAuth-specific environment variables in your `.env` file:

```bash
# OAuth Provider Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_CLIENT_ID=your_facebook_client_id  # Optional
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret  # Optional

# OAuth Security Settings
OAUTH_SESSION_TIMEOUT=600  # 10 minutes
OAUTH_STATE_EXPIRY=300     # 5 minutes for CSRF protection
SECURE_COOKIES=false       # Set to true in production
SAME_SITE_COOKIES=lax      # Set to 'none' in production for cross-origin

# Environment and URL Configuration
ENVIRONMENT=development    # development, staging, or production
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# OAuth Allowed Domains (production only)
OAUTH_ALLOWED_DOMAINS=your-domain.com,www.your-domain.com
```

#### OAuth Testing and Validation

1. **Test OAuth Configuration:**
   ```bash
   cd apps/api
   source venv/bin/activate
   
   # Check OAuth provider status
   curl http://localhost:8000/api/v1/oauth/providers
   
   # Run OAuth health check
   curl http://localhost:8000/api/v1/oauth/health
   ```

2. **Test OAuth Flow:**
   - Start both backend and frontend servers
   - Navigate to `http://localhost:3000`
   - Click "Sign in with Google" or "Sign in with Facebook"
   - Complete OAuth flow and verify user creation/login

3. **Run OAuth Tests:**
   ```bash
   cd apps/api
   source venv/bin/activate
   
   # Run OAuth-specific tests
   pytest tests/unit/test_oauth_service.py -v
   pytest tests/integration/test_oauth_endpoints.py -v
   ```

#### OAuth Troubleshooting

**Common Issues:**

1. **"OAuth provider not available":**
   - Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Verify credentials are correct in Google Cloud Console
   - Check OAuth provider status: `GET /api/v1/oauth/providers`

2. **"Invalid redirect URI":**
   - Ensure redirect URIs in provider settings match your configuration
   - Development: `http://localhost:3000/auth/callback/{provider}`
   - Production: `https://your-domain.com/auth/callback/{provider}`

3. **"CSRF state validation failed":**
   - Check that state parameter is being passed correctly
   - Verify `OAUTH_STATE_EXPIRY` is not too short (minimum 300 seconds)
   - Ensure frontend and backend are using the same domain

4. **OAuth health check failures:**
   ```bash
   # Check OAuth configuration
   curl http://localhost:8000/api/v1/oauth/health
   
   # Check provider availability
   curl http://localhost:8000/api/v1/oauth/providers
   ```

**Debug OAuth Issues:**
```bash
# Enable OAuth debug logging
export LOG_LEVEL=DEBUG

# Check OAuth service logs
tail -f apps/api/logs/server.log | grep -i oauth

# Test OAuth configuration
python -c "
from app.core.oauth_config import get_oauth_config
config = get_oauth_config()
print('Providers:', config.get_provider_status())
"
```

### 3.2. WhatsApp Sharing Configuration

The Grateful platform includes WhatsApp sharing functionality that allows users to share posts directly to WhatsApp Web or the WhatsApp mobile app. This feature is implemented with a reliable, cross-platform approach.

#### WhatsApp Sharing Architecture

**Configuration Files:**
- `apps/web/src/config/whatsapp.ts` - WhatsApp URL configuration and constants
- `apps/web/src/utils/mobileDetection.ts` - Device detection and URL generation utilities

**Key Features:**
- **Universal Compatibility**: Uses WhatsApp Web URL (`https://wa.me/`) for maximum compatibility
- **Cross-Platform Support**: Works on desktop browsers, mobile browsers, and native apps
- **Mobile Detection**: Intelligent device detection for optimal user experience
- **Analytics Integration**: Tracks WhatsApp shares in the existing share analytics system

#### WhatsApp Configuration Setup

**1. WhatsApp URL Configuration:**

The system uses a centralized configuration approach in `apps/web/src/config/whatsapp.ts`:

```typescript
export const WHATSAPP_CONFIG = {
  // Primary WhatsApp Web URL - works on all platforms
  WEB_URL: 'https://wa.me/',
  
  // Alternative URL (backup)
  WEB_URL_ALT: 'https://api.whatsapp.com/send',
  
  // Default share message template
  SHARE_MESSAGE_TEMPLATE: 'Check out this gratitude post:',
} as const
```

**2. Mobile Detection Configuration:**

The mobile detection system in `apps/web/src/utils/mobileDetection.ts` provides:

```typescript
// Device detection functions
export function isMobileDevice(): boolean
export function isIOS(): boolean  
export function isAndroid(): boolean

// WhatsApp URL generation
export function generateWhatsAppURL(text: string): string
export function formatWhatsAppShareText(postContent: string, postUrl: string): string
```

**3. Share Modal Integration:**

WhatsApp sharing is integrated into the existing ShareModal component with:
- WhatsApp icon and styling consistent with other share options
- Automatic text formatting for optimal WhatsApp display
- Analytics tracking for WhatsApp shares
- Success feedback and error handling

#### WhatsApp Sharing Implementation

**Backend Integration:**

The backend supports WhatsApp sharing through the existing share system:

```python
# Share method validation includes WhatsApp
VALID_SHARE_METHODS = ['url', 'message', 'whatsapp']

# WhatsApp-specific share service method
async def share_via_whatsapp(self, user_id: int, post_id: str) -> Dict[str, Any]:
    # Creates share record with method='whatsapp'
    # Generates share URL and WhatsApp-formatted text
    # Tracks analytics and creates notifications
```

**Frontend Implementation:**

```typescript
// WhatsApp share handler in ShareModal
const handleWhatsAppShare = async () => {
  // Generate share URL
  const shareUrl = `${window.location.origin}/post/${post.id}`
  
  // Format text for WhatsApp
  const whatsAppText = formatWhatsAppShareText(cleanContent, shareUrl)
  
  // Generate WhatsApp URL
  const whatsAppUrl = generateWhatsAppURL(whatsAppText)
  
  // Track analytics
  await trackWhatsAppShare(post.id)
  
  // Open WhatsApp
  window.open(whatsAppUrl, '_blank')
}
```

#### WhatsApp URL Format

**Generated URLs follow this pattern:**
```
https://wa.me/?text=Check%20out%20this%20gratitude%20post%3A%0Ahttps%3A//your-domain.com/post/123
```

**URL Components:**
- **Base URL**: `https://wa.me/` (WhatsApp Web)
- **Text Parameter**: URL-encoded share message with post URL
- **Message Format**: "Check out this gratitude post:\n[POST_URL]"

#### Testing WhatsApp Integration

**1. Development Testing:**
```bash
# Test WhatsApp URL generation
cd apps/web
npm test -- --testNamePattern="WhatsApp"

# Test mobile detection
npm test -- --testNamePattern="mobile"
```

**2. Manual Testing:**
- **Desktop**: Should open WhatsApp Web in new tab
- **Mobile**: Should open WhatsApp app or WhatsApp Web
- **Share Text**: Should include formatted message with post URL

**3. Analytics Verification:**
```bash
# Check WhatsApp share analytics
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8000/api/v1/posts/POST_ID/analytics"

# Should show whatsapp_shares count
```

#### WhatsApp Sharing Best Practices

**1. URL Reliability:**
- Always use `https://wa.me/` for maximum compatibility
- Avoid `whatsapp://` scheme URLs (causes blank pages on desktop)
- Include proper URL encoding for special characters

**2. Message Formatting:**
- Keep share text concise and clear
- Include post URL for easy access
- Use line breaks (`\n`) for better readability

**3. Error Handling:**
- Graceful fallback if WhatsApp is not available
- User-friendly error messages
- Analytics tracking even for failed attempts

**4. Mobile Optimization:**
- Detect mobile devices for optimal experience
- Handle both iOS and Android properly
- Test on actual devices, not just browser dev tools

#### Troubleshooting WhatsApp Sharing

**Common Issues:**

1. **WhatsApp doesn't open:**
   - Verify URL format is correct (`https://wa.me/?text=...`)
   - Check that text is properly URL-encoded
   - Test on different browsers and devices

2. **Blank page on desktop:**
   - Ensure using `wa.me` URL, not `whatsapp://` scheme
   - Check popup blocker settings
   - Verify WhatsApp Web is accessible

3. **Analytics not tracking:**
   - Check authentication token is valid
   - Verify share endpoint is responding
   - Check network requests in browser dev tools

**Debug WhatsApp Issues:**
```bash
# Test WhatsApp URL generation
node -e "
const { generateWhatsAppURL, formatWhatsAppShareText } = require('./apps/web/src/utils/mobileDetection.ts');
const text = formatWhatsAppShareText('Test post', 'https://example.com/post/123');
const url = generateWhatsAppURL(text);
console.log('WhatsApp URL:', url);
"

# Test share endpoint
curl -X POST "http://localhost:8000/api/v1/posts/POST_ID/share" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"share_method": "whatsapp"}'
```

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

#### Development Environment

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

#### Production Environment Configuration

For production deployments, additional configuration is required:

- **Database Connection Pooling**: Environment-specific pool sizes and SSL requirements
- **Load Balancing**: HAProxy or Nginx for high availability
- **SSL/TLS Configuration**: Let's Encrypt certificates with automatic renewal
- **Monitoring**: Prometheus, Grafana, and comprehensive health checks
- **Backup Systems**: Automated daily backups with cloud storage integration
- **Security Hardening**: Fail2Ban, SSH hardening, and security monitoring

See [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) for complete production setup instructions.

### Algorithm Configuration & Testing

#### Algorithm Configuration System

The Grateful platform uses a sophisticated algorithm configuration system that allows environment-specific tuning without code changes.

**Configuration Files:**
- `apps/api/app/config/algorithm_config.py` - Main configuration system
- Environment variables control which configuration set is loaded

**Environment Configuration:**
```bash
# Set environment for algorithm configuration
export ENVIRONMENT=development  # or staging, production

# Algorithm-specific environment variables (optional)
export ALGORITHM_SLOW_QUERY_THRESHOLD=1.0
export ALGORITHM_CACHE_TTL=300
export ALGORITHM_MAX_FEED_SIZE=100
```

**Configuration Categories:**

1. **Scoring Weights** - Base engagement scoring parameters
2. **Time Factors** - Time-based boosts and decay settings  
3. **Follow Bonuses** - Relationship multipliers and engagement tracking
4. **Own Post Factors** - User's own post visibility settings
5. **Diversity Limits** - Feed diversity and spacing rules
6. **Preference Factors** - User interaction-based preferences
7. **Mention Bonuses** - Mention detection and scoring

**Development vs Production Settings:**
```python
# Development: Higher randomization, lower thresholds
'development': {
    'scoring_weights': {'hearts': 1.2, 'reactions': 1.8},
    'own_post_factors': {'max_bonus_multiplier': 75.0},
    'diversity_limits': {'randomization_factor': 0.25}
}

# Production: Optimized for scale and user experience  
'production': {
    'scoring_weights': {'photo_bonus': 1.5, 'daily_gratitude_bonus': 2.0},
    'own_post_factors': {'max_bonus_multiplier': 50.0}
}
```

#### Algorithm Testing & Validation

**Unit Tests:**
```sh
cd apps/api
source venv/bin/activate

# Test algorithm service components
pytest tests/unit/test_algorithm_service.py -v

# Test configuration system
pytest tests/unit/test_algorithm_config.py -v

# Test performance monitoring
pytest tests/unit/test_performance_utils.py -v
```

**Integration Tests:**
```sh
# Test complete feed algorithm workflows
pytest tests/integration/test_feed_algorithm.py -v

# Test algorithm performance under load
pytest tests/integration/test_algorithm_performance.py -v

# Test configuration loading and validation
pytest tests/integration/test_algorithm_config_integration.py -v
```

**API Testing with Different Algorithm Parameters:**
```sh
# Test chronological feed (algorithm disabled)
curl "http://localhost:8000/api/v1/posts/feed?algorithm=false&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test algorithm-ranked feed with refresh mode
curl "http://localhost:8000/api/v1/posts/feed?algorithm=true&refresh=true&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test trending posts with different time windows
curl "http://localhost:8000/api/v1/posts/trending?time_window_hours=24&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:8000/api/v1/posts/trending?time_window_hours=168&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test read status tracking
curl -X POST "http://localhost:8000/api/v1/posts/mark-read" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"post_ids": ["post-123", "post-456"]}'
```

#### Performance Monitoring & Optimization

**Query Performance Monitoring:**
```sh
# Enable performance monitoring
cd apps/api
source venv/bin/activate
python -c "
from app.core.performance_utils import enable_performance_monitoring
enable_performance_monitoring()
print('Performance monitoring enabled')
"

# Check query performance logs
tail -f apps/api/logs/performance.log | grep -E "(algorithm|slow_query)"

# Generate performance report
python -c "
from app.core.query_monitor import get_query_performance_report
import json
report = get_query_performance_report()
print(json.dumps(report, indent=2))
"
```

**Database Performance Analysis:**
```sh
# Run comprehensive performance diagnostics
python -c "
import asyncio
from app.core.database import get_db
from app.core.performance_utils import run_performance_diagnostics

async def run_diagnostics():
    async for db in get_db():
        diagnostics = await run_performance_diagnostics(db)
        print(json.dumps(diagnostics, indent=2, default=str))
        break

asyncio.run(run_diagnostics())
"

# Analyze specific table performance
python -c "
import asyncio
from app.core.database import get_db
from app.core.performance_utils import db_performance_monitor

async def analyze_posts_table():
    async for db in get_db():
        analysis = await db_performance_monitor.analyze_table_performance(db, 'posts')
        print(json.dumps(analysis, indent=2, default=str))
        break

asyncio.run(analyze_posts_table())
"
```

**Algorithm Performance Testing:**
```sh
# Run algorithm performance benchmarks
cd apps/api
pytest tests/integration/test_feed_algorithm.py::test_feed_performance_benchmark -v -s

# Run performance optimization tests
pytest tests/integration/test_algorithm_performance_optimization.py -v

# Test algorithm with large datasets
pytest tests/integration/test_algorithm_scalability.py -v

# Memory usage profiling
python -m memory_profiler tests/performance/profile_algorithm.py
```

**Configuration Management:**
```sh
# Reload algorithm configuration without restart
python -c "
from app.config.algorithm_config import reload_algorithm_config
reload_algorithm_config()
print('Algorithm configuration reloaded')
"

# Get current configuration summary
python -c "
from app.config.algorithm_config import get_config_manager
import json
manager = get_config_manager()
summary = manager.get_config_summary()
print(json.dumps(summary, indent=2))
"

# Validate configuration
python -c "
from app.config.algorithm_config import AlgorithmConfigManager
try:
    manager = AlgorithmConfigManager()
    print('Configuration validation: PASSED')
except Exception as e:
    print(f'Configuration validation: FAILED - {e}')
"
```

#### Performance Optimization Strategies

**Database Optimization:**
```sh
# Create algorithm-specific indexes
psql -U postgres -d grateful -c "
CREATE INDEX CONCURRENTLY idx_posts_algorithm_scoring 
ON posts(is_public, created_at DESC) 
WHERE is_public = true;

CREATE INDEX CONCURRENTLY idx_follows_active_relationships 
ON follows(follower_id, followed_id, created_at) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_user_interactions_recent 
ON user_interactions(user_id, target_user_id, created_at) 
WHERE created_at > NOW() - INTERVAL '30 days';
"

# Analyze query performance
psql -U postgres -d grateful -c "
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM posts 
WHERE is_public = true 
ORDER BY created_at DESC 
LIMIT 20;
"
```

**Caching Configuration:**
```python
# Redis caching setup (optional)
REDIS_CONFIG = {
    'host': 'localhost',
    'port': 6379,
    'db': 0,
    'decode_responses': True,
    'socket_connect_timeout': 5,
    'socket_timeout': 5
}

# Cache TTL settings
CACHE_TTL = {
    'algorithm_config': 3600,      # 1 hour
    'user_follows': 1800,          # 30 minutes  
    'engagement_counts': 300,      # 5 minutes
    'read_status': 1800,           # 30 minutes
    'user_preferences': 1800,      # 30 minutes
    'post_scores': 600,            # 10 minutes
    'follow_relationships': 3600   # 1 hour
}

# Performance-optimized cache settings for algorithm operations
PERFORMANCE_CACHE_CONFIG = {
    'engagement_cache_ttl': 300,      # 5 minutes
    'preference_cache_ttl': 1800,     # 30 minutes
    'follow_cache_ttl': 3600,         # 1 hour
    'read_status_cache_ttl': 300,     # 5 minutes
    'post_scores_cache_ttl': 600      # 10 minutes
}
```

**Memory Management:**
```sh
# Monitor memory usage during algorithm operations
python -c "
import psutil
import os
process = psutil.Process(os.getpid())
print(f'Memory usage: {process.memory_info().rss / 1024 / 1024:.2f} MB')
"

# Set memory limits for algorithm operations
export ALGORITHM_MAX_MEMORY_MB=512
export ALGORITHM_CACHE_SIZE=1000
```

#### Scalability Considerations

**Current Performance Targets**:
- **Feed Loading**: <300ms target achieved (Cold cache: 180-250ms, Warm cache: 80-150ms)
- **User Capacity**: Current optimizations support up to 10,000 active users
- **Memory Footprint**: <5MB total algorithm cache overhead for typical usage

**Future Enhancements**:
1. **Redis Caching**: Move from in-memory to Redis for distributed caching
2. **Query Result Caching**: Cache complete query results for common patterns
3. **Async Batch Processing**: Further optimize batch operations with async processing
4. **Machine Learning Optimization**: Use ML to predict optimal cache sizes and TTLs

**Scaling Beyond 10K Users**:
- Implement Redis-based distributed caching
- Database connection pooling adjustments for high concurrency
- Consider horizontal scaling for algorithm service
- Monitor and optimize memory usage patterns

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

## Profile Photo Storage Configuration

### Storage Architecture

The Grateful platform includes a comprehensive profile photo management system with automatic image processing and multi-size variant generation.

#### Storage Directory Structure
```
apps/api/uploads/
├── profile_photos/           # Profile photo storage
│   ├── profile_abc123_thumbnail.jpg    # 64x64 pixels
│   ├── profile_abc123_small.jpg        # 128x128 pixels
│   ├── profile_abc123_medium.jpg       # 256x256 pixels
│   └── profile_abc123_large.jpg        # 512x512 pixels
└── posts/                    # Post image storage
    └── [post images...]
```

#### Image Processing Configuration

**Supported Formats:**
- JPEG (recommended for photos)
- PNG (supports transparency)
- WebP (modern format with better compression)

**Size Variants:**
```python
# Profile photo size configuration
PROFILE_PHOTO_SIZES = {
    "thumbnail": (64, 64),    # User avatars in lists
    "small": (128, 128),      # Small profile displays
    "medium": (256, 256),     # Default profile image
    "large": (512, 512)       # High-resolution display
}
```

**Image Processing Settings:**
- **Maximum File Size**: 5MB per upload
- **JPEG Quality**: 85% with optimization enabled
- **Aspect Ratio**: Square (1:1) with smart cropping
- **Color Profile**: sRGB color space
- **Compression**: Automatic optimization for web delivery

#### File Management

**Automatic Cleanup:**
- Old profile photos are automatically deleted when new ones are uploaded
- All size variants are cleaned up together to prevent orphaned files
- Failed uploads are automatically cleaned up to prevent storage bloat

**Unique Filename Generation:**
```python
# Filename format: profile_{uuid}_{size}.jpg
# Example: profile_abc123def456_medium.jpg
```

**Storage Path Configuration:**
```python
# Base upload directory (configurable)
BASE_UPLOAD_DIR = "uploads"

# Profile photos subdirectory
PROFILE_PHOTOS_DIR = "profile_photos"

# Full path example
FULL_PATH = "uploads/profile_photos/profile_abc123def456_medium.jpg"
```

#### Security Considerations

**File Validation:**
- Magic number validation to verify actual file type
- Filename sanitization to prevent directory traversal
- File size limits to prevent storage abuse
- Image format validation using PIL/Pillow

**Access Control:**
- Profile photos are publicly accessible (no authentication required for viewing)
- Upload and delete operations require authentication
- User can only modify their own profile photos

#### Performance Optimization

**Image Processing:**
- PIL/Pillow-based processing with memory optimization
- Batch processing for multiple size variants
- Efficient file I/O with proper error handling
- Automatic cleanup of temporary files

**Storage Efficiency:**
- JPEG compression with optimal quality settings
- Progressive JPEG encoding for faster loading
- Organized directory structure for efficient file system operations
- Automatic cleanup prevents storage bloat

#### Development Configuration

**Local Development Setup:**
```bash
# Ensure upload directory exists
mkdir -p apps/api/uploads/profile_photos

# Set proper permissions (Linux/macOS)
chmod 755 apps/api/uploads
chmod 755 apps/api/uploads/profile_photos
```

**Environment Variables:**
```bash
# Optional: Custom upload directory
UPLOAD_BASE_DIR=uploads

# Optional: Maximum file size (in MB)
MAX_PROFILE_PHOTO_SIZE_MB=5
```

**Testing Configuration:**
```python
# Test environment uses temporary directories
# Automatic cleanup after tests complete
# Mock image processing for faster test execution
```

#### Production Deployment

**Storage Recommendations:**
- Use dedicated storage service (AWS S3, Google Cloud Storage) for production
- Implement CDN for faster image delivery
- Set up automated backups for uploaded images
- Monitor storage usage and implement cleanup policies

**Scaling Considerations:**
- Image processing can be moved to background tasks for better performance
- Consider image optimization services for better compression
- Implement caching strategies for frequently accessed images
- Use load balancing for upload endpoints

#### Error Handling

**Upload Failures:**
- Automatic cleanup of partially uploaded files
- Detailed error messages for validation failures
- Graceful fallback to default avatars
- Retry mechanisms for transient failures

**Storage Issues:**
- Disk space monitoring and alerts
- Automatic cleanup of old temporary files
- Error logging for storage operations
- Fallback to default avatars when images are missing

#### API Integration

**Profile Photo Endpoints:**
- `POST /api/v1/users/me/profile/photo` - Upload new profile photo
- `DELETE /api/v1/users/me/profile/photo` - Delete current profile photo
- `GET /api/v1/users/me/profile/photo/default` - Get default avatar URL

**Response Format:**
```json
{
  "filename": "profile_abc123def456.jpg",
  "profile_image_url": "/uploads/profile_photos/profile_abc123def456_medium.jpg",
  "urls": {
    "thumbnail": "/uploads/profile_photos/profile_abc123def456_thumbnail.jpg",
    "small": "/uploads/profile_photos/profile_abc123def456_small.jpg",
    "medium": "/uploads/profile_photos/profile_abc123def456_medium.jpg",
    "large": "/uploads/profile_photos/profile_abc123def456_large.jpg"
  }
}
```

## Caching Configuration & Strategies

### Caching Architecture Overview

The Grateful platform implements a multi-layer caching strategy to optimize performance across different components:

#### Caching Layers

1. **Application-Level Caching** - In-memory caching for frequently accessed data
2. **Database Query Caching** - Query result caching with TTL-based invalidation
3. **Session-Based Caching** - User session data and read status tracking
4. **Configuration Caching** - Algorithm configuration and system settings

#### In-Memory Caching Implementation

**Read Status Caching** (`AlgorithmService`):
```python
# Session-based read status tracking
_read_status_cache: Dict[int, Dict[str, datetime]] = {}

# Efficient read status operations
def mark_posts_as_read(self, user_id: int, post_ids: List[str]):
    if user_id not in self._read_status_cache:
        self._read_status_cache[user_id] = {}
    
    current_time = datetime.now(timezone.utc)
    for post_id in post_ids:
        self._read_status_cache[user_id][post_id] = current_time
```

**Configuration Caching**:
```python
# LRU cache for algorithm configuration
@lru_cache(maxsize=1)
def get_algorithm_config() -> AlgorithmConfig:
    return _config_manager.config

# Cache invalidation on configuration reload
def reload_algorithm_config():
    get_algorithm_config.cache_clear()
    _config_manager.reload_config()
```

**Follow Relationship Caching**:
```python
# Cache follow relationships for session duration
class FollowService:
    def __init__(self):
        self._follow_cache: Dict[Tuple[int, int], bool] = {}
    
    async def is_following_cached(self, follower_id: int, followed_id: int) -> bool:
        cache_key = (follower_id, followed_id)
        if cache_key not in self._follow_cache:
            result = await self._check_follow_relationship(follower_id, followed_id)
            self._follow_cache[cache_key] = result
        return self._follow_cache[cache_key]
```

#### Database Query Caching

**Engagement Count Caching**:
```python
# Cache engagement counts with TTL
class EngagementCache:
    def __init__(self, ttl_seconds: int = 300):  # 5 minutes
        self.cache: Dict[str, Tuple[Dict[str, int], datetime]] = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    async def get_engagement_counts(self, post_id: str) -> Dict[str, int]:
        if post_id in self.cache:
            counts, cached_at = self.cache[post_id]
            if datetime.now() - cached_at < self.ttl:
                return counts
        
        # Fetch fresh counts and cache
        counts = await self._fetch_engagement_counts(post_id)
        self.cache[post_id] = (counts, datetime.now())
        return counts
```

**User Profile Caching**:
```python
# Cache user profiles with automatic invalidation
class UserProfileCache:
    def __init__(self):
        self.profiles: Dict[int, Tuple[User, datetime]] = {}
        self.ttl = timedelta(minutes=30)
    
    async def get_user_profile(self, user_id: int) -> User:
        if user_id in self.profiles:
            profile, cached_at = self.profiles[user_id]
            if datetime.now() - cached_at < self.ttl:
                return profile
        
        profile = await self._fetch_user_profile(user_id)
        self.profiles[user_id] = (profile, datetime.now())
        return profile
```

#### Redis Integration (Optional)

**Redis Configuration Setup**:
```python
# Redis connection configuration
REDIS_CONFIG = {
    'host': os.getenv('REDIS_HOST', 'localhost'),
    'port': int(os.getenv('REDIS_PORT', 6379)),
    'db': int(os.getenv('REDIS_DB', 0)),
    'decode_responses': True,
    'socket_connect_timeout': 5,
    'socket_timeout': 5,
    'retry_on_timeout': True,
    'health_check_interval': 30
}

# Redis client initialization
import redis.asyncio as redis

async def get_redis_client():
    return redis.Redis(**REDIS_CONFIG)
```

**Redis Caching Implementation**:
```python
class RedisCache:
    def __init__(self):
        self.redis = None
    
    async def get_redis(self):
        if not self.redis:
            self.redis = await get_redis_client()
        return self.redis
    
    async def get_cached_feed(self, user_id: int, cache_key: str) -> Optional[List[Dict]]:
        redis_client = await self.get_redis()
        cached_data = await redis_client.get(f"feed:{user_id}:{cache_key}")
        if cached_data:
            return json.loads(cached_data)
        return None
    
    async def cache_feed(self, user_id: int, cache_key: str, feed_data: List[Dict], ttl: int = 300):
        redis_client = await self.get_redis()
        await redis_client.setex(
            f"feed:{user_id}:{cache_key}",
            ttl,
            json.dumps(feed_data, default=str)
        )
```

#### Cache Management & Monitoring

**Cache Statistics Tracking**:
```python
class CacheMonitor:
    def __init__(self):
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'memory_usage': 0
        }
    
    def record_hit(self, cache_type: str):
        self.stats['hits'] += 1
    
    def record_miss(self, cache_type: str):
        self.stats['misses'] += 1
    
    def get_hit_ratio(self) -> float:
        total = self.stats['hits'] + self.stats['misses']
        return self.stats['hits'] / total if total > 0 else 0.0
```

**Cache Invalidation Strategies**:
```python
# Time-based invalidation
class TTLCache:
    def __init__(self, ttl_seconds: int):
        self.cache: Dict[str, Tuple[Any, datetime]] = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    def is_expired(self, key: str) -> bool:
        if key not in self.cache:
            return True
        _, cached_at = self.cache[key]
        return datetime.now() - cached_at > self.ttl

# Event-based invalidation
class EventBasedCache:
    def __init__(self):
        self.cache: Dict[str, Any] = {}
        self.dependencies: Dict[str, Set[str]] = {}
    
    def invalidate_by_event(self, event_type: str, entity_id: str):
        # Invalidate all cache entries dependent on this entity
        for cache_key in self.dependencies.get(f"{event_type}:{entity_id}", set()):
            self.cache.pop(cache_key, None)
```

#### Development vs Production Caching

**Development Configuration**:
```python
DEVELOPMENT_CACHE_CONFIG = {
    'algorithm_config_ttl': 60,        # 1 minute for quick testing
    'engagement_counts_ttl': 30,       # 30 seconds for rapid updates
    'user_profiles_ttl': 300,          # 5 minutes
    'read_status_ttl': 600,            # 10 minutes
    'max_cache_size': 1000,            # Smaller cache for development
    'enable_redis': False              # Use in-memory only
}
```

**Production Configuration**:
```python
PRODUCTION_CACHE_CONFIG = {
    'algorithm_config_ttl': 3600,      # 1 hour
    'engagement_counts_ttl': 300,      # 5 minutes
    'user_profiles_ttl': 1800,         # 30 minutes
    'read_status_ttl': 3600,           # 1 hour
    'max_cache_size': 10000,           # Larger cache for production
    'enable_redis': True,              # Use Redis for distributed caching
    'redis_cluster': True              # Enable Redis clustering
}
```

#### Cache Performance Monitoring

**Cache Metrics Collection**:
```sh
# Monitor cache hit ratios
python -c "
from app.core.cache_monitor import get_cache_statistics
import json
stats = get_cache_statistics()
print(json.dumps(stats, indent=2))
"

# Memory usage monitoring
python -c "
import psutil
import sys
process = psutil.Process()
memory_info = process.memory_info()
print(f'Cache memory usage: {memory_info.rss / 1024 / 1024:.2f} MB')
"
```

**Cache Optimization Commands**:
```sh
# Clear all caches
python -c "
from app.core.cache_manager import clear_all_caches
clear_all_caches()
print('All caches cleared')
"

# Warm up critical caches
python -c "
from app.core.cache_manager import warm_up_caches
import asyncio
asyncio.run(warm_up_caches())
print('Critical caches warmed up')
"

# Cache health check
python -c "
from app.core.cache_monitor import run_cache_health_check
import asyncio
health = asyncio.run(run_cache_health_check())
print(f'Cache health: {health}')
"
```

## Mobile Optimization Guidelines

### Mobile-First Development Approach

The Grateful platform is designed with mobile-first principles to ensure optimal user experience across all devices. All social interaction features are optimized for touch interfaces and mobile viewports.

#### Touch Interface Standards

**Minimum Touch Target Sizes**:
- All interactive elements must be at least 44px × 44px (iOS standard)
- Buttons and clickable areas should have adequate spacing (minimum 8px between targets)
- Touch targets should be visually distinct with proper contrast ratios

**Touch-Friendly Components**:
- **EmojiPicker**: Optimized emoji buttons with 48px touch targets
- **ShareModal**: Large, easy-to-tap sharing options with clear visual feedback
- **FollowButton**: Properly sized with loading states and haptic feedback simulation
- **NotificationDropdown**: Touch-optimized scrolling and tap interactions
- **MentionAutocomplete**: Touch-friendly dropdown with proper positioning
- **CommentsModal**: Full-featured comment system with lazy-loaded replies, emoji support, and mobile-optimized touch targets (44px minimum)

#### Responsive Design Patterns

**Viewport Handling**:
```css
/* Mobile-first breakpoints */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

**Modal Optimization**:
- Modals should adapt to mobile viewports (full-screen on small devices)
- Proper z-index management for mobile browsers
- Touch-friendly close buttons and swipe gestures
- Prevent body scrolling when modals are open

**Component Responsiveness**:
- **PostCard**: Responsive layout with proper image scaling
- **Navbar**: Collapsible navigation for mobile screens
- **Feed**: Optimized scrolling performance with virtual scrolling for large lists
- **Profile Pages**: Responsive grid layouts for posts and user information

#### Performance Optimization for Mobile

**Loading States and Feedback**:
- All async operations must show loading indicators
- Optimistic updates for immediate user feedback (follow/unfollow, reactions)
- Skeleton screens for content loading
- Progressive image loading with proper placeholders

**Network Optimization**:
- Debounced search queries (300ms for mention autocomplete)
- Efficient API calls with proper caching strategies
- Image optimization with responsive sizes and formats
- Lazy loading for non-critical content

**Touch Interaction Enhancements**:
- Haptic feedback simulation for supported devices
- Visual feedback for all touch interactions (active states)
- Prevent double-tap zoom issues on interactive elements
- Smooth animations and transitions (60fps target)

#### Mobile Testing Requirements

**Device Testing Matrix**:
- **iOS**: Safari on iPhone (latest 2 versions)
- **Android**: Chrome on Android (latest 2 versions)
- **Responsive Testing**: Chrome DevTools device simulation
- **Touch Testing**: Actual device testing for critical user flows

**Performance Benchmarks**:
- First Contentful Paint (FCP): < 1.5s on 3G
- Largest Contentful Paint (LCP): < 2.5s on 3G
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

#### Accessibility on Mobile

**Screen Reader Support**:
- Proper ARIA labels for all interactive elements
- Semantic HTML structure for navigation
- Focus management for modal interactions
- Voice-over friendly content descriptions

**Keyboard Navigation**:
- Tab order optimization for mobile keyboards
- Proper focus indicators for external keyboard users
- Escape key handling for modal dismissal
- Enter/Space key support for custom interactive elements

#### Mobile-Specific Features

**Progressive Web App (PWA) Considerations**:
- Proper viewport meta tags for mobile browsers
- Touch icon and splash screen configuration
- Offline-first approach for critical functionality
- App-like navigation patterns

**Mobile Browser Compatibility**:
- iOS Safari viewport handling and safe areas
- Android Chrome address bar behavior
- Cross-browser touch event handling
- Mobile-specific CSS properties and vendor prefixes

#### Development Workflow for Mobile

**Local Mobile Testing**:
```bash
# Start development server accessible on local network
cd apps/web
npm run dev -- --host 0.0.0.0

# Test on mobile devices using local IP
# Access via http://[your-local-ip]:3000
```

**Mobile Debugging**:
- Chrome DevTools remote debugging for Android
- Safari Web Inspector for iOS devices
- Console logging for touch event debugging
- Performance profiling on actual devices

**Mobile-First CSS Development**:
```css
/* Start with mobile styles */
.component {
  /* Mobile-first base styles */
}

/* Add desktop enhancements */
@media (min-width: 768px) {
  .component {
    /* Desktop-specific styles */
  }
}
```

#### Common Mobile Issues and Solutions

**Touch Event Handling**:
- Use `touchstart` events for immediate feedback
- Prevent default behavior for custom touch interactions
- Handle both touch and mouse events for hybrid devices
- Implement proper touch gesture recognition

**Viewport and Scrolling**:
- Prevent horizontal scrolling with proper overflow handling
- Use `touch-action` CSS property for scroll optimization
- Implement momentum scrolling for iOS: `-webkit-overflow-scrolling: touch`
- Handle keyboard appearance on iOS (viewport changes)

**Performance Optimization**:
- Use `will-change` CSS property sparingly for animations
- Implement efficient list virtualization for large datasets
- Optimize image loading with proper sizing and formats
- Use CSS transforms for smooth animations (GPU acceleration)

#### Algorithm Performance Troubleshooting

**Performance Issues**:
1. Check cache hit rates via `/api/v1/algorithm/performance/cache-stats`
2. Monitor query performance via `/api/v1/algorithm/performance/report`
3. Clear caches if stale data is suspected: `/api/v1/algorithm/performance/clear-cache`

**Common Performance Issues**:
- **High Memory Usage**: Reduce cache TTLs or clear caches more frequently
- **Slow Queries**: Check database indexes are properly applied with `EXPLAIN ANALYZE`
- **Cache Misses**: Verify cache configuration and TTL settings
- **Performance Monitoring Not Working**: Ensure `@monitor_algorithm_performance` decorators are applied

**Debug Mode for Algorithm Performance**:
```python
import logging
logging.getLogger('app.services.optimized_algorithm_service').setLevel(logging.DEBUG)
logging.getLogger('app.core.algorithm_performance').setLevel(logging.DEBUG)
```

**Performance Test Failures**:
- **Diversity calculation errors**: Check entropy calculation uses proper math functions
- **Cache performance inconsistent**: Cache performance can vary; tests allow for reasonable variance
- **Large dataset timeouts**: Non-optimized service may take longer with large datasets
- **Feed refresh issues**: Ensure `is_unread` field is properly set in optimized service

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

4. **Mobile Testing Issues:**
   - Ensure development server is accessible on local network (`--host 0.0.0.0`)
   - Check firewall settings for local network access
   - Use actual devices for touch interaction testing
   - Verify responsive breakpoints in browser DevTools

### Getting Help

- Check [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for common problems
- Review [USEFUL_COMMANDS.md](./USEFUL_COMMANDS.md) for command reference
- See [DATABASE_STRUCTURE.md](./DATABASE_STRUCTURE.md) for database schema
- See [GRATEFUL_PRD.md](./GRATEFUL_PRD.md) for project requirements
- See [TEST_GUIDELINES.md](./TEST_GUIDELINES.md) for mobile testing procedures 

---

## Navbar Architecture

### Modern Responsive Navigation System

The Grateful platform features a modern, responsive navbar architecture designed for optimal user experience across all devices:

#### Navbar Component Structure

**Core Architecture** (`apps/web/src/components/Navbar.tsx`):
- **Responsive Layout**: Three-section layout (logo, search, user actions) with mobile-first design
- **Conditional Rendering**: User-specific components only shown when authenticated
- **Touch-Optimized**: 44px minimum touch targets for mobile accessibility
- **Z-Index Management**: Proper layering for mobile search expansion

**Layout Sections**:
```typescript
// Left Section: Logo and branding
<div className="flex items-center flex-shrink-0 relative z-20">
  {/* Purple heart emoji (💜) + "Grateful" text */}
  {/* Clickable when user is authenticated */}
</div>

// Middle Section: User search (authenticated users only)
<div className="flex-1 min-w-0 max-w-md mx-auto relative overflow-visible">
  {/* Mobile: Collapsible search expanding leftward */}
  {/* Desktop: Fixed width centered search bar */}
</div>

// Right Section: User actions
<div className="flex items-center space-x-1 sm:space-x-3 flex-shrink-0 relative z-20">
  {/* Feed icon, notifications, profile dropdown */}
</div>
```

#### Mobile-First Responsive Design

**Mobile Optimization**:
- **Collapsible Search**: Search icon that expands to full input overlay
- **Touch Targets**: All interactive elements meet 44px minimum size
- **Overlay Positioning**: Mobile search expands leftward over logo text
- **Z-Index Layering**: Purple heart emoji (💜) always visible at highest z-index

**Desktop Enhancement**:
- **Fixed Search Bar**: Centered search input with consistent width
- **Horizontal Layout**: All elements visible simultaneously
- **Hover States**: Enhanced interaction feedback for mouse users

#### User Search Integration

**Search Component** (`apps/web/src/components/UserSearchBar.tsx`):
- **Debounced Search**: 300ms delay to prevent excessive API calls
- **Real-time Results**: Live user search with profile photos and bios
- **Keyboard Navigation**: Arrow keys, Enter, and Escape key support
- **Accessibility**: Full ARIA support with screen reader compatibility

**Search Features**:
- **Profile Navigation**: Click users to navigate to their profiles
- **Visual Feedback**: Loading states and empty state handling
- **Touch Optimization**: Proper touch targets and haptic feedback
- **Responsive Dropdown**: Adaptive positioning for mobile and desktop

#### Component Integration

**Integrated Components**:
- **NotificationSystem**: Bell icon with unread count badge
- **ProfileDropdown**: User avatar with dropdown menu for navigation
- **UserSearchBar**: Intelligent user search with autocomplete
- **Purple Heart Branding**: Consistent 💜 emoji throughout navigation

**State Management**:
- **Profile Dropdown**: Controlled open/close state with click-outside handling
- **Search Expansion**: Mobile search expansion state management
- **Navigation Handling**: Centralized routing with proper cleanup

#### Accessibility Features

**ARIA Implementation**:
- **Navigation Landmarks**: Proper `role="navigation"` with aria-label
- **Search Combobox**: Complete ARIA combobox pattern for search
- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Descriptive labels and live regions

**Touch Accessibility**:
- **Minimum Touch Targets**: 44px minimum for all interactive elements
- **Focus Management**: Proper focus indicators and tab order
- **Touch Feedback**: Visual and haptic feedback for touch interactions

#### Performance Optimizations

**Efficient Rendering**:
- **Conditional Components**: User-specific components only render when needed
- **Debounced Search**: Prevents excessive API calls during typing
- **Memoized Callbacks**: Optimized event handlers to prevent re-renders
- **Lazy Loading**: Search results loaded on-demand

**Mobile Performance**:
- **Touch Optimization**: Optimized touch event handling
- **Smooth Animations**: CSS transitions for search expansion
- **Memory Management**: Proper cleanup of event listeners and timeouts

---

## Post Type Detection System

### Intelligent Content Categorization

The Grateful platform uses an intelligent post type detection system that automatically categorizes user content into three distinct post types based on content characteristics:

#### Post Types and Limits

**Daily Gratitude Posts**:
- **Character Limit**: 5,000 characters
- **Display Prominence**: 3x larger display in feed
- **Purpose**: Thoughtful, reflective gratitude expressions
- **Detection**: Longer text (≥20 words) or any text + image combination

**Photo Gratitude Posts**:
- **Character Limit**: 0 characters (image only)
- **Display Prominence**: 2x boost display in feed
- **Purpose**: Visual gratitude expression through images
- **Detection**: Has image with no meaningful text content

**Spontaneous Text Posts**:
- **Character Limit**: 200 characters
- **Display Prominence**: Compact display in feed
- **Purpose**: Quick appreciation notes and brief gratitude moments
- **Detection**: Short text (<20 words) with no image

#### Detection Algorithm

**Classification Rules**:
```
1. Photo Only (has image, no meaningful text) → Photo Gratitude
2. Short Text (< 20 words, no image) → Spontaneous Text  
3. All Others (longer text, or any text + image) → Daily Gratitude
```

**Backend Implementation** (`ContentAnalysisService`):
```python
def _determine_post_type(self, content: str, word_count: int, has_image: bool) -> PostType:
    if has_image and word_count == 0:
        return PostType.photo
    if not has_image and word_count < 20:  # 20 word threshold
        return PostType.spontaneous
    return PostType.daily
```

**Frontend Implementation** (`CreatePostModal`):
- Real-time content analysis as users type
- Dynamic character limit updates based on detected type
- Visual feedback showing post type and display prominence
- Character count display with color coding (green/yellow/red)

#### User Experience Features

**Real-Time Detection**:
- Content analyzed as users type
- Post type displayed automatically: "Auto-detected as [Type]"
- Character limits update dynamically
- Visual hierarchy preview for users

**Character Limit Rationale**:
- **Daily (5,000)**: Deep reflection space (~750-1,000 words)
- **Photo (0)**: Pure visual expression philosophy
- **Spontaneous (200)**: Quick appreciation notes (~30-40 words)

---

## Location Management System

### Location Length Optimization

The platform implements intelligent location string management to ensure optimal user experience and database performance:

#### Location Length Constraints

**Optimal Length: 150 Characters**
- **User Experience**: Meaningful context without UI overflow
- **International Support**: Accommodates various language location formats
- **Database Efficiency**: Reasonable length for indexing and storage
- **Display Flexibility**: Works across different UI components

#### Implementation Details

**Backend Location Service** (`apps/api/app/services/location_service.py`):
```python
async def search_locations(
    self, 
    query: str, 
    limit: Optional[int] = None,
    max_length: Optional[int] = 150  # Configurable parameter
) -> List[Dict[str, Any]]:
```

**Features**:
- Server-side truncation with "..." suffix
- Configurable `max_length` parameter (default: 150)
- Validation of length constraints (50-300 character range)
- Database migration with automatic truncation of existing long locations

**Frontend Integration**:
- `LocationAutocomplete` component sends `max_length: 150` parameter
- Improved CSS with `break-words` and `line-clamp-2` for text wrapping
- Utility functions for location truncation and validation

#### Truncation Algorithm

**Server-Side (Python)**:
```python
if len(display_name) > max_length:
    display_name = display_name[:max_length-3] + "..."
```

**Client-Side (TypeScript)**:
```typescript
if (!displayName || displayName.length <= maxLength) {
    return displayName
}
return displayName.substring(0, maxLength - 3) + '...'
```

---

## Rich Text Editor Architecture

### ContentEditable Component Design

The platform uses a sophisticated rich text editor built on contentEditable with advanced mention support and race condition prevention:

#### Core Architecture

**Component Structure** (`apps/web/src/components/RichTextEditor.tsx`):
- ContentEditable-based editor with React integration
- Mention autocomplete with user search integration
- Real-time content analysis and type detection
- Advanced cursor position management

#### Race Condition Prevention

**Typing Protection Mechanism**:
```typescript
const typingRef = useRef(false)
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

const handleInput = () => {
  // Set typing flag to prevent external overwrites during user input
  typingRef.current = true;
  
  // Clear previous timeout and set new one
  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    typingRef.current = false;
  }, 500);
}
```

**Protected Content Updates**:
- Prevents DOM overwrites during active user input
- Debounced timeout clears typing flag after 500ms of inactivity
- Initialization guard ensures content is set only once on mount
- Significant change detection for external updates (>5 characters)

#### Mention System Integration

**DOM Range API Usage**:
```typescript
insertMention: (username: string, mentionStart: number, mentionEnd: number) => {
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  
  // Create mention span element
  const mentionSpan = document.createElement('span');
  mentionSpan.className = 'mention';
  mentionSpan.setAttribute('data-username', username);
  mentionSpan.contentEditable = 'false';
  mentionSpan.textContent = `@${username}`;
  
  // Insert using DOM range API instead of innerHTML
  range.deleteContents();
  range.insertNode(mentionSpan);
}
```

**Key Features**:
- Proper DOM manipulation instead of innerHTML replacement
- Selection preservation during programmatic updates
- Fallback support for range manipulation failures
- Integration with user search API for autocomplete

---

## Notification Link Handling System

### Link Generation Architecture

The Grateful platform includes a comprehensive notification link system that provides smart navigation from notifications to relevant content:

#### Notification Link Types

**Post-Related Notifications**:
- **Emoji Reactions**: Navigate to the post where the reaction occurred
- **Likes/Hearts**: Navigate to the liked post
- **Mentions**: Navigate to the post containing the mention
- **Shares**: Navigate to the shared post

**User-Related Notifications**:
- **Follows**: Navigate to the follower's profile page
- **Profile Interactions**: Navigate to relevant user profiles

**Batch Notifications**:
- **Batch Expansion**: Toggle expansion to show individual notifications within the batch
- **No Navigation**: Batch notifications themselves don't navigate, only expand/collapse

#### Link Generation Logic

**Frontend Link Utilities** (`apps/web/src/utils/notificationLinks.ts`):
```typescript
// Generate appropriate link for notification
export function generateNotificationLink(notification: {
  type: string
  postId?: string
  fromUser?: { id: string, name: string }
  isBatch?: boolean
  data?: any
}): NotificationLinkData | null

// Handle notification click with proper navigation
export function handleNotificationClick(
  notification: NotificationData,
  callbacks: {
    markAsRead: (id: string) => void
    toggleBatchExpansion: (id: string) => void
    navigate: (url: string) => void
    closeDropdown: () => void
  }
)
```

**Link Resolution Strategy**:
1. **Batch Check**: If notification is a batch, only toggle expansion (no navigation)
2. **Post Links**: For post-related notifications, generate `/post/{postId}` URLs
3. **User Links**: For user-related notifications, generate `/profile/{userId}` URLs
4. **Fallback**: Unknown notification types have no navigation

#### Clickable Username System

**ClickableUsername Component** (`apps/web/src/components/ClickableUsername.tsx`):
- **ID Resolution**: Automatically resolves usernames to user IDs for navigation
- **Fallback Handling**: Graceful fallback when user data is unavailable
- **Consistent Styling**: Purple-themed styling matching app design
- **Accessibility**: Proper keyboard navigation and ARIA labels

**Username Resolution Process**:
1. **Direct ID Navigation**: If valid user ID is provided, navigate directly
2. **Username Resolution**: If only username is available, resolve to ID via API
3. **API Lookup**: Use `/api/users/by-username/{username}` endpoint for resolution
4. **Error Handling**: Graceful fallback with user-friendly error messages

#### Navigation Integration

**Router Integration**:
- Uses Next.js router for client-side navigation
- Proper URL generation for SEO and bookmarking
- Back button support for navigation history

**Dropdown Management**:
- Automatically closes notification dropdown after navigation
- Maintains dropdown state for batch expansion/collapse
- Prevents navigation conflicts with dropdown interactions

#### Security and Validation

**ID Validation** (`apps/web/src/utils/idGuards.ts`):
```typescript
// Validate if ID is a proper profile ID format
export function validProfileId(id: string | number): boolean

// Ensure safe navigation with validated IDs
```

**Authentication Handling**:
- Username resolution requires valid authentication token
- Graceful degradation when authentication is unavailable
- Proper error handling for unauthorized access

#### Performance Optimizations

**Efficient Resolution**:
- Batch username resolution to minimize API calls
- Caching of resolved user IDs for repeated access
- Debounced resolution for rapid interactions

**Lazy Loading**:
- Username resolution only occurs when navigation is attempted
- Avoids unnecessary API calls for notifications that aren't clicked
- Efficient memory usage for large notification lists