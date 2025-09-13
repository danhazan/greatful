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

#### Navbar Component Testing

**Navbar Component Tests** (`apps/web/src/tests/components/Navbar.test.tsx`):

The Navbar component requires comprehensive testing due to its complex responsive behavior and integrated search functionality:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/components/NotificationSystem', () => {
  return function MockNotificationSystem({ userId }: { userId: string }) {
    return <div data-testid="notification-system">Notifications for {userId}</div>
  }
})

jest.mock('@/components/UserSearchBar', () => {
  return function MockUserSearchBar({ isMobile }: { isMobile?: boolean }) {
    return (
      <div data-testid={isMobile ? "mobile-search" : "desktop-search"}>
        Search Component
      </div>
    )
  }
})

describe('Navbar Component', () => {
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      back: jest.fn(),
    })
  })

  describe('Basic Rendering', () => {
    it('renders logo and branding correctly', () => {
      render(<Navbar />)
      
      expect(screen.getByText('💜')).toBeInTheDocument()
      expect(screen.getByText('Grateful')).toBeInTheDocument()
    })

    it('shows user-specific components when authenticated', () => {
      render(<Navbar user={mockUser} />)
      
      expect(screen.getByTestId('notification-system')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Go to feed' })).toBeInTheDocument()
    })

    it('hides user-specific components when not authenticated', () => {
      render(<Navbar />)
      
      expect(screen.queryByTestId('notification-system')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Go to feed' })).not.toBeInTheDocument()
    })
  })

  describe('Search Integration', () => {
    it('renders search component for authenticated users', () => {
      render(<Navbar user={mockUser} />)
      
      // Should render both mobile and desktop search components
      expect(screen.getByTestId('mobile-search')).toBeInTheDocument()
      expect(screen.getByTestId('desktop-search')).toBeInTheDocument()
    })

    it('does not render search for unauthenticated users', () => {
      render(<Navbar />)
      
      expect(screen.queryByTestId('mobile-search')).not.toBeInTheDocument()
      expect(screen.queryByTestId('desktop-search')).not.toBeInTheDocument()
    })
  })

  describe('Navigation Behavior', () => {
    it('navigates to feed when logo is clicked (authenticated)', () => {
      const mockPush = jest.fn()
      ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
      
      render(<Navbar user={mockUser} />)
      
      const logoButton = screen.getByRole('button', { name: /go to grateful home/i })
      fireEvent.click(logoButton)
      
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })

    it('logo is not clickable when not authenticated', () => {
      render(<Navbar />)
      
      expect(screen.queryByRole('button', { name: /go to grateful home/i })).not.toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('applies correct responsive classes', () => {
      render(<Navbar user={mockUser} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('sticky', 'top-0', 'z-40')
      expect(nav).toHaveClass('px-3', 'sm:px-4', 'py-3', 'sm:py-4')
    })

    it('ensures proper touch targets for mobile', () => {
      render(<Navbar user={mockUser} />)
      
      const feedButton = screen.getByRole('button', { name: 'Go to feed' })
      expect(feedButton).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and navigation structure', () => {
      render(<Navbar user={mockUser} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('aria-label', 'Main navigation')
      
      const feedButton = screen.getByRole('button', { name: 'Go to feed' })
      expect(feedButton).toHaveAttribute('title', 'Feed')
    })

    it('provides proper focus management', () => {
      render(<Navbar user={mockUser} />)
      
      const feedButton = screen.getByRole('button', { name: 'Go to feed' })
      expect(feedButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-purple-500')
    })
  })
})
```

**UserSearchBar Component Tests** (`apps/web/src/tests/components/UserSearchBar.test.tsx`):

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import UserSearchBar from '@/components/UserSearchBar'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('UserSearchBar Component', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(global.fetch as jest.Mock).mockClear()
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
  })

  describe('Desktop Mode', () => {
    it('renders search input with proper attributes', () => {
      render(<UserSearchBar placeholder="Search users..." />)
      
      const input = screen.getByRole('combobox', { name: 'Search for users' })
      expect(input).toHaveAttribute('placeholder', 'Search users...')
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).toHaveAttribute('aria-haspopup', 'listbox')
    })

    it('shows clear button when query is entered', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test query')
      
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
    })
  })

  describe('Mobile Mode', () => {
    it('renders collapsed search icon initially', () => {
      render(<UserSearchBar isMobile={true} />)
      
      expect(screen.getByRole('button', { name: 'Search for users' })).toBeInTheDocument()
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('expands to full input when icon is clicked', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={true} />)
      
      const searchButton = screen.getByRole('button', { name: 'Search for users' })
      await user.click(searchButton)
      
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Close search' })).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('performs debounced search after 300ms', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            username: 'testuser',
            display_name: 'Test User',
            profile_image_url: null,
            bio: 'Test bio'
          }
        ]
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const user = userEvent.setup()
      render(<UserSearchBar />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Wait for debounce
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/users/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
          body: JSON.stringify({
            query: 'test',
            limit: 10
          }),
        })
      }, { timeout: 500 })
    })

    it('navigates to user profile when result is clicked', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            username: 'testuser',
            display_name: 'Test User',
            profile_image_url: null,
            bio: 'Test bio'
          }
        ]
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const user = userEvent.setup()
      render(<UserSearchBar />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByRole('option')).toBeInTheDocument()
      })
      
      const result = screen.getByRole('option')
      await user.click(result)
      
      expect(mockPush).toHaveBeenCalledWith('/profile/1')
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation through results', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, username: 'user1', display_name: 'User 1' },
          { id: 2, username: 'user2', display_name: 'User 2' }
        ]
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const user = userEvent.setup()
      render(<UserSearchBar />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'user')
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(2)
      })
      
      // Test arrow key navigation
      await user.keyboard('{ArrowDown}')
      expect(screen.getAllByRole('option')[0]).toHaveClass('bg-purple-50')
      
      await user.keyboard('{ArrowDown}')
      expect(screen.getAllByRole('option')[1]).toHaveClass('bg-purple-50')
      
      await user.keyboard('{Enter}')
      expect(mockPush).toHaveBeenCalledWith('/profile/2')
    })

    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      await user.keyboard('{Escape}')
      
      expect(input).toHaveValue('')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'))

      const user = userEvent.setup()
      render(<UserSearchBar />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Wait for error handling
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      })
    })

    it('shows no results message when search returns empty', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      })

      const user = userEvent.setup()
      render(<UserSearchBar />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'nonexistent')
      
      await waitFor(() => {
        expect(screen.getByText('No users found for "nonexistent"')).toBeInTheDocument()
      })
    })
  })
})
```

**Testing Best Practices for Navbar Components**:

1. **Mock External Dependencies**: Always mock Next.js router, localStorage, and fetch API
2. **Test Responsive Behavior**: Verify both mobile and desktop modes work correctly
3. **Accessibility Testing**: Ensure proper ARIA attributes and keyboard navigation
4. **Touch Target Validation**: Verify minimum 44px touch targets for mobile
5. **State Management**: Test component state changes and cleanup
6. **Error Handling**: Test network failures and edge cases
7. **Performance**: Test debounced search and efficient re-renders
8. **Integration**: Test interaction between navbar components

---

## Rich Text Editor Testing

### ContentEditable Component Testing

The RichTextEditor component requires specialized testing approaches due to its contentEditable nature and complex interaction patterns:

#### Race Condition Prevention Testing

**Typing Protection Tests** (`RichTextEditor.backwards-text.test.tsx`):
```typescript
describe('Race Condition Prevention', () => {
  it('prevents content corruption during rapid typing', async () => {
    const user = userEvent.setup()
    const mockOnChange = jest.fn()
    
    render(<RichTextEditor value="" onChange={mockOnChange} />)
    
    const editor = screen.getByRole('textbox')
    
    // Simulate rapid typing
    await user.type(editor, 'Hello world', { delay: 10 })
    
    // Verify content is not corrupted
    expect(editor).toHaveTextContent('Hello world')
    expect(mockOnChange).toHaveBeenCalledWith('Hello world')
  })

  it('respects typing flag during external updates', async () => {
    const { rerender } = render(
      <RichTextEditor value="initial" onChange={jest.fn()} />
    )
    
    const editor = screen.getByRole('textbox')
    
    // Start typing to set typing flag
    fireEvent.input(editor, { target: { textContent: 'typing...' } })
    
    // Attempt external update while typing
    rerender(<RichTextEditor value="external update" onChange={jest.fn()} />)
    
    // Content should not be overwritten during typing
    expect(editor).toHaveTextContent('typing...')
  })
})
```

#### Mention System Testing

**Mention Insertion Tests**:
```typescript
describe('Mention System', () => {
  it('inserts mentions using DOM range API', () => {
    const mockOnChange = jest.fn()
    const { result } = renderHook(() => useRichTextEditor({
      value: '',
      onChange: mockOnChange
    }))
    
    // Mock DOM selection
    const mockRange = {
      deleteContents: jest.fn(),
      insertNode: jest.fn(),
      setStartAfter: jest.fn(),
      collapse: jest.fn()
    }
    
    Object.defineProperty(window, 'getSelection', {
      value: () => ({ getRangeAt: () => mockRange })
    })
    
    // Test mention insertion
    result.current.insertMention('testuser', 0, 9)
    
    expect(mockRange.deleteContents).toHaveBeenCalled()
    expect(mockRange.insertNode).toHaveBeenCalled()
  })

  it('handles mention insertion failures gracefully', () => {
    // Test fallback behavior when DOM range API fails
    Object.defineProperty(window, 'getSelection', {
      value: () => { throw new Error('Selection failed') }
    })
    
    const { result } = renderHook(() => useRichTextEditor({
      value: '',
      onChange: jest.fn()
    }))
    
    // Should not throw error
    expect(() => {
      result.current.insertMention('testuser', 0, 9)
    }).not.toThrow()
  })
})
```

#### Content Analysis Testing

**Real-time Analysis Tests**:
```typescript
describe('Content Analysis Integration', () => {
  it('analyzes content in real-time', async () => {
    const user = userEvent.setup()
    const mockOnAnalysis = jest.fn()
    
    render(
      <RichTextEditor 
        value="" 
        onChange={jest.fn()} 
        onContentAnalysis={mockOnAnalysis}
      />
    )
    
    const editor = screen.getByRole('textbox')
    
    // Type short content
    await user.type(editor, 'Quick note')
    
    // Should detect spontaneous type
    expect(mockOnAnalysis).toHaveBeenCalledWith({
      type: 'spontaneous',
      wordCount: 2,
      characterCount: 10
    })
  })

  it('updates character limits based on detected type', async () => {
    const user = userEvent.setup()
    
    render(<CreatePostModal isOpen={true} onClose={jest.fn()} />)
    
    const editor = screen.getByRole('textbox')
    
    // Type long content to trigger daily type
    await user.type(editor, 'This is a longer gratitude post that should be detected as daily gratitude type')
    
    // Should show daily gratitude character limit
    expect(screen.getByText(/5000/)).toBeInTheDocument()
  })
})
```

### Testing Best Practices for Rich Text Components

1. **ContentEditable Simulation**: Use proper DOM events and selection APIs
2. **Async Behavior**: Test debounced operations and timeout cleanup
3. **Race Condition Testing**: Verify typing protection mechanisms
4. **DOM Manipulation**: Test range API usage and fallback behavior
5. **Memory Management**: Verify proper cleanup of timeouts and event listeners
6. **Cross-browser Compatibility**: Test contentEditable behavior across browsers

---

## Post Type Detection Testing

### Content Analysis Testing Strategy

Testing the post type detection system requires comprehensive coverage of classification rules and edge cases:

#### Classification Logic Tests

**Backend Content Analysis Tests** (`test_content_analysis_service.py`):
```python
class TestContentAnalysisService:
    def test_photo_post_detection(self):
        """Test photo post detection with image and no text."""
        service = ContentAnalysisService()
        result = service.analyze_content("", has_image=True)
        
        assert result["post_type"] == PostType.photo
        assert result["confidence_score"] >= 0.95
        assert result["word_count"] == 0

    def test_spontaneous_post_detection(self):
        """Test spontaneous post detection with short text."""
        service = ContentAnalysisService()
        content = "Grateful for coffee this morning!"
        result = service.analyze_content(content, has_image=False)
        
        assert result["post_type"] == PostType.spontaneous
        assert result["word_count"] < 20
        assert result["confidence_score"] >= 0.8

    def test_daily_post_detection(self):
        """Test daily post detection with longer content."""
        service = ContentAnalysisService()
        content = "Today I'm incredibly grateful for the opportunity to spend quality time with my family and reflect on all the positive moments we've shared together this week."
        result = service.analyze_content(content, has_image=False)
        
        assert result["post_type"] == PostType.daily
        assert result["word_count"] >= 20
        assert result["confidence_score"] >= 0.85

    def test_edge_case_word_threshold(self):
        """Test edge case at 20-word threshold."""
        service = ContentAnalysisService()
        # Exactly 20 words
        content = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty"
        result = service.analyze_content(content, has_image=False)
        
        # Should be classified as daily (>= 20 words)
        assert result["post_type"] == PostType.daily
```

#### Frontend Real-time Detection Tests

**CreatePostModal Analysis Tests**:
```typescript
describe('Real-time Post Type Detection', () => {
  it('detects photo post type with image upload', async () => {
    const user = userEvent.setup()
    
    render(<CreatePostModal isOpen={true} onClose={jest.fn()} />)
    
    // Upload image file
    const fileInput = screen.getByLabelText(/upload image/i)
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)
    
    // Should detect photo type
    expect(screen.getByText(/photo gratitude/i)).toBeInTheDocument()
    expect(screen.getByText(/0 characters/i)).toBeInTheDocument()
  })

  it('switches type detection based on content changes', async () => {
    const user = userEvent.setup()
    
    render(<CreatePostModal isOpen={true} onClose={jest.fn()} />)
    
    const editor = screen.getByRole('textbox')
    
    // Start with short content (spontaneous)
    await user.type(editor, 'Quick note')
    expect(screen.getByText(/spontaneous/i)).toBeInTheDocument()
    
    // Add more content (daily)
    await user.type(editor, ' about how grateful I am for this beautiful day and all the wonderful opportunities it brings')
    expect(screen.getByText(/daily gratitude/i)).toBeInTheDocument()
  })

  it('shows appropriate character limits for each type', async () => {
    const user = userEvent.setup()
    
    render(<CreatePostModal isOpen={true} onClose={jest.fn()} />)
    
    const editor = screen.getByRole('textbox')
    
    // Spontaneous type
    await user.type(editor, 'Short')
    expect(screen.getByText(/200/)).toBeInTheDocument()
    
    // Clear and type longer content for daily type
    await user.clear(editor)
    await user.type(editor, 'This is a much longer piece of content that should trigger daily gratitude detection')
    expect(screen.getByText(/5000/)).toBeInTheDocument()
  })
})
```

### Testing Best Practices for Content Analysis

1. **Boundary Testing**: Test edge cases at word count thresholds
2. **Real-time Updates**: Verify analysis updates as content changes
3. **Performance Testing**: Ensure analysis doesn't impact typing performance
4. **Character Limit Validation**: Test enforcement of type-specific limits
5. **Confidence Scoring**: Validate confidence calculations for edge cases
6. **Cross-platform Consistency**: Ensure same results on frontend and backend

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
## Mob
ile Testing Guidelines

### Mobile Testing Strategy

Mobile testing is critical for the Grateful platform as the majority of users access social features through mobile devices. All social interaction components must be thoroughly tested on actual mobile devices and responsive breakpoints.

#### Mobile Testing Categories

**1. Responsive Design Testing**
- Test all breakpoints: 320px, 375px, 414px, 768px, 1024px, 1280px
- Verify component layout adaptation across screen sizes
- Test orientation changes (portrait/landscape)
- Validate touch target sizes (minimum 44px × 44px)

**2. Touch Interaction Testing**
- Test all interactive elements with touch gestures
- Verify touch feedback and visual states
- Test gesture recognition (tap, long press, swipe)
- Validate scroll behavior and momentum scrolling

**3. Performance Testing on Mobile**
- Test loading times on 3G/4G networks
- Verify smooth animations and transitions (60fps)
- Test memory usage and battery impact
- Validate image loading and optimization

**4. Cross-Browser Mobile Testing**
- iOS Safari (latest 2 versions)
- Android Chrome (latest 2 versions)
- Mobile Firefox (latest version)
- Samsung Internet (latest version)

### Device Testing Matrix

#### Required Test Devices

**iOS Devices**:
- iPhone SE (small screen testing)
- iPhone 12/13/14 (standard screen testing)
- iPhone 12/13/14 Plus (large screen testing)
- iPad (tablet testing)

**Android Devices**:
- Samsung Galaxy S21/S22 (standard Android)
- Google Pixel 6/7 (pure Android)
- OnePlus or similar (alternative Android)
- Android tablet (tablet testing)

#### Browser Testing Requirements

**iOS Safari Testing**:
```bash
# Enable Safari Web Inspector for iOS device testing
# Connect device via USB and enable Web Inspector in Safari settings
# Access via Safari > Develop > [Device Name] > [Page]
```

**Android Chrome Testing**:
```bash
# Enable USB debugging and Chrome remote debugging
# Access via chrome://inspect/#devices in desktop Chrome
# Select device and inspect target page
```

### Mobile Testing Procedures

#### 1. Component-Level Mobile Testing

**Touch Target Validation**:
```typescript
// Example mobile component test
describe('Mobile EmojiPicker', () => {
  it('has proper touch targets on mobile', () => {
    render(<EmojiPicker isOpen={true} />)
    
    const emojiButtons = screen.getAllByRole('button')
    emojiButtons.forEach(button => {
      const styles = window.getComputedStyle(button)
      const width = parseInt(styles.width)
      const height = parseInt(styles.height)
      
      expect(width).toBeGreaterThanOrEqual(44)
      expect(height).toBeGreaterThanOrEqual(44)
    })
  })

  it('handles touch events correctly', async () => {
    const onEmojiSelect = jest.fn()
    render(<EmojiPicker isOpen={true} onEmojiSelect={onEmojiSelect} />)
    
    const emojiButton = screen.getByRole('button', { name: /heart eyes/i })
    
    // Simulate touch events
    fireEvent.touchStart(emojiButton)
    fireEvent.touchEnd(emojiButton)
    
    expect(onEmojiSelect).toHaveBeenCalledWith('heart_eyes')
  })
})
```

**Responsive Layout Testing**:
```typescript
describe('Mobile PostCard', () => {
  it('adapts layout for mobile screens', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })
    
    render(<PostCard post={mockPost} />)
    
    const postCard = screen.getByTestId('post-card')
    expect(postCard).toHaveClass('mobile-layout')
  })

  it('handles long content on mobile', () => {
    const longPost = {
      ...mockPost,
      content: 'Very long content that should wrap properly on mobile devices without causing horizontal scrolling issues'
    }
    
    render(<PostCard post={longPost} />)
    
    const content = screen.getByText(longPost.content)
    const styles = window.getComputedStyle(content)
    expect(styles.wordWrap).toBe('break-word')
  })
})
```

#### 2. Modal and Overlay Testing

**Mobile Modal Behavior**:
```typescript
describe('Mobile ShareModal', () => {
  it('adapts to mobile viewport', () => {
    // Mock mobile viewport
    global.innerWidth = 375
    global.innerHeight = 667
    
    render(<ShareModal isOpen={true} post={mockPost} />)
    
    const modal = screen.getByRole('dialog')
    const styles = window.getComputedStyle(modal)
    
    // Should be full-screen on mobile
    expect(styles.width).toBe('100vw')
    expect(styles.height).toBe('100vh')
  })

  it('prevents body scroll when open', () => {
    render(<ShareModal isOpen={true} post={mockPost} />)
    
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('handles touch-to-close', () => {
    const onClose = jest.fn()
    render(<ShareModal isOpen={true} onClose={onClose} post={mockPost} />)
    
    const backdrop = screen.getByTestId('modal-backdrop')
    fireEvent.touchStart(backdrop)
    fireEvent.touchEnd(backdrop)
    
    expect(onClose).toHaveBeenCalled()
  })
})
```

#### 3. Performance Testing on Mobile

**Loading Performance Tests**:
```typescript
describe('Mobile Performance', () => {
  it('loads feed quickly on mobile', async () => {
    const startTime = performance.now()
    
    render(<FeedPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId('feed-container')).toBeInTheDocument()
    })
    
    const loadTime = performance.now() - startTime
    expect(loadTime).toBeLessThan(2000) // 2 second max load time
  })

  it('handles large lists efficiently', () => {
    const largeFeed = Array.from({ length: 100 }, (_, i) => ({
      id: `post-${i}`,
      content: `Post content ${i}`,
      author: { name: `User ${i}` }
    }))
    
    const { container } = render(<Feed posts={largeFeed} />)
    
    // Should use virtual scrolling for large lists
    const visiblePosts = container.querySelectorAll('[data-testid="post-card"]')
    expect(visiblePosts.length).toBeLessThan(20) // Only render visible items
  })
})
```

#### 4. Touch Gesture Testing

**Swipe and Gesture Recognition**:
```typescript
describe('Mobile Gestures', () => {
  it('handles swipe gestures on notifications', () => {
    const onDismiss = jest.fn()
    render(<NotificationItem notification={mockNotification} onDismiss={onDismiss} />)
    
    const notification = screen.getByTestId('notification-item')
    
    // Simulate swipe left gesture
    fireEvent.touchStart(notification, {
      touches: [{ clientX: 100, clientY: 50 }]
    })
    fireEvent.touchMove(notification, {
      touches: [{ clientX: 50, clientY: 50 }]
    })
    fireEvent.touchEnd(notification, {
      changedTouches: [{ clientX: 20, clientY: 50 }]
    })
    
    expect(onDismiss).toHaveBeenCalled()
  })

  it('handles long press for context menu', async () => {
    const onContextMenu = jest.fn()
    render(<PostCard post={mockPost} onContextMenu={onContextMenu} />)
    
    const postCard = screen.getByTestId('post-card')
    
    // Simulate long press (touch and hold)
    fireEvent.touchStart(postCard)
    
    await new Promise(resolve => setTimeout(resolve, 500)) // 500ms hold
    
    fireEvent.touchEnd(postCard)
    
    expect(onContextMenu).toHaveBeenCalled()
  })
})
```

### Mobile Testing Commands

#### Local Mobile Testing Setup

**Start Development Server for Mobile Testing**:
```bash
# Backend - accessible on local network
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend - accessible on local network
cd apps/web
npm run dev -- --host 0.0.0.0 --port 3000

# Find your local IP address
ip addr show | grep "inet " | grep -v 127.0.0.1
# or on macOS: ifconfig | grep "inet " | grep -v 127.0.0.1

# Access from mobile device: http://[your-local-ip]:3000
```

#### Mobile Testing with Browser DevTools

**Chrome DevTools Mobile Simulation**:
```bash
# Open Chrome DevTools
# Press F12 or Ctrl+Shift+I (Cmd+Opt+I on Mac)
# Click device toolbar icon or press Ctrl+Shift+M (Cmd+Shift+M on Mac)
# Select device presets or set custom dimensions

# Test common mobile breakpoints:
# iPhone SE: 375x667
# iPhone 12: 390x844
# iPhone 12 Pro Max: 428x926
# Samsung Galaxy S20: 360x800
# iPad: 768x1024
```

**Firefox Responsive Design Mode**:
```bash
# Open Firefox Developer Tools
# Press F12 or Ctrl+Shift+I (Cmd+Opt+I on Mac)
# Click responsive design mode icon or press Ctrl+Shift+M (Cmd+Opt+M on Mac)
# Test various device presets and orientations
```

#### Automated Mobile Testing

**Playwright Mobile Testing**:
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
})

// mobile.spec.ts
test('mobile navigation works correctly', async ({ page }) => {
  await page.goto('/')
  
  // Test mobile menu
  await page.click('[data-testid="mobile-menu-button"]')
  await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
  
  // Test touch interactions
  await page.tap('[data-testid="post-like-button"]')
  await expect(page.locator('[data-testid="like-count"]')).toContainText('1')
})
```

#### Performance Testing on Mobile

**Lighthouse Mobile Testing**:
```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run mobile performance audit
lighthouse http://localhost:3000 \
  --emulated-form-factor=mobile \
  --throttling-method=simulate \
  --output=html \
  --output-path=./mobile-audit.html

# Run specific mobile metrics
lighthouse http://localhost:3000 \
  --only-categories=performance \
  --emulated-form-factor=mobile \
  --preset=perf
```

**WebPageTest Mobile Testing**:
```bash
# Use WebPageTest API for mobile testing
curl -X POST "https://www.webpagetest.org/runtest.php" \
  -d "url=http://your-app.com" \
  -d "location=Dulles_MotoG4:Moto G4 - Chrome" \
  -d "runs=3" \
  -d "fvonly=1"
```

### Mobile Testing Checklist

#### Pre-Testing Setup
- [ ] Development server accessible on local network (`--host 0.0.0.0`)
- [ ] Mobile devices connected to same WiFi network
- [ ] Browser developer tools configured for mobile simulation
- [ ] Test data prepared for various screen sizes

#### Component Testing
- [ ] All interactive elements have minimum 44px touch targets
- [ ] Touch feedback is immediate and visible
- [ ] Modals adapt properly to mobile viewports
- [ ] Text is readable without zooming (minimum 16px font size)
- [ ] Images scale properly and don't cause horizontal scrolling

#### Interaction Testing
- [ ] Tap interactions work correctly (no double-tap zoom issues)
- [ ] Swipe gestures function as expected
- [ ] Long press actions are responsive
- [ ] Keyboard appearance doesn't break layout
- [ ] Form inputs are accessible and properly sized

#### Performance Testing
- [ ] Page load time under 3 seconds on 3G
- [ ] Smooth scrolling performance (60fps)
- [ ] No memory leaks during extended usage
- [ ] Battery usage is reasonable
- [ ] Images load progressively with proper placeholders

#### Cross-Browser Testing
- [ ] iOS Safari (latest 2 versions)
- [ ] Android Chrome (latest 2 versions)
- [ ] Mobile Firefox (latest version)
- [ ] Samsung Internet (if targeting Samsung devices)

#### Accessibility Testing
- [ ] Screen reader compatibility (VoiceOver, TalkBack)
- [ ] Keyboard navigation works with external keyboards
- [ ] Color contrast meets WCAG 2.1 AA standards
- [ ] Focus indicators are visible and properly managed

### Mobile Testing Best Practices

#### Test Early and Often
- Include mobile testing in every development cycle
- Test on actual devices, not just simulators
- Use a variety of device sizes and capabilities
- Test both portrait and landscape orientations

#### Performance Considerations
- Test on slower devices and networks
- Monitor memory usage during testing
- Validate image optimization and lazy loading
- Test offline functionality where applicable

#### User Experience Focus
- Test with real user scenarios and content
- Validate touch interactions feel natural
- Ensure error states are mobile-friendly
- Test with various content lengths and edge cases

#### Documentation and Reporting
- Document device-specific issues and workarounds
- Maintain a mobile testing matrix with results
- Report performance metrics for each tested device
- Keep screenshots of mobile layouts for regression testing

### Mobile Testing Tools and Resources

#### Browser-Based Testing
- Chrome DevTools Device Mode
- Firefox Responsive Design Mode
- Safari Web Inspector (for iOS testing)
- Edge DevTools Device Emulation

#### Physical Device Testing
- BrowserStack (cloud device testing)
- Sauce Labs (automated mobile testing)
- AWS Device Farm (real device testing)
- Local device lab setup

#### Performance Testing
- Lighthouse (mobile performance audits)
- WebPageTest (real-world mobile testing)
- GTmetrix (mobile performance analysis)
- Chrome DevTools Performance tab

#### Accessibility Testing
- axe DevTools (accessibility testing)
- WAVE (web accessibility evaluation)
- Color Contrast Analyzers
- Screen reader testing tools

This comprehensive mobile testing approach ensures that all social interaction features work seamlessly across mobile devices, providing users with an optimal experience regardless of their device or browser choice.