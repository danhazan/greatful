# Service Layer Architecture

## Overview

The Grateful backend follows a clean service layer architecture that separates business logic from API endpoints and database operations. This architecture provides better maintainability, testability, and code organization.

## Architecture Layers

```
┌─────────────────────────────────────────┐
│           API Endpoints (FastAPI)       │  ← Thin controllers, handle HTTP concerns
├─────────────────────────────────────────┤
│           Service Layer                 │  ← Business logic, validation, orchestration
├─────────────────────────────────────────┤
│           Database Models               │  ← SQLAlchemy models, database schema
├─────────────────────────────────────────┤
│           Database (PostgreSQL)         │  ← Data persistence
└─────────────────────────────────────────┘
```

## Core Components

### 1. BaseService (`app/core/service_base.py`)

**Purpose**: Provides common CRUD operations and validation patterns for all services.

**Key Features**:
- Generic CRUD operations (`get_by_id`, `create_entity`, `update_entity`, `delete_entity`)
- Pagination support (`get_paginated`)
- Validation helpers (`validate_required_fields`, `validate_field_length`)
- Unique constraint checking (`check_unique_constraint`)
- Proper error handling with custom exceptions

**Example Usage**:
```python
class UserService(BaseService):
    async def get_user_profile(self, user_id: int) -> Dict[str, any]:
        user = await self.get_by_id_or_404(User, user_id, "User")
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
```

### 2. Custom Exceptions (`app/core/exceptions.py`)

**Purpose**: Standardized error handling with proper HTTP status codes and structured error messages.

**Exception Hierarchy**:
- `BaseAPIException` - Base class for all API exceptions
- `ValidationException` - Input validation errors (422)
- `NotFoundError` - Resource not found errors (404)
- `ConflictError` - Resource conflict errors (409)
- `PermissionDeniedError` - Permission errors (403)
- `AuthenticationError` - Authentication errors (401)
- `RateLimitError` - Rate limiting errors (429)
- `BusinessLogicError` - Business rule violations (400)

**Example Usage**:
```python
# In service layer
if not user:
    raise NotFoundError("User", str(user_id))

# Results in standardized error response
{
    "success": false,
    "error": {
        "code": "not_found",
        "message": "User not found with id: 123",
        "details": {"resource": "User", "id": "123"}
    },
    "timestamp": "2025-08-27T10:30:00Z",
    "request_id": "uuid-here"
}
```

### 3. Standardized Responses (`app/core/responses.py`)

**Purpose**: Consistent API response formatting across all endpoints.

**Response Types**:
- `ApiSuccessResponse` - Successful operations
- `ApiErrorResponse` - Error responses
- `PaginatedResponse` - Paginated data responses

**Response Structure**:
```python
# Success Response
{
    "success": true,
    "data": { ... },
    "timestamp": "2025-08-27T10:30:00Z",
    "request_id": "uuid-here"
}

# Error Response
{
    "success": false,
    "error": {
        "code": "validation_error",
        "message": "Validation failed",
        "details": { ... }
    },
    "timestamp": "2025-08-27T10:30:00Z",
    "request_id": "uuid-here"
}
```

### 4. Middleware (`app/core/middleware.py`)

**Purpose**: Cross-cutting concerns like error handling, request validation, and logging.

**Middleware Components**:
- `ErrorHandlingMiddleware` - Catches exceptions and formats error responses
- `RequestValidationMiddleware` - Logs requests and responses with request IDs

**Features**:
- Automatic request ID generation
- Structured logging with context
- Consistent error response formatting
- Request/response timing and logging

### 5. Dependencies (`app/core/dependencies.py`)

**Purpose**: Common FastAPI dependencies for authentication and request handling.

**Key Dependencies**:
- `get_current_user_id` - Extract user ID from JWT token
- Proper error handling for invalid tokens
- Consistent authentication patterns

## Service Classes

### AuthService (`app/services/auth_service.py`)

**Responsibilities**:
- User registration and validation
- User authentication and token generation
- Token validation and user session management
- Password hashing and verification

**Key Methods**:
- `signup(username, email, password)` - Create new user account
- `login(email, password)` - Authenticate user and return token
- `get_user_from_token(token)` - Validate token and return user info
- `logout()` - Logout user (placeholder for token blacklisting)

### UserService (`app/services/user_service.py`)

**Responsibilities**:
- User profile management
- User posts retrieval with engagement data
- Public vs private profile handling
- User statistics and metadata

**Key Methods**:
- `get_user_profile(user_id)` - Get complete user profile with stats
- `get_public_user_profile(user_id)` - Get public profile (no email)
- `update_user_profile(user_id, **kwargs)` - Update profile with validation
- `get_user_posts(user_id, current_user_id, public_only)` - Get posts with engagement

### ReactionService (`app/services/reaction_service.py`)

**Responsibilities**:
- Emoji reaction management
- Reaction validation and business rules
- Notification integration for reactions
- Reaction statistics and aggregation

**Key Methods**:
- `add_reaction(user_id, post_id, emoji_code)` - Add/update reaction
- `remove_reaction(user_id, post_id)` - Remove user's reaction
- `get_post_reactions(post_id)` - Get all reactions for a post
- `get_reaction_counts(post_id)` - Get reaction statistics

### NotificationService (`app/services/notification_service.py`)

**Responsibilities**:
- Notification creation and management
- Notification batching logic
- Rate limiting and spam prevention
- Real-time notification delivery

**Key Methods**:
- `create_emoji_reaction_notification()` - Create reaction notifications
- `get_user_notifications()` - Get paginated notifications
- `mark_as_read()` - Mark notifications as read
- `get_unread_count()` - Get unread notification count

## API Endpoint Patterns

### Thin Controllers

API endpoints are kept thin and focused on HTTP concerns:

```python
@router.post("/signup", status_code=201)
async def signup(
    user: UserCreate, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create new user."""
    auth_service = AuthService(db)
    result = await auth_service.signup(
        username=user.username,
        email=user.email,
        password=user.password
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))
```

### Consistent Error Handling

All endpoints use the same error handling patterns through middleware:

```python
# Service layer raises custom exception
if not user:
    raise NotFoundError("User", str(user_id))

# Middleware catches and formats response
# No need for try/catch in endpoints
```

### Standardized Responses

All endpoints return consistent response formats:

```python
# Success responses
return success_response(data, request_id)

# Error responses are handled by middleware
# Custom exceptions automatically formatted
```

## Benefits of This Architecture

### 1. **Separation of Concerns**
- API endpoints handle HTTP concerns only
- Business logic is contained in service classes
- Database operations are abstracted through BaseService

### 2. **Testability**
- Service classes can be tested independently
- Business logic tests don't require HTTP setup
- Clear boundaries between layers

### 3. **Maintainability**
- Consistent patterns across all services
- Common operations are reused through BaseService
- Clear error handling and validation patterns

### 4. **Type Safety**
- Full type hints throughout the codebase
- Pydantic models for request/response validation
- Generic type support in BaseService

### 5. **Error Handling**
- Consistent error responses across all endpoints
- Proper HTTP status codes for different error types
- Structured error details for debugging

### 6. **Monitoring and Debugging**
- Request IDs for tracing requests
- Structured logging with context
- Consistent error reporting

## Development Guidelines

### Adding New Services

1. **Inherit from BaseService**:
```python
class NewService(BaseService):
    def __init__(self, db: AsyncSession):
        super().__init__(db)
```

2. **Use Custom Exceptions**:
```python
if not resource:
    raise NotFoundError("Resource", str(resource_id))
```

3. **Implement Validation**:
```python
self.validate_required_fields(data, ["field1", "field2"])
self.validate_field_length(value, "field_name", max_length=100)
```

4. **Return Structured Data**:
```python
return {
    "id": resource.id,
    "name": resource.name,
    "created_at": resource.created_at.isoformat()
}
```

### Adding New Endpoints

1. **Keep Controllers Thin**:
```python
@router.post("/resource")
async def create_resource(
    data: ResourceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    service = ResourceService(db)
    result = await service.create_resource(**data.dict())
    return success_response(result, getattr(request.state, 'request_id', None))
```

2. **Use Standardized Responses**:
```python
# Success
return success_response(data, request_id)

# Let middleware handle errors automatically
```

3. **Add Proper Documentation**:
```python
@router.post("/resource", status_code=201)
async def create_resource(
    data: ResourceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new resource.
    
    - **name**: Resource name (required)
    - **description**: Resource description (optional)
    
    Returns the created resource with ID and timestamps.
    """
```

## Testing Patterns

### Service Layer Tests
```python
async def test_service_method():
    service = UserService(db_session)
    result = await service.get_user_profile(user_id)
    assert result["id"] == user_id
```

### API Integration Tests
```python
async def test_api_endpoint(async_client, auth_headers):
    response = await async_client.get("/api/v1/users/me/profile", headers=auth_headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"] is True
    assert "data" in data
```

### Error Handling Tests
```python
async def test_service_error():
    service = UserService(db_session)
    
    with pytest.raises(NotFoundError):
        await service.get_user_profile(999999)
```

This service layer architecture provides a solid foundation for building scalable, maintainable, and well-tested backend applications.