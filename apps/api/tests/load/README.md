# Load Testing with JWT Authentication

This document describes how to run load tests with proper JWT authentication, fixing the previous 401 authentication errors.

## Problem Summary

Previously, load tests were failing with 401 Unauthorized errors because they used fake tokens like `test_token_123` instead of real JWT tokens. The authentication system expected valid JWTs with proper signatures and claims.

## Solution

We've implemented a comprehensive JWT token system for load testing that:

1. **Generates real JWT tokens** using the same secret and algorithm as production
2. **Maintains security isolation** with test-specific configurations
3. **Provides debugging tools** to troubleshoot authentication issues
4. **Supports high concurrency** with pre-generated token batches

## Quick Start

### 1. Set Environment Variables

```bash
export LOAD_TESTING=true
export TESTING=true
```

### 2. Run Debug Script (Optional)

Test that JWT token generation is working:

```bash
cd apps/api
python debug_tokens.py
```

### 3. Run Simple Load Test

```bash
cd apps/api
python run_load_test.py
```

### 4. Run Full Load Test Suite

```bash
cd apps/api
pytest tests/load/ -v
```

## How It Works

### JWT Token Generation

The `app/utils/test_tokens.py` module provides utilities to generate real JWT tokens:

```python
from app.utils.test_tokens import create_access_token_for_user

# Generate token for user ID 123
token = create_access_token_for_user(123)
headers = {"Authorization": f"Bearer {token}"}
```

### Batch Token Generation

For load tests with many users, generate tokens in batches:

```python
from app.utils.test_tokens import create_token_batch

# Generate tokens for multiple users
user_ids = [1, 2, 3, 4, 5]
tokens = create_token_batch(user_ids)

# Use in load test
user_id = 1
token = tokens[user_id]
headers = {"Authorization": f"Bearer {token}"}
```

### Load Test Fixtures

Load tests now use the `load_test_tokens` fixture:

```python
@pytest.mark.asyncio
async def test_my_load_test(
    large_dataset: Dict[str, Any],
    load_test_tokens: Dict[int, str],  # Real JWT tokens
    concurrent_test_runner: ConcurrentTestRunner
):
    users = large_dataset['users']
    
    async def my_request(client: httpx.AsyncClient, user_id: int, request_id: int):
        test_user = users[user_id % len(users)]
        token = load_test_tokens[test_user.id]  # Use real JWT token
        headers = {"Authorization": f"Bearer {token}"}
        
        response = await client.get("/api/v1/posts/feed", headers=headers)
        assert response.status_code == 200
```

## Test-Only Endpoints (Optional)

When `LOAD_TESTING=true`, the API exposes test-only endpoints for token minting:

### Mint Single Token

```bash
curl -X POST http://localhost:8000/api/v1/_test/mint-token \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123}'
```

### Mint Batch Tokens

```bash
curl -X POST http://localhost:8000/api/v1/_test/mint-tokens-batch \
  -H "Content-Type: application/json" \
  -d '[1, 2, 3, 4, 5]'
```

### Debug Token

```bash
curl -X POST http://localhost:8000/api/v1/_test/debug-token \
  -H "Content-Type: application/json" \
  -d '"your-jwt-token-here"'
```

## Security Considerations

### Environment Isolation

- Test endpoints only work when `LOAD_TESTING=true`
- Use separate JWT secrets for testing (`JWT_SECRET` environment variable)
- Never enable load testing mode in production

### Token Configuration

```bash
# Test environment variables
export LOAD_TESTING=true
export TESTING=true
export JWT_SECRET=test-jwt-secret-for-load-testing
export JWT_ALGO=HS256
```

### Production Safety

- Test endpoints return 404 when `LOAD_TESTING` is not set
- JWT tokens use test-specific secrets
- No elevated privileges in test tokens

## Debugging Authentication Issues

### 1. Check Token Generation

```python
from app.utils.test_tokens import create_access_token_for_user, debug_token_info

token = create_access_token_for_user(123)
info = debug_token_info(token)
print(info)
```

### 2. Validate Token

```python
from app.utils.test_tokens import validate_test_token

try:
    payload = validate_test_token(token)
    print(f"Valid token: {payload}")
except Exception as e:
    print(f"Invalid token: {e}")
```

### 3. Check App Security

```python
from app.core.security import decode_token

try:
    payload = decode_token(token)
    print(f"App validation successful: {payload}")
except Exception as e:
    print(f"App validation failed: {e}")
```

### 4. Test Authentication Flow

```bash
# Generate token
python -c "
from app.utils.test_tokens import create_access_token_for_user
token = create_access_token_for_user(1)
print(f'Token: {token}')
"

# Test with curl
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:8000/api/v1/posts/feed?limit=5
```

## Common Issues and Solutions

### Issue: 401 Unauthorized

**Cause**: Invalid or expired token

**Solution**:
1. Check token generation: `python debug_tokens.py`
2. Verify JWT secret matches between token generation and app
3. Ensure token hasn't expired (default: 24 hours)

### Issue: Token signature invalid

**Cause**: JWT secret mismatch

**Solution**:
```bash
# Ensure same secret in both places
export JWT_SECRET=your-test-secret
export SECRET_KEY=your-test-secret  # Fallback
```

### Issue: Load test still uses fake tokens

**Cause**: Test file not updated to use `load_test_tokens` fixture

**Solution**: Update test method signature:
```python
# Before
async def test_my_load_test(large_dataset, concurrent_test_runner):

# After  
async def test_my_load_test(large_dataset, load_test_tokens, concurrent_test_runner):
```

### Issue: Clock skew errors

**Cause**: Server and test runner clocks out of sync

**Solution**: Synchronize clocks or add leeway in JWT validation

## Performance Considerations

### Token Reuse

- Generate tokens once in setup, reuse for all requests
- Use `create_token_batch()` for multiple users
- Tokens are valid for 24 hours by default

### Connection Pooling

```python
async with httpx.AsyncClient(
    base_url="http://localhost:8000",
    timeout=60.0,
    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20)
) as client:
    # Reuse client for all requests
```

### Database Connections

- Increase database connection pool size for load testing
- Use separate test database to avoid production impact

## Load Test Configuration

### Recommended Settings

```python
# Load test parameters
concurrent_users = 50      # Realistic concurrent load
requests_per_user = 10     # Requests per user session
token_expiry = 24 * 60 * 60  # 24 hours

# Performance thresholds
success_rate_threshold = 0.95    # 95% success rate
p95_response_time_ms = 500       # 500ms P95 response time
avg_response_time_ms = 200       # 200ms average response time
```

### Environment Setup

```bash
# Database
export DATABASE_URL=postgresql://user:pass@localhost/grateful_test

# JWT Configuration  
export JWT_SECRET=test-jwt-secret-for-load-testing
export JWT_ALGO=HS256

# Load Testing
export LOAD_TESTING=true
export TESTING=true

# Disable rate limiting for load tests
export RATE_LIMIT_ENABLED=false
```

## Files Changed

### New Files

- `app/utils/test_tokens.py` - JWT token utilities
- `app/api/v1/test_auth.py` - Test-only authentication endpoints
- `debug_tokens.py` - Debug script for troubleshooting
- `run_load_test.py` - Simple load test runner
- `tests/load/README.md` - This documentation

### Modified Files

- `main.py` - Added test auth router when `LOAD_TESTING=true`
- `tests/load/conftest.py` - Added `load_test_tokens` fixture
- `tests/load/test_*.py` - Updated all load tests to use real JWT tokens

## Verification Steps

After implementing these changes:

1. **Run debug script**: `python debug_tokens.py`
2. **Run simple load test**: `python run_load_test.py`  
3. **Run full test suite**: `pytest tests/load/ -v`
4. **Check for 401 errors**: Should be zero in successful tests
5. **Verify success rates**: Should be >95% for all tests

## Next Steps

1. **Monitor production**: Ensure load testing mode is never enabled
2. **Update CI/CD**: Include JWT token generation in test pipelines
3. **Scale testing**: Gradually increase concurrent users and requests
4. **Performance tuning**: Optimize based on load test results

For questions or issues, check the debug output from `debug_tokens.py` or examine the server logs for JWT validation errors.