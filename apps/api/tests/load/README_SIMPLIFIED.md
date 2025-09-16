# Simplified Load Testing Strategy

## Philosophy

Load tests should be **environment-appropriate**:

- **Development**: Light smoke tests (5 users, 3 requests) - verify functionality works under minimal load
- **Staging**: Medium load tests (20 users, 10 requests) - catch performance regressions  
- **Production**: Full load tests (100+ users, 20+ requests) - validate production capacity

## Development Load Tests

### Purpose
- ✅ Verify JWT authentication works under concurrent load
- ✅ Catch obvious performance regressions
- ✅ Ensure endpoints don't crash under light concurrency
- ✅ Fast feedback loop for developers

### Configuration
```python
# Development (default)
concurrent_users = 5
requests_per_user = 3
timeout = 15s
max_connections = 10

# Total: 15 requests over ~5 seconds
```

### What We Test
1. **Authentication** - JWT tokens work correctly
2. **Basic concurrency** - No crashes under light load
3. **Response times** - Reasonable performance (< 1s avg)
4. **Error rates** - < 20% failure rate acceptable

### What We Don't Test in Dev
- ❌ High concurrency (50+ users)
- ❌ Database connection exhaustion
- ❌ Memory pressure under load
- ❌ Production-level performance benchmarks

## Running Load Tests

### Quick Test (Recommended for Dev)
```bash
# Start server
uvicorn main:app --reload

# Run simplified load tests
ENVIRONMENT=development pytest tests/load/ -v -k "not stress"
```

### Full Load Test (CI/Staging)
```bash
# Set environment for higher load
ENVIRONMENT=staging pytest tests/load/ -v
```

### Stress Test (Production Only)
```bash
# Maximum load configuration
ENVIRONMENT=production pytest tests/load/ -v --stress
```

## Benefits of This Approach

### For Developers
- ✅ **Fast feedback** - Tests complete in seconds, not minutes
- ✅ **Reliable** - Don't fail due to resource constraints
- ✅ **Relevant** - Catch real issues without noise
- ✅ **Practical** - Can run on laptop without dedicated server

### For CI/CD
- ✅ **Scalable** - Different test levels for different environments
- ✅ **Stable** - Consistent results across environments
- ✅ **Efficient** - Don't waste resources on inappropriate tests

### For Production
- ✅ **Realistic** - Full load tests run in production-like environment
- ✅ **Meaningful** - Results actually reflect production capacity
- ✅ **Safe** - Development tests don't mask production issues

## Implementation

The load test configuration automatically scales based on `ENVIRONMENT`:

```python
def get_load_test_config():
    environment = os.getenv("ENVIRONMENT", "development")
    
    if environment == "production":
        return {"concurrent_users": 100, "requests_per_user": 20}
    elif environment == "staging": 
        return {"concurrent_users": 20, "requests_per_user": 10}
    else:  # development
        return {"concurrent_users": 5, "requests_per_user": 3}
```

## Alternative: Skip Load Tests in Development

If even simplified load tests are too much overhead, we can:

```python
@pytest.mark.skipif(
    os.getenv("ENVIRONMENT") == "development",
    reason="Load tests skipped in development - run in staging/production"
)
def test_high_load_scenario():
    # Only runs in staging/production
    pass
```

## Recommendation

**Use the simplified approach** - it provides the right balance of:
- ✅ Catching authentication issues (our original problem)
- ✅ Basic performance validation  
- ✅ Fast developer feedback
- ✅ Environment-appropriate testing

This way, developers get quick feedback on functionality while CI/staging environments can run more comprehensive load tests.