# Security Testing Framework

This document describes how the security test mocks work and how to write new scenario-aware mocks for comprehensive security testing.

## Overview

The security tests use a sophisticated mocking system that allows testing different authorization scenarios without hitting a real database. This ensures fast, reliable tests that can simulate various security conditions.

## Key Components

### 1. Database Initialization Prevention

The security tests prevent real database initialization by patching startup functions before the FastAPI app is imported:

```python
# Patch init_db and other startup functions BEFORE importing main
async def mock_async_noop(*args, **kwargs):
    return None

patch_init_db = patch("app.core.database.init_db", new=mock_async_noop)
patch_uptime_start = patch("app.core.uptime_monitoring.uptime_monitor.start_monitoring", new=mock_async_noop)
patch_uptime_stop = patch("app.core.uptime_monitoring.uptime_monitor.stop_monitoring", new=mock_async_noop)
```

### 2. Dependency Override

The `get_db` dependency is overridden to provide a mock database session:

```python
async def mock_get_db():
    mock_session = AsyncMock()
    yield mock_session

app.dependency_overrides[get_db] = mock_get_db
```

### 3. Scenario-Aware Repository Mocks

The core innovation is scenario-aware mocks that return different results based on input parameters:

#### Post Repository Mock

```python
async def scenario_aware_get_post(post_id: str, *args, **kwargs):
    # Simulate non-existent posts
    if post_id in ["999", "nonexistent", "missing"]:
        raise NotFoundError("Post", str(post_id))
    
    # Simulate posts owned by different users
    if post_id == "not_owned" or post_id.startswith("other_"):
        return Mock(id=post_id, author_id=999, content="Other user's post")
    
    # Default: post owned by test user (123)
    return Mock(id=post_id, author_id=123, content="Test post content", is_public=True)
```

#### User Repository Mock

```python
async def scenario_aware_get_user(user_id, *args, **kwargs):
    if str(user_id) == "999" or str(user_id) == "notfound":
        raise NotFoundError("User", str(user_id))
    
    # Return different users based on ID
    if str(user_id) == "123":
        return Mock(id=123, username="testuser", email="test@example.com")
    elif str(user_id) == "456":
        return Mock(id=456, username="otheruser", email="other@example.com")
    else:
        return Mock(id=int(user_id), username=f"user{user_id}", email=f"user{user_id}@example.com")
```

## Test Scenarios

### Authorization Testing

The mocks support these key authorization scenarios:

1. **Resource Not Found (404)**
   - Use post_id="999" or user_id="999"
   - Mock raises `NotFoundError`
   - Endpoint should return 404

2. **Permission Denied (403)**
   - Use post_id="not_owned" 
   - Mock returns resource owned by different user (author_id=999)
   - Endpoint should return 403 when current user (123) tries to access

3. **Authorized Access (200)**
   - Use any other post_id
   - Mock returns resource owned by current user (author_id=123)
   - Endpoint should return 200

### Example Test Cases

```python
# Test cases that the updated mocks must satisfy
post_id = "999" → simulate 404 → endpoint returns 404
post_id = "not_owned" → return post with author_id != current_user_id → endpoint returns 403
post_id = "owned" → return post.author_id == current_user_id → endpoint returns 200 and performs operations
```

## Available Fixtures

### `client`
Basic test client with standard mocks. Use for tests that don't need complex authorization scenarios.

### `client_with_scenario_mocks`
Advanced test client with scenario-aware mocks. Use for authorization and privilege escalation tests.

```python
@pytest.mark.asyncio
async def test_vertical_privilege_escalation(self, client_with_scenario_mocks: TestClient, auth_headers: dict):
    # This will get 404 because post_id="999" triggers NotFoundError
    response = client_with_scenario_mocks.delete("/api/v1/posts/999", headers=auth_headers)
    assert response.status_code == 404
    
    # This will get 403 because post_id="not_owned" returns post with different author_id
    response = client_with_scenario_mocks.delete("/api/v1/posts/not_owned", headers=auth_headers)
    assert response.status_code == 403
```

## Writing New Scenario-Aware Mocks

When adding new endpoints or repositories, follow this pattern:

1. **Identify the scenarios you need to test**
   - Not found (404)
   - Permission denied (403)
   - Authorized access (200)
   - Any special business logic conditions

2. **Create scenario-aware mock functions**
   ```python
   async def scenario_aware_get_resource(resource_id, *args, **kwargs):
       # Handle not found cases
       if resource_id in ["999", "notfound"]:
           raise NotFoundError("Resource", str(resource_id))
       
       # Handle permission denied cases
       if resource_id.startswith("other_"):
           return Mock(id=resource_id, owner_id=999)  # Different owner
       
       # Handle authorized access
       return Mock(id=resource_id, owner_id=123)  # Current user owns it
   ```

3. **Apply the mock to the repository class**
   ```python
   mock_repo.get_by_id_or_404 = scenario_aware_get_resource
   mock_repo_class.return_value = mock_repo
   ```

4. **Use appropriate test data in your tests**
   ```python
   # Test not found
   response = client.get("/api/v1/resources/999")
   assert response.status_code == 404
   
   # Test permission denied
   response = client.delete("/api/v1/resources/other_123")
   assert response.status_code == 403
   
   # Test authorized access
   response = client.get("/api/v1/resources/owned_123")
   assert response.status_code == 200
   ```

## Best Practices

1. **Use the correct exception types**
   - `NotFoundError` for 404 responses
   - `PermissionDeniedError` for 403 responses (if your endpoint uses it)
   - Standard HTTP exceptions for other cases

2. **Keep mock objects simple**
   - Use `Mock()` instead of `AsyncMock()` for data objects
   - Only mock the attributes your endpoint actually uses
   - Avoid circular references that cause JSON serialization issues

3. **Test the authorization logic, not the business logic**
   - Focus on whether the right user can access the right resources
   - Don't test complex business rules in security tests
   - Keep security tests fast and focused

4. **Use descriptive test data**
   - Use meaningful IDs like "not_owned", "missing", "private_post"
   - Make it clear what scenario each test case is exercising

## Troubleshooting

### Common Issues

1. **500 errors instead of 404/403**
   - Check that your mock is raising the correct exception type
   - Ensure the exception matches what the repository actually raises

2. **Recursion errors in JSON encoding**
   - Use `Mock()` instead of `AsyncMock()` for data objects
   - Avoid circular references in mock objects

3. **Async mock warnings**
   - Make sure async functions return actual values, not AsyncMock objects
   - Use `AsyncMock()` for methods, `Mock()` for data

4. **Tests still hitting real database**
   - Ensure patches are applied before importing the main app
   - Check that all database-related startup code is patched

## Performance Considerations

The scenario-aware mocking system provides several performance benefits:

1. **No real database connections** - Tests run entirely in memory
2. **Deterministic behavior** - Same inputs always produce same outputs
3. **Fast execution** - No I/O operations or network calls
4. **Parallel execution** - Tests can run concurrently without conflicts

## Security Test Categories

The framework supports testing these security categories:

1. **Authentication** - Token validation, expiration, tampering
2. **Authorization** - Resource access, privilege escalation, IDOR
3. **Input Validation** - XSS, SQL injection, command injection
4. **Session Management** - Token replay, hijacking, fixation
5. **Rate Limiting** - Brute force protection, DoS prevention

Each category uses the appropriate mocking strategy to simulate real-world attack scenarios without compromising security or performance.