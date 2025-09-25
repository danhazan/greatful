# Code Quality Guidelines

## Import Management

**CRITICAL**: Always avoid duplicate imports in files. Each import statement should appear only once at the top of the file.

### Common Import Patterns

**React/Testing Files:**
```typescript
// ✅ CORRECT - Single imports
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from '@jest/globals'

// ❌ WRONG - Duplicate imports
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
```

**Backend Python Files:**
```python
# ✅ CORRECT - Grouped imports
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException
from app.models.user import User

# ❌ WRONG - Scattered imports
from typing import Any
from app.core.service_base import BaseService
from typing import Dict
from app.models.user import User
from typing import List
```

**General Rules:**
- Import each module/function only once
- Group related imports together (standard library, third-party, local)
- Use destructuring for multiple exports from the same module
- Remove unused imports
- Follow PEP 8 import ordering for Python files

### Before Creating/Modifying Files:
1. Check existing imports
2. Consolidate duplicate imports
3. Remove unused imports
4. Follow consistent import ordering

This prevents build errors and maintains clean, readable code.

## Service Layer Architecture

### Service Class Standards

All service classes must follow the established service layer architecture:

#### 1. **Inherit from BaseService**
```python
# ✅ CORRECT
from app.core.service_base import BaseService

class UserService(BaseService):
    def __init__(self, db: AsyncSession):
        super().__init__(db)
```

#### 2. **Use Standardized Error Handling**
```python
# ✅ CORRECT - Use custom exceptions
from app.core.exceptions import NotFoundError, ValidationException, ConflictError

async def get_user_profile(self, user_id: int):
    user = await self.get_by_id_or_404(User, user_id, "User")
    return user

# ❌ WRONG - Generic exceptions
async def get_user_profile(self, user_id: int):
    user = await self.get_by_id(User, user_id)
    if not user:
        raise Exception("User not found")  # Don't do this
```

#### 3. **Implement Proper Validation**
```python
# ✅ CORRECT - Use BaseService validation methods
async def create_user(self, user_data: Dict[str, Any]):
    self.validate_required_fields(user_data, ["username", "email", "password"])
    self.validate_field_length(user_data["username"], "username", max_length=50)
    await self.check_unique_constraint(User, "email", user_data["email"])
    
    return await self.create_entity(User, **user_data)

# ❌ WRONG - Manual validation without standards
async def create_user(self, user_data: Dict[str, Any]):
    if not user_data.get("username"):
        raise Exception("Username required")  # Don't do this
```

### Repository Pattern Standards

When implementing repositories, follow the established patterns:

#### 1. **Inherit from BaseRepository**
```python
# ✅ CORRECT
from app.core.repository_base import BaseRepository

class UserRepository(BaseRepository):
    def __init__(self, db: AsyncSession):
        super().__init__(db, User)
```

#### 2. **Use Query Builder Pattern**
```python
# ✅ CORRECT - Use repository query builder
async def get_users_with_posts(self, limit: int = 20):
    return await self.query()\
        .load_relationships('posts')\
        .order_by(User.created_at.desc())\
        .limit(limit)\
        .build()

# ❌ WRONG - Raw SQLAlchemy queries in service layer
async def get_users_with_posts(self, limit: int = 20):
    query = select(User).options(selectinload(User.posts)).limit(limit)
    result = await self.db.execute(query)
    return result.scalars().all()
```

## API Endpoint Standards

### 1. **Thin Controllers**
Keep API endpoints focused only on HTTP concerns:

```python
# ✅ CORRECT - Thin controller
@router.post("/users", status_code=201)
async def create_user(
    user: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create new user."""
    user_service = UserService(db)
    result = await user_service.create_user(**user.dict())
    return success_response(result, getattr(request.state, 'request_id', None))

# ❌ WRONG - Business logic in controller
@router.post("/users", status_code=201)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # Don't put validation and business logic here
    if not user.email:
        raise HTTPException(400, "Email required")
    
    existing = await db.execute(select(User).where(User.email == user.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already exists")
    
    new_user = User(**user.dict())
    db.add(new_user)
    await db.commit()
    return new_user
```

### 2. **Standardized Responses**
Always use the standardized response functions:

```python
# ✅ CORRECT - Use standardized responses
from app.core.responses import success_response, error_response, paginated_response

return success_response(data, request_id)
return paginated_response(items, total_count, limit, offset, request_id)

# ❌ WRONG - Custom response formats
return {"data": data, "status": "ok"}  # Don't do this
return JSONResponse(content={"result": data})  # Don't do this
```

### 3. **Proper Error Handling**
Let middleware handle errors automatically:

```python
# ✅ CORRECT - Raise custom exceptions, let middleware handle
async def get_user(user_id: int):
    user = await user_service.get_user_by_id(user_id)
    if not user:
        raise NotFoundError("User", str(user_id))  # Middleware will format this
    return success_response(user, request_id)

# ❌ WRONG - Manual error response formatting
async def get_user(user_id: int):
    user = await user_service.get_user_by_id(user_id)
    if not user:
        return JSONResponse(
            status_code=404,
            content={"error": "User not found"}  # Don't do this
        )
```

## Exception Handling Standards

### 1. **Use Custom Exception Hierarchy**
Always use the established custom exceptions:

```python
# ✅ CORRECT - Use specific custom exceptions
from app.core.exceptions import (
    NotFoundError,           # 404 - Resource not found
    ValidationException,     # 422 - Input validation errors
    ConflictError,          # 409 - Resource conflicts
    PermissionDeniedError,  # 403 - Permission errors
    AuthenticationError,    # 401 - Authentication errors
    BusinessLogicError,     # 400 - Business rule violations
    RateLimitError         # 429 - Rate limiting
)

# Specific usage examples
raise NotFoundError("User", str(user_id))
raise ValidationException("Invalid email format", {"email": "Must be valid email"})
raise ConflictError("Email already exists", "User")
raise PermissionDeniedError("Cannot delete other user's post", "Post", "delete")
```

### 2. **Structured Error Details**
Provide meaningful error details:

```python
# ✅ CORRECT - Structured error details
raise ValidationException(
    "Validation failed",
    {
        "username": "Must be at least 3 characters",
        "email": "Must be a valid email address"
    }
)

# ❌ WRONG - Generic error messages
raise Exception("Invalid input")  # Don't do this
```

## Type Safety and Validation

### 1. **Use Type Hints Everywhere**
```python
# ✅ CORRECT - Full type hints
from typing import Any, Dict, List, Optional

async def get_user_posts(
    self, 
    user_id: int, 
    limit: int = 20, 
    offset: int = 0
) -> tuple[List[Dict[str, Any]], int]:
    """Get user posts with pagination."""
    posts, total = await self.get_paginated(
        Post, 
        limit=limit, 
        offset=offset,
        filters={"user_id": user_id}
    )
    return posts, total

# ❌ WRONG - Missing type hints
async def get_user_posts(self, user_id, limit=20, offset=0):  # Don't do this
```

### 2. **Validate Input Data**
```python
# ✅ CORRECT - Use BaseService validation
async def update_user_profile(self, user_id: int, **kwargs) -> User:
    # Validate required fields
    self.validate_required_fields(kwargs, ["username"])
    
    # Validate field constraints
    if "username" in kwargs:
        self.validate_field_length(kwargs["username"], "username", max_length=50, min_length=3)
    
    # Check uniqueness constraints
    if "email" in kwargs:
        await self.check_unique_constraint(User, "email", kwargs["email"], exclude_id=user_id)
    
    user = await self.get_by_id_or_404(User, user_id, "User")
    return await self.update_entity(user, **kwargs)
```

## Database Operations Standards

### 1. **Use Async/Await Consistently**
```python
# ✅ CORRECT - Async operations
async def get_user_with_posts(self, user_id: int) -> Optional[User]:
    return await self.get_by_id(
        User, 
        user_id, 
        load_relationships=["posts"]
    )

# ❌ WRONG - Mixing sync/async
def get_user_with_posts(self, user_id: int):  # Don't do this
    # Sync method in async context
```

### 2. **Proper Session Management**
```python
# ✅ CORRECT - Use dependency injection
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    user_service = UserService(db)
    return await user_service.create_user(**user_data.dict())

# ❌ WRONG - Manual session management
async def create_user(user_data: UserCreate):
    async with AsyncSession() as db:  # Don't do this manually
        # Manual session handling
```

### 3. **Efficient Relationship Loading**
```python
# ✅ CORRECT - Use BaseService relationship loading
users = await self.get_by_id(
    User, 
    user_id, 
    load_relationships=["posts", "followers"]
)

# ❌ WRONG - N+1 queries
user = await self.get_by_id(User, user_id)
posts = []
for post_id in user.post_ids:  # Don't do this
    post = await self.get_by_id(Post, post_id)
    posts.append(post)
```

## Testing Standards

### 1. **Test Structure**
```python
# ✅ CORRECT - Clear test structure
async def test_create_user_success():
    """Test successful user creation."""
    # Arrange
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    
    # Act
    result = await user_service.create_user(**user_data)
    
    # Assert
    assert result.username == user_data["username"]
    assert result.email == user_data["email"]
    assert result.id is not None

async def test_create_user_duplicate_email():
    """Test user creation with duplicate email raises ConflictError."""
    # Arrange
    existing_user = await create_test_user()
    user_data = {
        "username": "newuser",
        "email": existing_user.email,  # Duplicate email
        "password": "password123"
    }
    
    # Act & Assert
    with pytest.raises(ConflictError):
        await user_service.create_user(**user_data)
```

### 2. **Use Proper Fixtures**
```python
# ✅ CORRECT - Reusable fixtures
@pytest.fixture
async def user_service(db_session):
    """Create UserService instance for testing."""
    return UserService(db_session)

@pytest.fixture
async def sample_user(db_session):
    """Create a sample user for testing."""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash="hashed_password"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user
```

## Performance Standards

### 1. **Query Optimization**
```python
# ✅ CORRECT - Efficient queries with monitoring
from app.core.performance_utils import monitor_performance

@monitor_performance
async def get_user_feed(self, user_id: int, limit: int = 20) -> List[Post]:
    """Get user feed with performance monitoring."""
    return await self.post_repo.get_feed_posts(
        user_id=user_id,
        limit=limit,
        load_relationships=["user", "reactions"]
    )

# ❌ WRONG - Unoptimized queries
async def get_user_feed(self, user_id: int, limit: int = 20):
    posts = await self.get_all_posts()  # Don't load everything
    user_posts = [p for p in posts if p.user_id == user_id]  # Don't filter in Python
    return user_posts[:limit]
```

### 2. **Use Query Monitoring**
```python
# ✅ CORRECT - Monitor complex operations
from app.core.query_monitor import QueryMonitor

async def generate_user_analytics(self, user_id: int):
    """Generate user analytics with query monitoring."""
    with QueryMonitor("user_analytics_generation"):
        # Complex analytics logic with monitoring
        stats = await self._calculate_user_stats(user_id)
        return stats
```

## Logging and Monitoring Standards

### 1. **Structured Logging**
```python
# ✅ CORRECT - Structured logging with context
import logging

logger = logging.getLogger(__name__)

async def create_user(self, **user_data):
    logger.info(
        "Creating new user",
        extra={
            "username": user_data.get("username"),
            "email": user_data.get("email"),
            "request_id": getattr(self, "request_id", None)
        }
    )
    
    user = await self.create_entity(User, **user_data)
    
    logger.info(
        "User created successfully",
        extra={
            "user_id": user.id,
            "username": user.username
        }
    )
    
    return user

# ❌ WRONG - Unstructured logging
async def create_user(self, **user_data):
    print(f"Creating user {user_data['username']}")  # Don't use print
    logger.info("User created")  # Too generic
```

### 2. **Error Context**
```python
# ✅ CORRECT - Rich error context
try:
    result = await complex_operation()
except Exception as e:
    logger.error(
        "Complex operation failed",
        extra={
            "error": str(e),
            "operation": "complex_operation",
            "user_id": user_id,
            "request_id": request_id
        },
        exc_info=True
    )
    raise DatabaseError("Operation failed", "complex_operation")
```

## Documentation Standards

### 1. **Docstring Format**
```python
# ✅ CORRECT - Comprehensive docstrings
async def get_user_posts(
    self, 
    user_id: int, 
    limit: int = 20, 
    offset: int = 0,
    include_private: bool = False
) -> tuple[List[Dict[str, Any]], int]:
    """
    Get paginated posts for a specific user.
    
    Args:
        user_id: ID of the user whose posts to retrieve
        limit: Maximum number of posts to return (default: 20)
        offset: Number of posts to skip for pagination (default: 0)
        include_private: Whether to include private posts (default: False)
        
    Returns:
        tuple: (posts_list, total_count) where posts_list contains
               post dictionaries and total_count is the total number
               of posts available
               
    Raises:
        NotFoundError: If user with given ID doesn't exist
        ValidationException: If limit or offset are invalid
        
    Example:
        posts, total = await service.get_user_posts(123, limit=10)
    """
```

### 2. **API Endpoint Documentation**
```python
# ✅ CORRECT - FastAPI documentation
@router.get("/users/{user_id}/posts", response_model=PaginatedPostResponse)
async def get_user_posts(
    user_id: int,
    limit: int = Query(20, ge=1, le=100, description="Number of posts to return"),
    offset: int = Query(0, ge=0, description="Number of posts to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated posts for a specific user.
    
    - **user_id**: ID of the user whose posts to retrieve
    - **limit**: Maximum number of posts (1-100, default: 20)
    - **offset**: Number of posts to skip for pagination (default: 0)
    
    Returns paginated list of posts with engagement data.
    Requires authentication. Private posts only visible to post owner.
    """
```

## Security Standards

### 1. **Input Sanitization**
```python
# ✅ CORRECT - Proper validation and sanitization
async def update_user_bio(self, user_id: int, bio: str) -> User:
    # Validate input
    self.validate_field_length(bio, "bio", max_length=500)
    
    # Sanitize HTML content if needed
    sanitized_bio = html.escape(bio.strip())
    
    user = await self.get_by_id_or_404(User, user_id, "User")
    return await self.update_entity(user, bio=sanitized_bio)
```

### 2. **Permission Checks**
```python
# ✅ CORRECT - Explicit permission validation
async def delete_post(self, post_id: str, user_id: int) -> bool:
    post = await self.get_by_id_or_404(Post, post_id, "Post")
    
    # Check ownership
    if post.user_id != user_id:
        raise PermissionDeniedError(
            "Cannot delete other user's post", 
            "Post", 
            "delete"
        )
    
    return await self.delete_entity(post)
```

## Code Review Checklist

Before submitting code, ensure:

### Backend (Python)
- [ ] Inherits from BaseService/BaseRepository where appropriate
- [ ] Uses custom exceptions from `app.core.exceptions`
- [ ] Implements proper type hints
- [ ] Uses standardized response functions
- [ ] Includes comprehensive docstrings
- [ ] Has corresponding unit tests
- [ ] Follows async/await patterns consistently
- [ ] Uses structured logging with context
- [ ] Validates input data properly
- [ ] Handles errors gracefully

### Frontend (TypeScript/React)
- [ ] No duplicate imports
- [ ] Proper TypeScript types
- [ ] Follows component naming conventions
- [ ] Uses proper TypeScript interfaces and types
- [ ] Includes proper error handling
- [ ] Has corresponding tests
- [ ] Follows accessibility guidelines
- [ ] Uses consistent styling patterns

### General
- [ ] Code is self-documenting with clear variable names
- [ ] No hardcoded values (use constants/config)
- [ ] Follows established patterns and conventions
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Tests cover edge cases and error scenarios