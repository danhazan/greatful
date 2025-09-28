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

The Grateful platform supports two authentication methods:
1. **Traditional Email/Password Authentication** - Standard signup and login flow
2. **OAuth 2.0 Social Authentication** - Login with Google (and Facebook support ready)

### OAuth 2.0 Social Authentication

#### OAuth Flow Architecture

```
User → Frontend → Backend → Google OAuth → Backend → Frontend → User
```

1. **User clicks "Sign in with Google"** on frontend
2. **Frontend redirects** to `/api/v1/oauth/google`
3. **Backend generates** OAuth authorization URL
4. **User authenticates** with Google
5. **Google redirects** to `/api/v1/oauth/callback/google`
6. **Backend exchanges** authorization code for tokens
7. **Backend creates/updates** user account
8. **Backend returns** JWT tokens to frontend
9. **Frontend stores** tokens and redirects to app

#### OAuth Endpoints

**Backend OAuth Endpoints**:
- `GET /api/v1/oauth/providers` - Get available OAuth providers
- `POST /api/v1/oauth/google` - Initiate Google OAuth flow
- `POST /api/v1/oauth/facebook` - Initiate Facebook OAuth flow
- `POST /api/v1/oauth/callback/{provider}` - Handle OAuth callback

**Frontend OAuth Pages**:
- `/auth/callback/google` - Google OAuth callback handler
- `/auth/callback` - Generic OAuth callback handler

#### OAuth Security Features

- **CSRF Protection**: State parameter validation
- **Secure Sessions**: HttpOnly, Secure, SameSite cookies
- **HTTPS Enforcement**: Production-only secure connections
- **CORS Restrictions**: Limited to production domains
- **Input Validation**: Pydantic models for all requests
- **Error Handling**: Comprehensive logging without exposing secrets

### Traditional Authentication

#### 1. User Signup
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

#### 2. User Login
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

### OAuth 2.0 Social Authentication

#### OAuth Flow Overview
```
Frontend → OAuth Provider → OAuth Callback → FastAPI /api/v1/oauth/callback → JWT Token
```

The OAuth flow provides secure authentication through trusted providers like Google and Facebook, eliminating the need for users to create and remember passwords.

#### Supported OAuth Providers

**Google OAuth 2.0**:
- **Provider**: Google Identity Platform
- **Scopes**: `openid email profile`
- **Features**: PKCE (Proof Key for Code Exchange) for enhanced security
- **Status**: ✅ Configured and Ready

**Facebook OAuth 2.0**:
- **Provider**: Facebook Login
- **Scopes**: `email public_profile`
- **Features**: PKCE support
- **Status**: ⚠️ Ready for configuration (credentials needed)

#### OAuth Endpoints

**Initiate OAuth Login**:
```http
GET /api/v1/oauth/{provider}/login
```

**Parameters**:
- `provider`: OAuth provider (`google` or `facebook`)
- `redirect_uri`: Optional custom redirect URI

**Response**: Redirects to OAuth provider authorization URL

**OAuth Callback Handler**:
```http
GET /api/v1/oauth/{provider}/callback
```

**Parameters**:
- `code`: Authorization code from OAuth provider
- `state`: CSRF protection state parameter

**Response**:
```json
{
  "access_token": "jwt-token-here",
  "token_type": "bearer",
  "user": {
    "id": "user123",
    "username": "john_doe",
    "email": "john@example.com",
    "name": "John Doe",
    "profile_image_url": "https://example.com/avatar.jpg",
    "oauth_provider": "google"
  }
}
```

#### OAuth Configuration

**Environment Variables**:
```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth Configuration  
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret

# OAuth Redirect URIs
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback/google
OAUTH_REDIRECT_URI_PRODUCTION=https://yourdomain.com/auth/callback/google
```

**OAuth Provider Configuration**:
```python
# apps/api/app/core/oauth_config.py

class OAuthConfig:
    def initialize_oauth(self) -> OAuth:
        """Initialize OAuth providers with security features."""
        
        # Google OAuth with PKCE
        self.oauth.register(
            name='google',
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            server_metadata_url='https://accounts.google.com/.well-known/openid_configuration',
            client_kwargs={
                'scope': 'openid email profile',
                'prompt': 'select_account',
                'code_challenge_method': 'S256',  # PKCE with SHA256
            }
        )
```

#### OAuth Security Features

**PKCE (Proof Key for Code Exchange)**:
- Generates cryptographic code verifier and challenge
- Prevents authorization code interception attacks
- Required for all OAuth flows

**State Parameter Validation**:
- CSRF protection through state parameter
- Validates state matches between request and callback
- Prevents cross-site request forgery attacks

**Token Security**:
- OAuth tokens exchanged for internal JWT tokens
- No OAuth tokens stored client-side
- Standard JWT expiration and refresh patterns

**User Data Handling**:
- Minimal data collection (email, name, profile picture)
- Automatic username generation from OAuth data
- Profile data can be updated after OAuth login

#### OAuth User Flow

**1. User Clicks "Sign in with Google"**:
```javascript
// Frontend initiates OAuth flow
window.location.href = '/api/v1/oauth/google/login'
```

**2. Redirect to Google Authorization**:
```
https://accounts.google.com/oauth/authorize?
  client_id=your-client-id&
  redirect_uri=http://localhost:3000/auth/callback/google&
  response_type=code&
  scope=openid+email+profile&
  state=random-csrf-token&
  code_challenge=pkce-challenge&
  code_challenge_method=S256
```

**3. User Authorizes Application**:
- User logs into Google account
- User grants permissions to Grateful app
- Google redirects back with authorization code

**4. OAuth Callback Processing**:
```python
# Backend processes OAuth callback
async def oauth_callback(provider: str, code: str, state: str):
    # Validate state parameter (CSRF protection)
    # Exchange code for access token using PKCE
    # Get user info from OAuth provider
    # Create or update user account
    # Generate internal JWT token
    # Return authentication response
```

**5. User Authenticated**:
- User receives JWT token
- Frontend stores token and redirects to feed
- User is logged in and can use the application

#### OAuth Error Handling

**Common OAuth Errors**:
```json
// Invalid state parameter
{
  "error": "invalid_state",
  "error_description": "State parameter validation failed"
}

// OAuth provider error
{
  "error": "access_denied", 
  "error_description": "User denied authorization"
}

// Configuration error
{
  "error": "provider_not_configured",
  "error_description": "OAuth provider is not properly configured"
}
```

**Error Recovery**:
- Graceful fallback to traditional login
- Clear error messages for users
- Comprehensive logging for debugging
- Automatic retry mechanisms where appropriate

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