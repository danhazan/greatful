# Authentication End-to-End Tests

This directory contains comprehensive end-to-end tests for the authentication system, covering both signup and login functionality.

## Test Files

### `auth-e2e-simple.test.tsx`
Comprehensive E2E tests covering the complete authentication flow including:

#### Signup Page Tests
- **Form Rendering**: Validates all form fields, labels, and validation attributes
- **Successful Signup**: Tests successful user registration and token handling
- **Client-side Validation**: Tests password match and length validation
- **Server Error Handling**: Tests validation errors and network failures
- **Accessibility**: Tests ARIA attributes and form labels

#### Login Page Tests
- **Form Rendering**: Validates form structure and validation attributes
- **Successful Login**: Tests successful authentication and token storage
- **Error Handling**: Tests invalid credentials and network failures
- **Accessibility**: Tests ARIA support and form compliance

#### Integration Flow Tests
- **Complete Registration Flow**: Signup → Login with same credentials
- **Cross-Form Navigation**: Navigation between login and signup pages
- **Demo Page Links**: Tests navigation to demo page
- **Token Management**: Tests token storage and retrieval

## Test Coverage

### Functional Coverage
- ✅ User registration (signup)
- ✅ User authentication (login)
- ✅ Token storage and management
- ✅ Error handling and recovery
- ✅ Form validation (client-side)
- ✅ Navigation between auth pages

### Error Scenarios
- ✅ Network failures
- ✅ Server validation errors
- ✅ Invalid credentials
- ✅ Password validation (match, length)
- ✅ Malformed API responses

### User Experience
- ✅ Form field validation
- ✅ Error message display
- ✅ Loading states (basic)
- ✅ Navigation links

### Security
- ✅ Password field masking
- ✅ Token security
- ✅ Form validation

### Accessibility
- ✅ ARIA attributes and roles
- ✅ Form labels and descriptions
- ✅ Required field indicators

## Running the Tests

### Run authentication tests:
```bash
npm test -- --testPathPattern=auth-e2e-simple
```

### Run with coverage:
```bash
npm test -- --testPathPattern=auth-e2e-simple --coverage
```

### Run in watch mode:
```bash
npm test -- --testPathPattern=auth-e2e-simple --watch
```

### Run with verbose output:
```bash
npm test -- --testPathPattern=auth-e2e-simple --verbose
```

## Test Structure

The test file follows a consistent structure:

```typescript
describe('Authentication E2E Tests', () => {
  beforeEach(() => {
    // Setup mocks and reset state
  })

  describe('Signup Page', () => {
    it('should test specific behavior', async () => {
      // Arrange: Setup test data and mocks
      // Act: Perform user actions
      // Assert: Verify expected outcomes
    })
  })
})
```

## Mocking Strategy

### Router Mocking
```typescript
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))
```

### API Mocking
```typescript
const mockFetch = jest.fn()
global.fetch = mockFetch
```

### LocalStorage Mocking
```typescript
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})
```

## Test Patterns

### User Interaction Testing
```typescript
const user = userEvent.setup()
await user.type(screen.getByLabelText(/email/i), 'test@example.com')
await user.click(screen.getByRole('button', { name: /sign in/i }))
```

### API Call Verification
```typescript
await waitFor(() => {
  expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
  })
})
```

### Error Handling Testing
```typescript
mockFetch.mockResolvedValueOnce({
  ok: false,
  json: async () => ({ detail: 'Invalid credentials' })
})

await waitFor(() => {
  expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
})
```

## Known Issues

### React act() Warnings
The tests currently show React `act()` warnings for form input state updates. These are non-blocking warnings that indicate best practices for test reliability:

```
Warning: An update to LoginPage inside a test was not wrapped in act(...)
```

**Impact**: None - tests pass and function correctly
**Cause**: `userEvent.type()` triggers state updates that should be wrapped in `act()`
**Status**: Non-blocking, scheduled for future improvement

### Future Improvements
- [ ] Wrap user interactions in `act()` to eliminate warnings
- [ ] Add loading state testing for form submissions
- [ ] Add password visibility toggle testing
- [ ] Add keyboard navigation testing
- [ ] Add form submission on Enter key testing

## Bug Prevention

These tests prevent common authentication bugs such as:

1. **Form Validation Failures**: Ensures client-side validation works correctly
2. **API Integration Issues**: Verifies proper API calls and response handling
3. **Token Management Problems**: Confirms token storage and retrieval
4. **Error Handling Failures**: Validates error message display and recovery
5. **Navigation Issues**: Ensures proper routing between auth pages
6. **Accessibility Violations**: Verifies form labels and ARIA attributes

## Test Results

Current test status:
- **Total Tests**: 16
- **Passing**: 16 (100%)
- **Failing**: 0 (0%)
- **Warnings**: React act() warnings (non-blocking)

## Contributing

When adding new authentication features:

1. Add corresponding tests to `auth-e2e-simple.test.tsx`
2. Follow the existing test structure and patterns
3. Mock all external dependencies (API calls, localStorage, router)
4. Test both success and error scenarios
5. Include accessibility testing
6. Verify tests pass before submitting

## Related Documentation

- [Test Status Documentation](../../../../docs/TESTS_STATUS.md)
- [Authentication Components](../../app/auth/)
- [API Routes](../../app/api/auth/)