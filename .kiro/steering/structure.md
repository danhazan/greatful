# Project Structure & Organization

## Root Structure
```
grateful/
├── apps/                    # Application code
│   ├── api/                # FastAPI backend
│   └── web/                # Next.js frontend
├── alembic/                # Database migrations
├── docs/                   # Project documentation
├── tools/                  # Developer utilities
└── for_reference/          # Reference implementations
```

## Backend Structure (`apps/api/`)
```
apps/api/
├── app/
│   ├── api/v1/            # API endpoints by feature
│   │   ├── auth.py        # Authentication endpoints
│   │   ├── users.py       # User management
│   │   ├── posts.py       # Post CRUD operations
│   │   ├── likes.py       # Heart/like system
│   │   └── reactions.py   # Emoji reactions
│   ├── core/              # Core functionality
│   │   ├── database.py    # Database connection & session
│   │   └── security.py    # JWT & password handling
│   ├── models/            # SQLAlchemy models
│   │   ├── user.py        # User model with relationships
│   │   ├── post.py        # Post model with types
│   │   ├── like.py        # Like/heart model
│   │   └── emoji_reaction.py # Emoji reaction model
│   └── services/          # Business logic layer
│       └── reaction_service.py
├── tests/                 # Test organization
│   ├── conftest.py        # Shared fixtures
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── main.py                # FastAPI app entry point
└── requirements.txt       # Python dependencies
```

## Frontend Structure (`apps/web/`)
```
apps/web/src/
├── app/                   # Next.js App Router
│   ├── api/               # API route handlers (proxy to backend)
│   │   ├── auth/          # Authentication routes
│   │   ├── posts/         # Post-related routes
│   │   ├── users/         # User-related routes
│   │   └── notifications/ # Notification routes
│   ├── auth/              # Authentication pages
│   ├── feed/              # Main feed page
│   ├── profile/           # User profile pages
│   ├── demo/              # Demo/testing page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable React components
│   ├── PostCard.tsx       # Main post display component
│   ├── EmojiPicker.tsx    # Emoji reaction selector
│   ├── ReactionViewer.tsx # Reaction display modal
│   ├── HeartsViewer.tsx   # Hearts/likes viewer
│   ├── CreatePostModal.tsx # Post creation modal
│   └── NotificationSystem.tsx # Notification handling
├── tests/                 # Frontend tests
│   ├── components/        # Component tests
│   ├── api/               # API route tests
│   ├── utils/             # Utility tests
│   └── setup.ts           # Test configuration
├── utils/                 # Utility functions
│   ├── emojiMapping.ts    # Emoji configuration
│   ├── localStorage.ts    # Local storage helpers
│   └── imageUpload.ts     # Image handling
└── services/              # External service integrations
    └── analytics.ts       # Analytics service
```

## Database Structure (`alembic/`)
```
alembic/
├── versions/              # Migration files
│   ├── 000_create_base_tables.py
│   ├── 001_create_emoji_reactions_table.py
│   ├── 002_add_user_profile_fields.py
│   └── 003_create_likes_table.py
└── env.py                 # Alembic configuration
```

## Documentation (`docs/`)
```
docs/
├── GRATEFUL_PRD.md        # Product requirements
├── ARCHITECTURE_AND_SETUP.md # Setup guide
├── DATABASE_STRUCTURE.md  # Database schema
├── BACKEND_API_DOCUMENTATION.md # API docs
├── TEST_GUIDELINES.md     # Testing standards
├── KNOWN_ISSUES.md        # Issue tracking
└── USEFUL_COMMANDS.md     # Command reference
```

## Naming Conventions

### Files & Directories
- **Snake_case**: Python files, database tables, API endpoints
- **PascalCase**: React components, TypeScript interfaces
- **kebab-case**: URL routes, CSS classes
- **camelCase**: JavaScript/TypeScript variables and functions

### Database Models
- Table names: plural, snake_case (`users`, `emoji_reactions`)
- Column names: snake_case (`created_at`, `profile_image_url`)
- Foreign keys: `{table}_id` format (`user_id`, `post_id`)

### API Endpoints
- RESTful structure: `/api/v1/{resource}/{action}`
- Consistent HTTP methods (GET, POST, PUT, DELETE)
- Plural resource names (`/users`, `/posts`, `/reactions`)

### React Components
- PascalCase filenames matching component name
- Props interfaces: `{ComponentName}Props`
- Test files: `{ComponentName}.test.tsx`

## Feature Organization

### By Domain
- Each major feature has its own API endpoint file
- Corresponding React components grouped by functionality
- Tests mirror the source structure
- Database models reflect business entities

### Shared Code
- **Backend**: `core/` for database and security utilities
- **Frontend**: `utils/` for shared functions, `components/` for reusable UI
- **Tests**: `conftest.py` and `setup.ts` for shared test configuration

## Import Patterns

### Backend
```python
# Relative imports within app
from app.models.user import User
from app.core.database import get_db
from app.api.v1.auth import router
```

### Frontend
```typescript
// Absolute imports with @ alias
import { PostCard } from '@/components/PostCard'
import { emojiMapping } from '@/utils/emojiMapping'
import { analytics } from '@/services/analytics'
```