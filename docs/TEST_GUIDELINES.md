# Test Guidelines and Best Practices

## Overview

This document provides guidelines for writing and organizing tests in the Grateful project. We follow a structured approach to testing with clear separation between unit, integration, contract, and end-to-end tests. The testing strategy includes comprehensive validation of shared type contracts and API consistency.

## Current Test Status

### ✅ Backend Tests
- **Framework**: Pytest with async support
- **Status**: Fully configured and working (113/113 tests passing)
- **Coverage**: Unit tests for services, repositories, models, and API endpoints
- **Contract Tests**: API contract validation against shared type definitions
- **Location**: `apps/api/tests/`

### ✅ Frontend Tests
- **Framework**: Jest with React Testing Library
- **Status**: All tests are passing (231/231 tests passing)
- **Coverage**: Comprehensive coverage for components, API routes, and utilities
- **Type Safety**: Tests validate usage of shared type definitions
- **Location**: `apps/web/src/tests/`
- **Test Suites**: 17 passed, 17 total
- **Tests**: 231 passed, 0 skipped, 231 total

## Frontend Testing Setup

### Current Configuration

**Test Framework**: Jest with jsdom environment
**Location**: `apps/web/src/tests/`
**Setup File**: `apps/web/src/tests/setup.ts`

### Jest Configuration (`apps/web/jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx)',
    '**/?(*.)+(spec|test).(ts|tsx)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }]
  },
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
}
```

### Test Setup (`apps/web/src/tests/setup.ts`)
```typescript
import React from 'react'

// Mock environment variables for testing
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GITHUB_ID = 'test-github-id'
process.env.GITHUB_SECRET = 'test-github-secret'

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(init?: any) {
      return new Request(init)
    }
  },
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status || 200,
      json: () => Promise.resolve(data),
      headers: init?.headers || {}
    }),
    redirect: (url: string) => ({
      status: 302,
      headers: { Location: url }
    }),
  }
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
```

### Current Test Structure

```
apps/web/src/tests/
├── api
│   ├── notifications.test.ts
│   ├── posts.test.ts
│   └── reactions.test.ts
├── components
│   ├── CreatePostModal.scrolling.test.tsx
│   ├── CreatePostModal.test.tsx
│   ├── EmojiPicker.test.tsx
│   ├── NotificationSystem.test.tsx
│   ├── PostCard.interactions.test.tsx
│   ├── PostCard.reactions.realtime.test.tsx
│   ├── PostCard.realtime.test.tsx
│   ├── PostCard.simple.test.tsx
│   └── ReactionViewer.test.tsx
├── setup.ts
└── utils
    └── test-helpers.ts
```

### Test Organization Guidelines
- **Unit Tests**: `src/tests/unit/` - Test individual components and functions
- **Integration Tests**: `src/tests/integration/` - Test API routes and component interactions  
- **E2E Tests**: `src/tests/e2e/` - Test complete user workflows
- **Shared Utils**: `src/tests/utils/` - Common test utilities and helpers
- **Test Files**: Use lowercase with hyphens (e.g., `component-test.test.tsx`, `auth-flow.test.ts`)
- **Test Location**: All tests should be in the `tests/` folder, not alongside the code

### Running Frontend Tests

```bash
# Run all tests
cd apps/web
npm test

# Run specific test file
npm test PostCard.test.tsx

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run tests matching pattern
npm test -- --testNamePattern="PostCard"
```



## Test Structure

### Backend Tests (`apps/api/tests/`)

```
apps/api/tests/
├── conftest.py                           # Test configuration and fixtures
├── integration/                          # API endpoint integration tests
│   ├── test_api_contracts.py            # API response structure validation
│   ├── test_likes_api.py                 # Heart/like system API tests
│   ├── test_profile_api.py               # User profile API tests
│   ├── test_reactions_api.py             # Emoji reactions API tests
│   ├── test_notifications_api.py         # Notification system API tests
│   └── test_notification_batching_api.py # Notification batching tests
└── unit/                                 # Service layer and model unit tests
    ├── test_emoji_reactions.py           # EmojiReaction model and ReactionService tests
    ├── test_user_profile.py              # User model and UserService tests
    ├── test_notification_batching.py     # NotificationService batching logic tests
    └── test_notification_integration.py  # Notification integration tests
```

### Frontend Tests (`apps/web/src/tests/`)

```
apps/web/src/tests/
├── api
│   ├── notifications.test.ts
│   ├── posts.test.ts
│   └── reactions.test.ts
├── components
│   ├── CreatePostModal.scrolling.test.tsx
│   ├── CreatePostModal.test.tsx
│   ├── EmojiPicker.test.tsx
│   ├── NotificationSystem.test.tsx
│   ├── PostCard.interactions.test.tsx
│   ├── PostCard.reactions.realtime.test.tsx
│   ├── PostCard.realtime.test.tsx
│   ├── PostCard.simple.test.tsx
│   └── ReactionViewer.test.tsx
├── setup.ts
└── utils
    └── test-helpers.ts
```

## Shared Types Testing

### Type Safety Validation

The shared type system ensures consistency between frontend and backend through comprehensive testing:

#### Shared Type Structure
```
shared/types/
├── api.ts               # API contract types for all endpoints
├── models.ts            # Database model types and interfaces
├── services.ts          # Service layer interface definitions
├── core.ts              # Core types, enums, and constants
├── errors.ts            # Error type hierarchies
├── validation.ts        # Validation schemas and rules
└── python/models.py     # Python equivalents of TypeScript types
```

#### Type Testing Strategies

1. **Compilation Tests**: Ensure all TypeScript code compiles without type errors
2. **API Contract Tests**: Validate that API responses match shared type definitions
3. **Cross-Platform Consistency**: Verify Python and TypeScript types remain synchronized
4. **Runtime Validation**: Test that runtime validation matches compile-time types

#### Usage in Tests

**Frontend Type Usage**:
```typescript
import { PostResponse, CreatePostRequest, EmojiCode } from '@/shared/types'

// Type-safe test data
const mockPost: PostResponse = {
  id: 'test-id',
  content: 'Test post content',
  post_type: 'daily',
  author: { id: 1, username: 'testuser' },
  // ... other required fields with proper types
}

// Type-safe API testing
const createRequest: CreatePostRequest = {
  content: 'New post',
  post_type: 'daily',
  is_public: true
}
```

**Backend Type Usage**:
```python
# Python equivalents of TypeScript types
from app.schemas.api import CreatePostRequest, PostResponse
from app.models import Post, User

# Type-safe service testing
async def test_create_post_with_types():
    request_data = CreatePostRequest(
        content="Test post",
        post_type="daily",
        is_public=True
    )
    
    post = await post_service.create_post(user_id=1, **request_data.dict())
    response = PostResponse.from_model(post)
    
    assert response.content == request_data.content
    assert response.post_type == request_data.post_type
```

### Contract Testing

API contract tests validate that endpoints conform to shared type definitions:

```python
# Backend contract test
async def test_post_creation_api_contract(async_client, auth_headers):
    """Test that POST /posts endpoint matches API contract."""
    request_data = {
        "content": "Test post content",
        "post_type": "daily",
        "is_public": True
    }
    
    response = await async_client.post("/api/v1/posts/", json=request_data, headers=auth_headers)
    
    assert response.status_code == 201
    data = response.json()
    
    # Validate response structure matches PostResponse type
    assert "id" in data["data"]
    assert "content" in data["data"]
    assert "post_type" in data["data"]
    assert "author" in data["data"]
    assert "created_at" in data["data"]
    
    # Validate data types
    assert isinstance(data["data"]["id"], str)
    assert isinstance(data["data"]["content"], str)
    assert data["data"]["post_type"] in ["daily", "photo", "spontaneous"]
```

```typescript
// Frontend contract test
describe('API Contract Validation', () => {
  it('should match PostResponse type for created posts', async () => {
    const createRequest: CreatePostRequest = {
      content: 'Test post',
      post_type: 'daily',
      is_public: true
    }
    
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createRequest)
    })
    
    const data: PostResponse = await response.json()
    
    // TypeScript compiler ensures this matches PostResponse interface
    expect(data.id).toBeDefined()
    expect(data.content).toBe(createRequest.content)
    expect(data.post_type).toBe(createRequest.post_type)
    expect(data.author).toBeDefined()
  })
})
```

## Test Categories

### Unit Tests

**Purpose**: Test individual functions, components, or API endpoints in isolation.

**Backend Unit Tests**:
- Test service layer business logic (AuthService, UserService, ReactionService, NotificationService)
- Test mention system functionality (username validation, batch operations, search)
- Test database models and validation
- Test custom exception handling
- Test service layer validation and error handling
- Mock external dependencies and database operations

**Frontend Unit Tests**:
- Test React components in isolation (PostCard, EmojiPicker, MentionHighlighter, MentionAutocomplete)
- Test mention system utilities (mention parsing, username validation, highlighting)
- Test custom hooks
- Test utility functions
- Mock external dependencies

**Best Practices**:
- Keep tests focused and atomic
- Mock external dependencies
- Test both success and error cases
- Use descriptive test names

### Integration Tests

**Purpose**: Test how components work together.

**Backend Integration Tests**:
- Test complete API workflows with standardized responses
- Test mention system API endpoints (user search, batch validation, profile lookup)
- Test API contract validation and response structure
- Test authentication flows with JWT middleware
- Test service layer integration with database operations
- Test notification system with batching behavior (including mention notifications)
- Use test databases with proper cleanup

**Frontend Integration Tests**:
- Test page components
- Test API route handlers (including mention validation endpoints)
- Test component interactions (mention autocomplete, profile navigation)
- Test form submissions (post creation with mentions)
- Test mention system workflows (search, validation, highlighting, navigation)

**Best Practices**:
- Test complete workflows
- Use test databases
- Test real data scenarios
- Verify data persistence

### End-to-End Tests (Future)

**Purpose**: Test complete user workflows from start to finish.

**Tools**: Playwright or Cypress

**Test Scenarios**:
- User registration and login
- Post creation and interaction
- Social features (likes, comments, follows, mentions)
- Profile management
- Search and discovery
- Mention workflows (autocomplete, validation, navigation)

## Mention System Testing

### Backend Mention Tests

**User Search API Tests** (`test_batch_username_validation.py`):
```python
async def test_validate_usernames_batch_success():
    """Test successful batch username validation."""
    # Test that existing usernames are returned as valid
    # Test that non-existent usernames are returned as invalid
    # Test empty input handling
    # Test rate limiting and authentication

async def test_user_search_autocomplete():
    """Test user search with autocomplete functionality."""
    # Test partial username matching
    # Test case-insensitive search
    # Test result limiting and pagination
    # Test authentication requirements
```

**Repository Tests**:
```python
async def test_get_existing_usernames():
    """Test efficient batch username validation query."""
    # Test single database query for multiple usernames
    # Test performance with large username lists
    # Test handling of special characters in usernames
```

### Frontend Mention Tests

**MentionHighlighter Component Tests** (`MentionHighlighter.test.tsx`):
```typescript
describe('MentionHighlighter', () => {
  it('highlights valid usernames only', () => {
    // Test that only usernames in validUsernames array are highlighted
    // Test that invalid usernames are not highlighted
    // Test mixed content with valid and invalid mentions
  })

  it('handles click navigation', () => {
    // Test click handler is called with correct username
    // Test event propagation is stopped
    // Test navigation to user profiles
  })
})
```

**MentionAutocomplete Component Tests** (`MentionAutocomplete.test.tsx`):
```typescript
describe('MentionAutocomplete', () => {
  it('performs debounced search', () => {
    // Test 300ms debounce delay
    // Test API calls are made with correct parameters
    // Test loading states during search
  })

  it('displays search results correctly', () => {
    // Test user list rendering
    // Test profile image and bio display
    // Test keyboard navigation
  })
})
```

**Mention Utils Tests** (`mentionUtils.test.ts`):
```typescript
describe('mentionUtils', () => {
  it('extracts mentions correctly', () => {
    // Test @username pattern matching
    // Test special characters in usernames
    // Test multiple mentions in content
    // Test edge cases (start/end of content, punctuation)
  })

  it('validates username format', () => {
    // Test valid username patterns
    // Test invalid characters rejection
    // Test length limits
  })
})
```

### Integration Tests

**Mention Validation Integration** (`mention-validation-integration.test.tsx`):
```typescript
describe('Mention System Integration', () => {
  it('validates mentions end-to-end', () => {
    // Test PostCard component validates mentions
    // Test API calls to batch validation endpoint
    // Test highlighting updates based on validation results
    // Test error handling for API failures
  })

  it('handles mention navigation', () => {
    // Test click on mention navigates to profile
    // Test API call to get user by username
    // Test error handling for non-existent users
  })
})
```

### Test Coverage Requirements

**Backend Coverage**:
- ✅ UserService.validate_usernames_batch() - 100%
- ✅ UserRepository.get_existing_usernames() - 100%
- ✅ User search API endpoints - 100%
- ✅ Batch validation API endpoints - 100%

**Frontend Coverage**:
- ✅ MentionHighlighter component - 100%
- ✅ MentionAutocomplete component - 100%
- ✅ mentionUtils functions - 100%
- ✅ PostCard mention validation - 100%
- ✅ API route handlers - 100%

### Performance Testing

**Backend Performance**:
- Batch validation should handle 50+ usernames in single query
- User search should respond within 200ms
- Database queries should use proper indexes

**Frontend Performance**:
- Mention highlighting should not cause re-renders
- Autocomplete debouncing should prevent excessive API calls
- Search results should render smoothly

**Best Practices**:
- Test real user scenarios
- Include authentication flows
- Test responsive design
- Test cross-browser compatibility

## Follow System Testing

### Backend Follow Tests

**Follow Service Tests** (`test_follow_functionality.py`):
```python
async def test_follow_user_success():
    """Test successful user follow operation."""
    # Test that follow relationship is created
    # Test that follow notification is sent
    # Test that follow status is updated
    # Test proper response format

async def test_unfollow_user_success():
    """Test successful user unfollow operation."""
    # Test that follow relationship is removed
    # Test proper response format
    # Test that user can follow again after unfollowing

async def test_prevent_self_follow():
    """Test that users cannot follow themselves."""
    # Test ValidationException is raised
    # Test proper error message and status code

async def test_prevent_duplicate_follow():
    """Test that duplicate follows are prevented."""
    # Test ConflictError is raised for existing active follow
    # Test proper error handling for different follow statuses

async def test_follow_nonexistent_user():
    """Test following a user that doesn't exist."""
    # Test NotFoundError is raised
    # Test proper error message
```

**Follow Repository Tests** (`test_follow_repository.py`):
```python
async def test_get_followers_with_pagination():
    """Test getting followers with pagination."""
    # Test correct followers are returned
    # Test pagination parameters work correctly
    # Test total count is accurate
    # Test ordering by created_at desc

async def test_get_following_with_pagination():
    """Test getting following list with pagination."""
    # Test correct following users are returned
    # Test pagination and total count
    # Test follow status relative to current user

async def test_follow_statistics():
    """Test comprehensive follow statistics."""
    # Test followers_count accuracy
    # Test following_count accuracy
    # Test pending_requests and pending_sent counts

async def test_follow_suggestions():
    """Test follow suggestions algorithm."""
    # Test suggestions based on mutual connections
    # Test exclusion of already followed users
    # Test exclusion of self
    # Test limit parameter

async def test_bulk_follow_status_check():
    """Test bulk checking of follow status."""
    # Test efficient single query for multiple users
    # Test correct status mapping
    # Test performance with large user lists
```

### Frontend Follow Tests

**FollowButton Component Tests** (`FollowButton.test.tsx`):
```typescript
describe('FollowButton', () => {
  it('displays correct initial state', () => {
    // Test initial follow state display
    // Test button text and icon
    // Test loading state handling
  })

  it('handles follow action correctly', () => {
    // Test API call is made with correct parameters
    // Test optimistic UI update
    // Test success state handling
    // Test onFollowChange callback
  })

  it('handles unfollow action correctly', () => {
    // Test unfollow API call
    // Test UI state changes
    // Test confirmation if needed
  })

  it('handles authentication errors', () => {
    // Test behavior when user is not authenticated
    // Test error message display
    // Test redirect to login if needed
  })

  it('handles API errors gracefully', () => {
    // Test network error handling
    // Test server error responses
    // Test error message display
    // Test retry functionality
  })
})
```

**Follow API Route Tests** (`follow-api.test.ts`):
```typescript
describe('Follow API Routes', () => {
  it('POST /api/follows/[userId] works correctly', () => {
    // Test successful follow request
    // Test authentication requirement
    // Test error handling
    // Test response format
  })

  it('DELETE /api/follows/[userId] works correctly', () => {
    // Test successful unfollow request
    // Test authentication requirement
    // Test error handling for non-existent follow
  })

  it('GET /api/follows/[userId]/status works correctly', () => {
    // Test follow status retrieval
    // Test mutual follow detection
    // Test response format
  })
})
```

### Integration Tests

**Follow System Integration** (`follow-interactions.test.tsx`):
```typescript
describe('Follow System Integration', () => {
  it('complete follow workflow works end-to-end', () => {
    // Test user can follow another user
    // Test follow button updates correctly
    // Test follower count updates
    // Test follow notification is created
    // Test user appears in followers list
  })

  it('follow status is consistent across components', () => {
    // Test FollowButton shows correct status
    // Test profile page shows correct follow state
    // Test followers/following lists are accurate
  })

  it('handles follow suggestions correctly', () => {
    // Test suggestions API integration
    // Test suggestion display in UI
    // Test follow action from suggestions
  })
})
```

### Test Coverage Requirements

**Backend Coverage**:
- ✅ FollowService.follow_user() - 100%
- ✅ FollowService.unfollow_user() - 100%
- ✅ FollowService.get_follow_status() - 100%
- ✅ FollowService.get_followers() - 100%
- ✅ FollowService.get_following() - 100%
- ✅ FollowService.get_follow_stats() - 100%
- ✅ FollowService.get_follow_suggestions() - 100%
- ✅ FollowRepository specialized queries - 100%
- ✅ Follow API endpoints - 100%

**Frontend Coverage**:
- ✅ FollowButton component - 100%
- ✅ Follow API route handlers - 100%
- ✅ Follow status integration - 100%
- ✅ Follow workflow end-to-end - 100%

### Performance Testing

**Backend Performance**:
- Follow/unfollow operations should complete within 200ms
- Followers/following lists should load within 300ms for 50 users
- Follow suggestions should generate within 500ms
- Bulk follow status checks should handle 100+ users efficiently

**Frontend Performance**:
- FollowButton should respond to clicks within 100ms
- Optimistic updates should be immediate
- Follow status should load without blocking UI
- Large follower lists should render smoothly with pagination

### Security Testing

**Authentication & Authorization**:
- All follow endpoints require valid JWT tokens
- Users cannot follow themselves (validated on both frontend and backend)
- Follow operations are properly authorized
- Rate limiting prevents follow spam

**Data Validation**:
- User IDs are validated before follow operations
- Follow status values are validated against allowed enum
- Pagination parameters are validated and sanitized
- Bulk operations have reasonable limits

### Error Handling Testing

**Backend Error Scenarios**:
- Invalid user IDs (404 Not Found)
- Self-follow attempts (422 Validation Error)
- Duplicate follow attempts (409 Conflict)
- Database connection errors (500 Internal Server Error)
- Authentication failures (401 Unauthorized)

**Frontend Error Scenarios**:
- Network connectivity issues
- API server downtime
- Invalid authentication tokens
- Rate limiting responses
- Malformed API responses

### Best Practices for Follow System Testing

**Test Organization**:
- Separate unit tests for service layer business logic
- Integration tests for complete follow workflows
- API contract tests for endpoint validation
- Performance tests for scalability validation

**Test Data Management**:
- Use test fixtures for consistent user relationships
- Clean up follow relationships after each test
- Use realistic test data for performance testing
- Mock external dependencies appropriately

**Async Testing**:
- Proper async/await patterns in all tests
- Database transaction management for test isolation
- Concurrent operation testing for race conditions
- Timeout handling for long-running operations

## Writing Tests

### Test Consistency and Style Guidelines

**Shared Resources and Patterns**:
- Use consistent mocking patterns across all tests
- Share common test utilities and helpers
- Follow the same structure for similar test types
- Use consistent naming conventions for test files and functions
- Maintain consistent error handling patterns

**Style Consistency**:
- Use the same import patterns across test files
- Follow consistent describe/it block structure
- Use consistent assertion patterns
- Maintain consistent mock setup and teardown
- Use consistent environment variable handling

**Code Sharing**:
- Extract common test utilities to shared files in `src/tests/utils/`
- Use consistent mock implementations (e.g., Response, fetch) from shared utilities
- Share test data factories and fixtures
- Maintain consistent test setup and cleanup patterns
- Import shared utilities: `import { mockFetch, setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers'`

### Backend Test Examples

#### Service Layer Test
```python
async def test_auth_service_signup_success(db_session):
    """Test successful user signup through AuthService."""
    auth_service = AuthService(db_session)
    
    result = await auth_service.signup(
        username="testuser",
        email="test@example.com",
        password="securepassword123"
    )
    
    assert result["username"] == "testuser"
    assert result["email"] == "test@example.com"
    assert "access_token" in result
    assert result["token_type"] == "bearer"
```

#### API Integration Test
```python
async def test_create_post_api_contract(async_client, auth_headers):
    """Test API response structure and standardized formatting."""
    post_data = {
        "content": "I'm grateful for this test!",
        "post_type": "daily_gratitude",
        "is_public": True
    }
    
    response = await async_client.post(
        "/api/v1/posts/",
        json=post_data,
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    
    # Test standardized response structure
    assert data["success"] is True
    assert "data" in data
    assert "timestamp" in data
    assert "request_id" in data
    
    # Test post data
    post_data = data["data"]
    assert post_data["content"] == "I'm grateful for this test!"
```

#### Service Layer Validation Test
```python
async def test_user_service_validation(db_session):
    """Test UserService validation and error handling."""
    user_service = UserService(db_session)
    
    # Test validation exception for missing fields
    with pytest.raises(ValidationException) as exc_info:
        await user_service.update_user_profile(
            user_id=1,
            username=""  # Invalid empty username
        )
    
    assert exc_info.value.status_code == 422
    assert "username" in exc_info.value.details["fields"]
```

#### Database Model Test
```python
async def test_emoji_reaction_model_validation(db_session):
    """Test EmojiReaction model validation."""
    # Test valid emoji
    assert EmojiReaction.is_valid_emoji("heart_eyes")
    assert EmojiReaction.is_valid_emoji("pray")
    
    # Test invalid emoji
    assert not EmojiReaction.is_valid_emoji("invalid_emoji")
    
    # Test emoji display property
    reaction = EmojiReaction(emoji_code="heart_eyes")
    assert reaction.emoji_display == "😍"
```

### Frontend Test Examples

#### Component Test
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { PostCard } from '@/components/PostCard'

describe('PostCard', () => {
  it('renders post content correctly', () => {
    const post = {
      id: '1',
      content: 'I am grateful for testing!',
      postType: 'daily_gratitude',
      author: { name: 'Test User' }
    }
    
    render(<PostCard post={post} />)
    
    expect(screen.getByText('I am grateful for testing!')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })
  
  it('handles like button click', () => {
    const mockOnLike = jest.fn()
    const post = { id: '1', content: 'Test post' }
    
    render(<PostCard post={post} onLike={mockOnLike} />)
    
    fireEvent.click(screen.getByRole('button', { name: /like/i }))
    expect(mockOnLike).toHaveBeenCalledWith('1')
  })
})
```

#### API Route Test
```typescript
import { createMocks } from 'node-mocks-http'
import { GET } from '@/app/api/posts/route'

describe('/api/posts', () => {
  it('returns posts successfully', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })
    
    await GET(req, res)
    
    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(Array.isArray(data)).toBe(true)
  })
})
```

## Test Configuration

### Backend Test Setup

**Dependencies**:
- `pytest` - Test framework
- `pytest-asyncio` - Async test support
- `httpx` - HTTP client for testing
- `sqlalchemy` - Database testing

**Configuration** (`conftest.py`):
```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.fixture
async def async_client():
    """Async test client fixture."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
async def db_session():
    """Database session fixture."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        async with sessionmaker(engine)() as session:
            yield session
```

### Frontend Test Setup

**Dependencies**:
- `jest` - Test framework
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - DOM testing utilities
- `msw` - API mocking

**Configuration** (`jest.config.js`):
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.(ts|tsx)',
    '**/*.test.(ts|tsx)'
  ]
}
```

## Running Tests

### Backend Tests
```bash
# Run all tests
cd apps/api
pytest

# Run specific test file
pytest tests/unit/test_posts.py

# Run with coverage
pytest --cov=app

# Run with verbose output
pytest -v
```

### Frontend Tests
```bash
# Run all tests
cd apps/web
npm test

# Run specific test file
npm test PostCard.test.tsx

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Data Management

### Backend Test Data
- Use factories for creating test data
- Clean up data after each test
- Use unique identifiers to avoid conflicts
- Mock external services

### Frontend Test Data
- Use mock data for components
- Mock API responses
- Use test utilities for common data
- Reset state between tests

## Service Layer Testing Patterns

### Testing Service Classes

**Service Layer Architecture**: All business logic is contained in service classes that inherit from `BaseService`. Test these services directly for unit tests.

**Common Service Test Patterns**:

```python
# Test service initialization
def test_service_initialization():
    service = AuthService(db_session)
    assert isinstance(service, BaseService)
    assert service.db == db_session

# Test service validation
async def test_service_validation():
    service = UserService(db_session)
    
    with pytest.raises(ValidationException):
        await service.update_user_profile(user_id=1, username="")

# Test service error handling
async def test_service_not_found():
    service = UserService(db_session)
    
    with pytest.raises(NotFoundError):
        await service.get_user_profile(user_id=999999)

# Test service business logic
async def test_service_business_logic():
    service = ReactionService(db_session)
    
    result = await service.add_reaction(
        user_id=1, post_id="post123", emoji_code="heart_eyes"
    )
    
    assert result["emoji_code"] == "heart_eyes"
    assert result["emoji_display"] == "😍"
```

### Testing API Endpoints

**API endpoints should be thin controllers** that delegate to service classes. Test the complete request/response cycle including standardized formatting.

```python
async def test_api_endpoint_success(async_client, auth_headers):
    """Test API endpoint with standardized response."""
    response = await async_client.get("/api/v1/users/me/profile", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    
    # Test standardized response structure
    assert data["success"] is True
    assert "data" in data
    assert "timestamp" in data
    assert "request_id" in data

async def test_api_endpoint_error_handling(async_client):
    """Test API error handling with custom exceptions."""
    response = await async_client.get("/api/v1/users/me/profile")  # No auth
    
    assert response.status_code == 401
    data = response.json()
    
    # Test standardized error response
    assert data["success"] is False
    assert "error" in data
    assert data["error"]["code"] == "authentication_error"
```

## Best Practices

### General Guidelines
1. **Write tests first** (TDD approach)
2. **Keep tests simple and focused**
3. **Use descriptive test names**
4. **Test both success and error cases**
5. **Mock external dependencies**
6. **Use fixtures for common setup**

### Backend Specific
1. **Test service layer directly** for business logic
2. **Test API endpoints** for request/response contracts
3. **Use async/await consistently**
4. **Test custom exception handling**
5. **Verify standardized response formatting**
6. **Test authentication and authorization middleware**
7. **Use test databases with proper cleanup**

### Service Layer Architecture Patterns

**BaseService Testing**: All services inherit from `BaseService` which provides common CRUD operations.

```python
# Test BaseService common operations
async def test_base_service_get_by_id():
    service = UserService(db_session)
    user = await service.get_by_id(User, user_id)
    assert user.id == user_id

async def test_base_service_validation():
    service = UserService(db_session)
    service.validate_required_fields({"email": "test@example.com"}, ["email"])
    # Should not raise exception
    
    with pytest.raises(ValidationException):
        service.validate_required_fields({}, ["email"])
```

**Custom Exception Testing**: Test that services raise appropriate custom exceptions.

```python
# Test custom exceptions
async def test_not_found_exception():
    service = UserService(db_session)
    
    with pytest.raises(NotFoundError) as exc_info:
        await service.get_user_profile(999999)
    
    assert exc_info.value.status_code == 404
    assert exc_info.value.error_code == "not_found"

async def test_validation_exception():
    service = AuthService(db_session)
    
    with pytest.raises(ValidationException) as exc_info:
        await service.signup("", "invalid-email", "short")
    
    assert exc_info.value.status_code == 422
    assert exc_info.value.error_code == "validation_error"
```

**Standardized Response Testing**: Test that API endpoints return properly formatted responses.

```python
# Test standardized responses
async def test_success_response_format(async_client, auth_headers):
    response = await async_client.get("/api/v1/users/me/profile", headers=auth_headers)
    data = response.json()
    
    # All success responses should have this structure
    assert "success" in data and data["success"] is True
    assert "data" in data
    assert "timestamp" in data
    assert "request_id" in data

async def test_error_response_format(async_client):
    response = await async_client.get("/api/v1/users/me/profile")  # No auth
    data = response.json()
    
    # All error responses should have this structure
    assert "success" in data and data["success"] is False
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "timestamp" in data
    assert "request_id" in data
```

### Frontend Specific
1. **Test user interactions**
2. **Test component rendering**
3. **Test form validation**
4. **Test responsive design**
5. **Mock API calls**

## Common Patterns

### Backend Test Patterns
- **API Testing**: Use AsyncClient to test endpoints
- **Database Testing**: Use test database with fixtures
- **Authentication Testing**: Use JWT token fixtures
- **Error Testing**: Test various error scenarios

### Frontend Test Patterns
- **Component Testing**: Test rendering and interactions
- **Hook Testing**: Test custom hooks in isolation
- **API Testing**: Mock API responses
- **Form Testing**: Test form validation and submission

## Troubleshooting

### Common Issues
1. **Async/Await Issues**: Ensure proper async test setup
2. **Database Conflicts**: Use unique test data
3. **Mock Issues**: Verify mock setup and teardown
4. **Environment Issues**: Check test environment configuration
5. **Response Not Defined**: Ensure global Response mock is set up in test helpers

### Debugging Tips
1. **Use `pytest -s` for print statements**
2. **Use `console.log` in frontend tests**
3. **Check test database state**
4. **Verify mock configurations**
5. **Check shared utilities**: Ensure `src/tests/utils/test-helpers.ts` is imported

---

*Last updated: [Current Date]* 
##
 Notification Factory Testing (Refactored System)

### ✅ New Testing Approach (December 2024)

The notification system has been refactored with a unified `NotificationFactory` that eliminates common issues. All new notification testing should follow these patterns:

### Backend NotificationFactory Tests

**Factory Unit Tests** (`test_notification_factory.py`):
```python
from app.core.notification_factory import NotificationFactory

async def test_create_notification_success():
    """Test successful notification creation with factory."""
    factory = NotificationFactory(mock_db)
    
    result = await factory.create_notification(
        user_id=123,
        notification_type="test_type",
        title="Test Title",
        message="Test message",
        data={"test": "data"}
    )
    
    assert result is not None
    mock_notification_repo.create.assert_called_once()

async def test_prevent_self_notification():
    """Test that self-notifications are prevented."""
    factory = NotificationFactory(mock_db)
    
    result = await factory.create_notification(
        user_id=123,
        notification_type="test_type",
        title="Test Title", 
        message="Test message",
        data={"test": "data"},
        prevent_self_notification=True,
        self_user_id=123  # Same as user_id
    )
    
    assert result is None  # Should be prevented
    mock_notification_repo.create.assert_not_called()

async def test_notification_type_methods():
    """Test all notification type convenience methods."""
    factory = NotificationFactory(mock_db)
    
    # Test each notification type
    await factory.create_share_notification(...)
    await factory.create_mention_notification(...)
    await factory.create_reaction_notification(...)
    await factory.create_like_notification(...)
    await factory.create_follow_notification(...)
```

### Frontend NotificationUserResolver Tests

**Resolver Unit Tests** (`notificationUserResolver.test.ts`):
```typescript
import { 
  extractNotificationUsername,
  resolveNotificationUser,
  validateNotificationUserData 
} from '@/utils/notificationUserResolver'

describe('NotificationUserResolver', () => {
  it('should prioritize from_user.username when available', () => {
    const notification = {
      from_user: { username: 'real_user' },
      data: { reactor_username: 'legacy_user' }
    }
    
    expect(extractNotificationUsername(notification)).toBe('real_user')
  })

  it('should handle all notification types automatically', () => {
    // Test reactor_username (reactions)
    // Test sharer_username (shares)  
    // Test author_username (mentions)
    // Test liker_username (likes)
    // Test follower_username (follows)
    // Test custom fields ending with 'username'
  })

  it('should validate notification data', () => {
    const validation = validateNotificationUserData(notification)
    expect(validation.isValid).toBe(true)
    expect(validation.detectedUsername).toBe('expected_user')
  })
})
```

### Integration Testing Patterns

**Service Integration Tests**:
```python
async def test_service_uses_factory():
    """Test that services use NotificationFactory correctly."""
    # Test MentionService creates mention notifications
    # Test ShareService creates share notifications  
    # Test ReactionService creates reaction notifications
    # Test LikesAPI creates like notifications
    
    # Verify notifications are created with correct data structure
    # Verify usernames are stored in standardized fields
    # Verify no "Unknown User" issues occur
```

**API Route Tests**:
```typescript
describe('Notification API Routes', () => {
  it('should resolve usernames from any notification type', async () => {
    // Mock notifications with different username fields
    // Test that all are resolved correctly by NotificationUserResolver
    // Verify no "Unknown User" appears in responses
  })
})
```

### Testing New Notification Types

When adding a new notification type, follow this testing checklist:

#### Backend Tests ✅
```python
async def test_new_notification_type():
    """Test new notification type creation."""
    factory = NotificationFactory(db)
    
    # Test successful creation
    notification = await factory.create_your_notification(
        recipient_id=user_id,
        sender_username=sender.username,
        # ... other params
    )
    
    assert notification is not None
    assert notification.type == "your_notification_type"
    assert notification.data["sender_username"] == sender.username
    
    # Test self-notification prevention (if applicable)
    self_notification = await factory.create_your_notification(
        recipient_id=user_id,
        sender_username=sender.username,
        sender_id=user_id  # Same user
    )
    assert self_notification is None
```

#### Frontend Tests ✅
```typescript
describe('New Notification Type', () => {
  it('should extract username from new notification type', () => {
    const notification = {
      from_user: null,
      data: { your_username_field: 'test_user' }
    }
    
    const username = extractNotificationUsername(notification)
    expect(username).toBe('test_user')
    expect(username).not.toBe('Unknown User')
  })
})
```

### Legacy Testing (For Reference)

The old notification testing patterns are deprecated but kept for reference:

- ❌ Don't use `NotificationService.create_*` static methods
- ❌ Don't manually update notification route handlers
- ❌ Don't create custom username extraction logic

### Benefits of New Testing Approach

1. **Consistent Patterns**: All notification types follow the same testing structure
2. **Automatic Coverage**: Frontend resolver automatically handles new notification types
3. **Reduced Maintenance**: No need to update route handlers for new types
4. **Better Reliability**: Factory pattern prevents common notification creation issues
5. **Comprehensive Validation**: Built-in validation utilities for debugging

---

*For complete examples, see the test files in `apps/api/tests/unit/test_notification_factory.py` and `apps/web/src/tests/utils/notificationUserResolver.test.ts`*