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

### Algorithm Configuration & Testing

- **Test feed algorithm:**
  ```sh
  cd apps/api
  source venv/bin/activate
  pytest tests/unit/test_algorithm_service.py -v
  pytest tests/integration/test_feed_algorithm.py -v
  ```

- **Test algorithm with different parameters:**
  ```sh
  # Test chronological feed (algorithm disabled)
  curl "http://localhost:8000/api/v1/posts/feed?algorithm=false" \
    -H "Authorization: Bearer YOUR_TOKEN"
  
  # Test algorithm-ranked feed (default)
  curl "http://localhost:8000/api/v1/posts/feed?algorithm=true&limit=10" \
    -H "Authorization: Bearer YOUR_TOKEN"
  
  # Test trending posts
  curl "http://localhost:8000/api/v1/posts/trending?time_window_hours=24&limit=5" \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```

- **Monitor algorithm performance:**
  ```sh
  # Check query performance logs
  tail -f apps/api/logs/performance.log | grep "algorithm"
  
  # Run performance tests
  cd apps/api
  pytest tests/integration/test_feed_algorithm.py::test_feed_performance -v
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
##
 Notification Link Handling System

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