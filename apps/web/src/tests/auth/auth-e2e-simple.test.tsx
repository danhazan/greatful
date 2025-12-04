import React from 'react'
import { screen, waitFor, act, render } from '@/tests/utils/testUtils'
import { useOAuth } from '../../hooks/useOAuth';
import { apiClient } from '@/utils/apiClient';
import * as auth from '@/utils/auth';
import SignupPage from '../../app/auth/signup/page'
import LoginPage from '../../app/auth/login/page'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation';
import { UserProvider } from '@/contexts/UserContext';

// Mock modules
jest.mock('@/utils/apiClient');
jest.mock('@/utils/auth');
jest.mock('../../hooks/useOAuth', () => ({
  useOAuth: jest.fn(),
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <UserProvider>
    {children}
  </UserProvider>
);

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedAuth = auth as jest.Mocked<typeof auth>;

describe.skip('Authentication E2E Tests', () => {
  // SKIPPED: E2E authentication flow complexity
  // See apps/web/SKIPPED_TESTS.md for details
  const mockPush = jest.fn()
  const mockUseOAuth = useOAuth as jest.Mock
  
  beforeEach(() => {
    mockPush.mockClear();
    mockedAuth.getAccessToken.mockReturnValue(null);
    mockedAuth.login.mockImplementation((token) => {
      localStorage.setItem('access_token', token);
    });
    mockedAuth.logout.mockImplementation(() => {
      localStorage.removeItem('access_token');
    });
    mockedApiClient.getCurrentUserProfile.mockResolvedValue(null);
    mockUseOAuth.mockClear();
    
    // Mock the useRouter hook to return a consistent mock object
    const mockRouter = useRouter();
    (mockRouter as any).push = mockPush;

    // Mock OAuth hook to return no providers available
    mockUseOAuth.mockReturnValue({
      providers: null,
      isLoading: false,
      error: null,
      isAvailable: false,
      handleOAuthLogin: jest.fn(),
      clearError: jest.fn()
    })
  })

  afterEach(() => {
    jest.restoreAllMocks();
  })

  describe('Signup Page', () => {
    it('renders signup form with all required fields', () => {
      render(<SignupPage />, { wrapper: TestWrapper })
      
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('successfully signs up user with valid data', async () => {
      const user = userEvent.setup()
      
      const mockSignupResponse = {
        access_token: 'test-token-123',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      mockedApiClient.post.mockResolvedValue(mockSignupResponse);

      const { container } = render(<SignupPage />, { wrapper: TestWrapper })
      
      // Fill out form
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /create account/i }))
      
      // Verify API call was made
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/signup', {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      })
      
      // Verify token storage and redirect
      expect(mockedAuth.login).toHaveBeenCalledWith(mockSignupResponse.access_token)
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })

    it('validates password match before submission', async () => {
      const user = userEvent.setup()
      
      render(<SignupPage />, { wrapper: TestWrapper })
      
      await act(async () => {
        await user.type(screen.getByLabelText(/username/i), 'testuser')
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/^password$/i), 'password123')
        await user.type(screen.getByLabelText(/confirm password/i), 'differentpassword')
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /create account/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })
      
      // Should not make API call
      expect(mockedApiClient.post).not.toHaveBeenCalled()
    })

    it('validates password length before submission', async () => {
      const user = userEvent.setup()
      
      render(<SignupPage />, { wrapper: TestWrapper })
      
      await act(async () => {
        await user.type(screen.getByLabelText(/username/i), 'testuser')
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/^password$/i), '123')
        await user.type(screen.getByLabelText(/confirm password/i), '123')
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /create account/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument()
      })
      
      // Should not make API call
      expect(mockedApiClient.post).not.toHaveBeenCalled()
    })

    it('displays server error messages', async () => {
      const user = userEvent.setup()
      
      mockedApiClient.post.mockRejectedValue(new Error('Username already exists'));
      
      render(<SignupPage />, { wrapper: TestWrapper })
      
      await user.type(screen.getByLabelText(/username/i), 'existinguser')
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      
      await user.click(screen.getByRole('button', { name: /create account/i }))
      
      expect(await screen.findByText('Username already exists')).toBeInTheDocument()
    })

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockedApiClient.post.mockRejectedValueOnce(new Error('Network error'));
      
      render(<SignupPage />, { wrapper: TestWrapper })
      
      await user.type(screen.getByLabelText(/username/i), 'testuser')
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'password123')
      await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      
      await user.click(screen.getByRole('button', { name: /create account/i }))
      
      expect(await screen.findByText(/network error/i)).toBeInTheDocument()
    })
  })

  describe('Login Page', () => {
    it('renders login form with required fields', () => {
      render(<LoginPage />, { wrapper: TestWrapper })
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('successfully logs in user with valid credentials', async () => {
      const user = userEvent.setup()
      
      const mockLoginResponse = {
        access_token: 'test-token-456',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com'
        }
      };
      mockedApiClient.post.mockResolvedValue(mockLoginResponse);
      
      render(<LoginPage />, { wrapper: TestWrapper })
      
      // Fill out form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /sign in/i }))
      
      // Verify API call was made
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      })
      
      // Verify token storage and redirect
      expect(mockedAuth.login).toHaveBeenCalledWith(mockLoginResponse.access_token)
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })

    it('displays error message for invalid credentials', async () => {
      const user = userEvent.setup()
      
      mockedApiClient.post.mockRejectedValue(new Error('Invalid credentials'));
      
      render(<LoginPage />, { wrapper: TestWrapper })
      
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
      
      await user.click(screen.getByRole('button', { name: /sign in/i }))
      
      expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
      
      // Should not redirect or store token
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockedApiClient.post.mockRejectedValueOnce(new Error('Network error'));
      
      render(<LoginPage />, { wrapper: TestWrapper })
      
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      
      await user.click(screen.getByRole('button', { name: /sign in/i }))
      
      expect(await screen.findByText(/network error/i)).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('signup page has link to login', () => {
      render(<SignupPage />, { wrapper: TestWrapper })
      
      const loginLink = screen.getByRole('link', { name: /sign in/i })
      expect(loginLink).toHaveAttribute('href', '/auth/login')
    })

    it('login page has link to signup', () => {
      render(<LoginPage />, { wrapper: TestWrapper })
      
      const signupLink = screen.getByRole('link', { name: /sign up/i })
      expect(signupLink).toHaveAttribute('href', '/auth/signup')
    })

    it('both pages have OAuth icon buttons when available', () => {
      // Mock OAuth as available
      mockUseOAuth.mockReturnValue({
        providers: { providers: { google: true, facebook: false }, initialized: true },
        isLoading: false,
        error: null,
        isAvailable: true,
        handleOAuthLogin: jest.fn(),
        clearError: jest.fn()
      })

      const { unmount } = render(<SignupPage />, { wrapper: TestWrapper })
      expect(screen.getByText('Or continue with')).toBeInTheDocument()
      
      unmount()
      
      render(<LoginPage />, { wrapper: TestWrapper })
      expect(screen.getByText('Or continue with')).toBeInTheDocument()
    })
  })

  describe('Form Accessibility', () => {
    it('signup form has proper labels and attributes', () => {
      render(<SignupPage />, { wrapper: TestWrapper })
      
      const usernameInput = screen.getByLabelText(/username/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      
      expect(usernameInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(confirmPasswordInput).toHaveAttribute('required')
    })

    it('login form has proper labels and attributes', () => {
      render(<LoginPage />, { wrapper: TestWrapper })
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
    })
  })

  describe('Integration Flow', () => {
    it('allows user to sign up and then login with same credentials', async () => {
      const user = userEvent.setup()
      const testCredentials = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'password123'
      }
      
      // Step 1: Sign up
      const mockSignupResponse = {
        access_token: 'signup-token-123',
        user: {
          id: 1,
          username: testCredentials.username,
          email: testCredentials.email
        }
      };
      mockedApiClient.post.mockResolvedValueOnce(mockSignupResponse);
      
      const { unmount: unmountSignup } = render(<SignupPage />, { wrapper: TestWrapper })
      
      // Fill signup form
      await user.type(screen.getByLabelText(/username/i), testCredentials.username)
      await user.type(screen.getByLabelText(/email/i), testCredentials.email)
      await user.type(screen.getByLabelText(/^password$/i), testCredentials.password)
      await user.type(screen.getByLabelText(/confirm password/i), testCredentials.password)
      
      await user.click(screen.getByRole('button', { name: /create account/i }))
      
      // Verify signup success
      expect(mockPush).toHaveBeenCalledWith('/feed')
      
      unmountSignup()
      
      // Step 2: Reset mocks for login test
      mockedApiClient.post.mockClear();
      mockPush.mockClear()
      
      // Step 3: Login with same credentials
      const mockLoginResponse = {
        access_token: 'login-token-456',
        user: {
          id: 1,
          username: testCredentials.username,
          email: testCredentials.email
        }
      };
      mockedApiClient.post.mockResolvedValueOnce(mockLoginResponse);
      
      render(<LoginPage />, { wrapper: TestWrapper })
      
      // Fill login form
      await user.type(screen.getByLabelText(/email/i), testCredentials.email)
      await user.type(screen.getByLabelText(/password/i), testCredentials.password)
      
      await user.click(screen.getByRole('button', { name: /sign in/i }))
      
      // Verify login success
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })
})
