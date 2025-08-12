# Authentication Flow Documentation

## Overview

The Grateful project implements a complete authentication flow using JWT tokens with the frontend acting as a proxy to the FastAPI backend. This document describes the implementation, testing, and usage of the authentication system.

## Architecture

### Frontend (Next.js)
- **Role**: Acts as a proxy to the backend API
- **Authentication**: JWT tokens stored in localStorage
- **API Routes**: `/api/auth/*` routes that forward requests to FastAPI
- **Pages**: Signup, Login, and session management

### Backend (FastAPI)
- **Role**: Handles all authentication logic
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: User storage and session management
- **Endpoints**: `/api/v1/auth/*` for all auth operations

## Authentication Flow

### 1. User Signup
```
Frontend → /api/auth/signup → FastAPI /api/v1/auth/signup
```

**Frontend Route**: `apps/web/src/app/api/auth/signup/route.ts`
**Backend Endpoint**: `apps/api/app/api/v1/auth.py` (signup method)

**Request**:
```json
{
  "username": "testuser",
  "email": "test@example.com", 
  "password": "testpassword123"
}
```

**Response**:
```json
{
  "id": "user123",
  "username": "testuser",
  "email": "test@example.com"
}
```

### 2. User Login
```
Frontend → /api/auth/login → FastAPI /api/v1/auth/login
```

**Frontend Route**: `apps/web/src/app/api/auth/login/route.ts`
**Backend Endpoint**: `apps/api/app/api/v1/auth.py` (login method)

**Request**:
```json
{
  "email": "test@example.com",
  "password": "testpassword123"
}
```

**Response**:
```json
{
  "access_token": "jwt-token-here",
  "token_type": "bearer"
}
```

### 3. Session Validation
```
Frontend → /api/auth/session → FastAPI /api/v1/auth/session
```

**Frontend Route**: `apps/web/src/app/api/auth/session/route.ts`
**Backend Endpoint**: `apps/api/app/api/v1/auth.py` (get_session method)

**Headers**:
```
Authorization: Bearer jwt-token-here
```

**Response**:
```json
{
  "id": "user123",
  "email": "test@example.com",
  "username": "testuser"
}
```

### 4. User Logout
```
Frontend → /api/auth/logout → FastAPI /api/v1/auth/logout
```

**Frontend Route**: `apps/web/src/app/api/auth/logout/route.ts`
**Backend Endpoint**: `apps/api/app/api/v1/auth.py` (logout method)

**Headers**:
```
Authorization: Bearer jwt-token-here
```

**Response**:
```json
{
  "message": "Logged out (client should delete token)"
}
```

## Frontend Implementation

### API Route Structure
```
apps/web/src/app/api/auth/
├── signup/route.ts      # User registration
├── login/route.ts       # User login
├── session/route.ts     # Session validation
└── logout/route.ts      # User logout
```

### Common Pattern
All frontend API routes follow this pattern:
1. Extract request data
2. Validate backend URL configuration
3. Forward request to FastAPI backend
4. Return backend response with proper status codes

### Environment Configuration
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Backend Implementation

### Authentication Endpoints
```python
# apps/api/app/api/v1/auth.py

@router.post("/signup", response_model=UserOut)
async def signup(user_in: UserCreate, db: AsyncSession = Depends(get_db))

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db))

@router.get("/session")
async def get_session(request: Request, db: AsyncSession = Depends(get_db))

@router.post("/logout")
async def logout()
```

### Security Features
- **Password Hashing**: bcrypt with salt
- **JWT Tokens**: HS256 algorithm with configurable expiration
- **Token Validation**: Automatic validation on protected endpoints
- **Error Handling**: Comprehensive error responses

## Testing

### Test Coverage
The authentication flow is thoroughly tested with integration tests:

**Test File**: `apps/web/src/tests/integration/auth-flow.test.ts`

### Test Scenarios
1. **Complete Flow**: signup → login → session → logout
2. **Error Handling**: Invalid credentials, missing tokens, configuration errors
3. **Edge Cases**: Duplicate emails, invalid tokens, missing backend URL

### Test Results
```
✓ Complete authentication flow: signup → login → session → logout
✓ Handle signup with existing email
✓ Handle login with invalid credentials  
✓ Handle session check without token
✓ Handle session check with invalid token
✓ Handle missing backend URL configuration
```

## Usage Examples

### Frontend Usage
```typescript
// Signup
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, email, password })
})

// Login
const response = await fetch('/api/auth/login', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})

// Check session
const response = await fetch('/api/auth/session', {
  headers: { 'Authorization': `Bearer ${token}` }
})

// Logout
const response = await fetch('/api/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
})
```

### Backend Direct Usage
```bash
# Signup
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Check session
curl -X GET http://localhost:8000/api/v1/auth/session \
  -H "Authorization: Bearer your-jwt-token"

# Logout
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer your-jwt-token"
```

## Security Considerations

### Frontend Security
- JWT tokens stored in localStorage (consider httpOnly cookies for production)
- All sensitive requests proxied through backend
- No sensitive data stored in frontend state

### Backend Security
- Passwords hashed with bcrypt
- JWT tokens with expiration
- Input validation on all endpoints
- Proper error handling without information leakage

### Production Recommendations
1. Use HTTPS in production
2. Implement refresh tokens
3. Add rate limiting
4. Use httpOnly cookies for token storage
5. Implement proper CORS configuration
6. Add request logging and monitoring

## Error Handling

### Common Error Responses
```json
// Invalid credentials
{
  "detail": "Invalid credentials"
}

// Email already registered
{
  "detail": "Email already registered"
}

// Missing authorization
{
  "error": "No valid authorization header"
}

// Invalid token
{
  "detail": "Invalid token"
}

// Backend configuration error
{
  "error": "Backend URL not configured"
}
```

## Configuration

### Environment Variables
```env
# Frontend (.env)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend (.env)
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

## Monitoring and Debugging

### Frontend Debugging
- Check browser network tab for API calls
- Verify localStorage for token storage
- Check console for error messages

### Backend Debugging
- Check FastAPI logs for request/response
- Verify database connections
- Monitor JWT token validation

---

*Last updated: [Current Date]* 