# Shared Type Definitions

This directory contains comprehensive type definitions for the Social Interactions System, providing type safety and API contracts across the entire application stack.

## Structure

```
shared/types/
├── index.ts          # Main export file
├── core.ts           # Core types and enums
├── models.ts         # Database model types
├── api.ts            # API contract types
├── services.ts       # Service layer types
├── errors.ts         # Error types and hierarchies
├── validation.ts     # Validation schemas and rules
└── README.md         # This documentation
```

## Usage

### Frontend (Next.js/React)

```typescript
import { 
  PostResponse, 
  CreatePostRequest, 
  EmojiCode,
  NotificationResponse 
} from '@/shared/types'

// Use in API routes
export async function POST(request: NextRequest) {
  const body: CreatePostRequest = await request.json()
  // ... implementation
}

// Use in components
interface PostCardProps {
  post: PostResponse
  onReaction: (emoji: EmojiCode) => void
}
```

### Backend (FastAPI/Python)

```python
# Convert TypeScript types to Python equivalents
from typing import Optional, List
from pydantic import BaseModel
from enum import Enum

class PostType(str, Enum):
    DAILY = "daily"
    PHOTO = "photo"
    SPONTANEOUS = "spontaneous"

class CreatePostRequest(BaseModel):
    content: str
    post_type: PostType
    title: Optional[str] = None
    # ... other fields
```

## Type Categories

### Core Types (`core.ts`)
- Base entities and interfaces
- Enums for post types, emoji codes, notification types
- Constants for rate limits and pagination
- Utility types used across the application

### Model Types (`models.ts`)
- Database model interfaces
- Relationship definitions
- Query filter interfaces
- Pagination and sorting parameters

### API Types (`api.ts`)
- Request/response interfaces for all endpoints
- Authentication contracts
- Paginated response wrappers
- API success/error response formats

### Service Types (`services.ts`)
- Service interface definitions
- Business logic type contracts
- Configuration interfaces
- Cache and database service types

### Error Types (`errors.ts`)
- Comprehensive error hierarchies
- HTTP status code enums
- Validation error structures
- Error factory functions

### Validation Types (`validation.ts`)
- Validation schema interfaces
- Field validation rules
- Schema factory functions
- Common validation patterns

## Key Features

### Type Safety
- Ensures consistency between frontend and backend
- Prevents runtime errors through compile-time checking
- Provides IntelliSense and autocomplete support

### API Contracts
- Defines clear interfaces for all endpoints
- Standardizes request/response formats
- Enables automatic API documentation generation

### Error Handling
- Comprehensive error type system
- Consistent error response formats
- Type-safe error handling patterns

### Validation
- Reusable validation schemas
- Type-safe validation rules
- Consistent validation error formats

## Best Practices

### Naming Conventions
- Use PascalCase for interfaces and types
- Use SCREAMING_SNAKE_CASE for constants
- Use camelCase for properties
- Use descriptive, self-documenting names

### Interface Design
- Keep interfaces focused and cohesive
- Use composition over inheritance
- Prefer readonly properties where appropriate
- Include JSDoc comments for complex types

### Versioning
- Consider API versioning for breaking changes
- Use optional properties for backward compatibility
- Document breaking changes in commit messages

### Documentation
- Include JSDoc comments for public interfaces
- Provide usage examples in comments
- Document validation rules and constraints

## Integration Examples

### React Component with Types

```typescript
import { PostResponse, EmojiCode, ReactionResponse } from '@/shared/types'

interface PostCardProps {
  post: PostResponse
  onReaction: (emoji: EmojiCode) => Promise<void>
  onShare: (method: 'url' | 'message') => Promise<void>
}

export const PostCard: React.FC<PostCardProps> = ({ post, onReaction, onShare }) => {
  // Type-safe component implementation
}
```

### API Route with Types

```typescript
import { CreatePostRequest, PostResponse, ApiError } from '@/shared/types'

export async function POST(request: NextRequest): Promise<NextResponse<PostResponse | ApiError>> {
  const body: CreatePostRequest = await request.json()
  
  // Validation and processing with type safety
  
  return NextResponse.json(response)
}
```

### Service Implementation with Types

```typescript
import { ReactionServiceInterface, EmojiReaction, EmojiCode } from '@/shared/types'

class ReactionService implements ReactionServiceInterface {
  async addReaction(userId: number, postId: string, emojiCode: EmojiCode): Promise<EmojiReaction> {
    // Type-safe service implementation
  }
  
  // ... other methods
}
```

## Migration Guide

When updating types:

1. **Add new optional properties** for backward compatibility
2. **Deprecate old properties** before removing them
3. **Update all usage sites** when making breaking changes
4. **Run type checking** across frontend and backend
5. **Update API documentation** to reflect changes

## Testing

Types should be tested through:

1. **Compilation checks** - Ensure all code compiles without type errors
2. **API contract tests** - Verify request/response formats match types
3. **Validation tests** - Test validation schemas with various inputs
4. **Integration tests** - Ensure types work correctly across boundaries

## Contributing

When adding new types:

1. Follow existing naming conventions
2. Add comprehensive JSDoc comments
3. Include validation rules where appropriate
4. Update this README if adding new categories
5. Ensure types are exported from `index.ts`
6. Test types across frontend and backend usage