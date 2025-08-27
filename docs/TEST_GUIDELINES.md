# Test Guidelines and Best Practices

## Overview

This document provides guidelines for writing and organizing tests in the Grateful project. We follow a structured approach to testing with clear separation between unit, integration, and end-to-end tests.

## Current Test Status

### ✅ Backend Tests
- **Framework**: Pytest with async support
- **Status**: Fully configured and working
- **Coverage**: Unit tests for all API endpoints
- **Location**: `apps/api/tests/`

### ✅ Frontend Tests
- **Framework**: Jest with React Testing Library
- **Status**: All tests are passing.
- **Coverage**: Good coverage for components and API routes.
- **Location**: `apps/web/src/tests/`
- **Test Suites**: 17 passed, 17 total
- **Tests**: 134 passed, 14 skipped, 148 total

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

## Test Categories

### Unit Tests

**Purpose**: Test individual functions, components, or API endpoints in isolation.

**Backend Unit Tests**:
- Test service layer business logic (AuthService, UserService, ReactionService)
- Test database models and validation
- Test custom exception handling
- Test service layer validation and error handling
- Mock external dependencies and database operations

**Frontend Unit Tests**:
- Test React components in isolation
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
- Test API contract validation and response structure
- Test authentication flows with JWT middleware
- Test service layer integration with database operations
- Test notification system with batching behavior
- Use test databases with proper cleanup

**Frontend Integration Tests**:
- Test page components
- Test API route handlers
- Test component interactions
- Test form submissions

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
- Social features (likes, comments, follows)
- Profile management
- Search and discovery

**Best Practices**:
- Test real user scenarios
- Include authentication flows
- Test responsive design
- Test cross-browser compatibility

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