# Type Sync Checklist

This document provides a step-by-step process for maintaining type synchronization between TypeScript (frontend) and Python (backend) definitions.

## 🎯 Overview

Our type safety approach uses **manual synchronization** between TypeScript and Python types. This checklist ensures consistency and catches drift between frontend and backend contracts.

## 📋 When to Use This Checklist

- Adding new API endpoints
- Modifying existing API request/response structures
- Adding new database models
- Changing enum values or constants
- Updating validation rules

## 🔄 Step-by-Step Sync Process

### Step 1: Update TypeScript Types First

1. **Modify TypeScript interfaces** in `shared/types/`
   - Update relevant files: `core.ts`, `api.ts`, `models.ts`, etc.
   - Follow existing naming conventions (camelCase for properties)
   - Add JSDoc comments for new fields

2. **Update validation guards** in `shared/types/validation.ts`
   - Add/update type guard functions for new/modified types
   - Ensure runtime validation matches TypeScript interface
   - Test validation guards with sample data

3. **Update examples** in `shared/types/examples/`
   - Update usage examples to reflect changes
   - Ensure examples compile without errors

### Step 2: Sync Python Backend Types

1. **Update Pydantic models** in `shared/types/python/models.py`
   - Mirror TypeScript interface changes
   - Use snake_case for field names (Python convention)
   - Add field validation constraints matching TypeScript guards

2. **Update backend API endpoints** to use new models
   - Import updated models: `from shared.types.python.models import *`
   - Update endpoint signatures to use new request/response models
   - Ensure Pydantic validation is applied: `return ResponseModel(**data)`

3. **Update backend enums and constants**
   - Sync enum values with TypeScript enums
   - Update validation logic to use new enum values
   - Ensure error messages reference correct values

### Step 3: Verification Steps

#### 3.1 Compile-Time Verification

```bash
# Verify TypeScript types compile
cd apps/web && npm run type-check

# Verify shared types compile
cd shared/types && npx tsc --noEmit

# Verify Python types (if using mypy)
cd apps/api && python -m mypy app/
```

#### 3.2 Runtime Validation Testing

```bash
# Test validation guards
cd shared/types && npm test

# Test backend validation
cd apps/api && python -m pytest tests/unit/test_validation.py -v
```

#### 3.3 Integration Testing

```bash
# Run API contract tests
cd apps/web && npm test -- tests/integration/api-contracts.test.ts

# Run backend integration tests
cd apps/api && python -m pytest tests/integration/ -v
```

### Step 4: Integration Test Requirements

#### 4.1 Frontend Integration Tests

Create/update tests in `apps/web/src/tests/integration/api-contracts.test.ts`:

```typescript
describe('API Contract Validation', () => {
  test('POST /api/posts validates response structure', async () => {
    const response = await fetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify(validPostData)
    })
    
    const data = await response.json()
    expect(validatePostResponse(data)).toBe(true)
  })
})
```

#### 4.2 Backend Integration Tests

Create/update tests in `apps/api/tests/integration/test_api_contracts.py`:

```python
def test_create_post_response_structure():
    response = client.post("/api/v1/posts/", json=valid_post_data)
    assert response.status_code == 201
    
    # Pydantic validation ensures response matches PostResponse model
    post_data = PostResponse(**response.json())
    assert post_data.id is not None
```

## ✅ Verification Checklist

Before considering sync complete, verify:

- [ ] **TypeScript Compilation**: All TypeScript code compiles without errors
- [ ] **Python Type Checking**: Backend passes type checking (if using mypy)
- [ ] **Validation Guards**: All type guards pass with sample data
- [ ] **Unit Tests**: All validation unit tests pass
- [ ] **Integration Tests**: API contract tests pass
- [ ] **Backend Tests**: All backend tests pass
- [ ] **Frontend Tests**: All frontend tests pass
- [ ] **Manual Testing**: Key user flows work end-to-end

## 🚨 Common Pitfalls to Avoid

### 1. Naming Convention Mismatches
- **TypeScript**: Use `camelCase` (e.g., `userId`, `createdAt`)
- **Python**: Use `snake_case` (e.g., `user_id`, `created_at`)
- **API**: Ensure transformations happen at boundaries

### 2. Optional Field Handling
- **TypeScript**: Use `field?: type` or `field: type | null`
- **Python**: Use `field: Optional[type] = None`
- **Validation**: Handle both `undefined` and `null` in guards

### 3. Enum Value Synchronization
- Keep enum values identical between TypeScript and Python
- Update validation logic when adding/removing enum values
- Test edge cases with invalid enum values

### 4. Date/Time Handling
- **TypeScript**: Use `string` with ISO format
- **Python**: Use `datetime` with proper serialization
- **Validation**: Ensure date strings are valid ISO format

### 5. Array and Object Validation
- Validate nested objects and arrays recursively
- Handle empty arrays and null values correctly
- Test with various data structures

## 🔧 Tools and Utilities

### Type Guard Testing Utility

```typescript
// shared/types/test-utils.ts
export function testTypeGuard<T>(
  guard: (data: any) => data is T,
  validSamples: any[],
  invalidSamples: any[]
) {
  validSamples.forEach(sample => {
    expect(guard(sample)).toBe(true)
  })
  
  invalidSamples.forEach(sample => {
    expect(guard(sample)).toBe(false)
  })
}
```

### Python Model Testing Utility

```python
# shared/types/python/test_utils.py
def test_pydantic_model(model_class, valid_data, invalid_data):
    # Test valid data
    for data in valid_data:
        instance = model_class(**data)
        assert instance is not None
    
    # Test invalid data
    for data in invalid_data:
        with pytest.raises(ValidationError):
            model_class(**data)
```

## 📊 Sync Status Tracking

Keep track of sync status for major types:

| Type | TypeScript | Python | Validation Guards | Tests | Status |
|------|------------|--------|-------------------|-------|--------|
| User | ✅ | ✅ | ✅ | ✅ | ✅ Synced |
| Post | ✅ | ✅ | ✅ | ✅ | ✅ Synced |
| Reaction | ✅ | ✅ | ✅ | ✅ | ✅ Synced |
| Notification | ✅ | ✅ | ✅ | ⚠️ | ⚠️ Needs Tests |

## 🎯 Success Criteria

Type sync is successful when:

1. **Zero Type Errors**: All TypeScript and Python code compiles/validates
2. **Runtime Safety**: Type guards catch invalid data at runtime
3. **Test Coverage**: Integration tests validate actual API contracts
4. **Documentation**: Changes are documented and examples updated
5. **Team Confidence**: Developers can modify types without fear of breaking changes

## 🚀 Automation Opportunities

Consider automating these checks:

- **Pre-commit hooks**: Run type checking before commits
- **CI/CD pipeline**: Run full validation suite on pull requests
- **Type drift detection**: Compare TypeScript and Python models
- **Documentation generation**: Auto-generate API docs from types

## 📞 Getting Help

If you encounter issues during sync:

1. **Check existing examples** in `shared/types/examples/`
2. **Run validation tests** to identify specific issues
3. **Review recent changes** that might have introduced drift
4. **Ask team members** who recently worked on similar types
5. **Update this checklist** if you discover new patterns or issues