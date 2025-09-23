import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import SignupPage from '../../app/auth/signup/page'
import LoginPage from '../../app/auth/login/page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('Authentication E2E Tests', () => {
  const mockPush = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
    mockLocalStorage.setItem.mockClear()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })

  describe('Signup Page', () => {
    it('renders signup form with all required fields', () => {
      render(<SignupPage />)
      
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('successfully signs up user with valid data', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            access_token: 'test-token-123',
            user: {
              id: 1,
              username: 'testuser',
              email: 'test@example.com'
            }
          }
        })
      })
      
      render(<SignupPage />)
      
      // Fill out form
      await act(async () => {
        await user.type(screen.getByLabelText(/username/i), 'testuser')
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/^password$/i), 'password123')
        await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      })
      
      // Submit form
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /create account/i }))
      })
      
      // Verify API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
          })
        })
      })
      
      // Verify token storage and redirect
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('access_token', 'test-token-123')
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })

    it('validates password match before submission', async () => {
      const user = userEvent.setup()
      
      render(<SignupPage />)
      
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
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('validates password length before submission', async () => {
      const user = userEvent.setup()
      
      render(<SignupPage />)
      
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
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('displays server error messages', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          detail: 'Username already exists'
        })
      })
      
      render(<SignupPage />)
      
      await act(async () => {
        await user.type(screen.getByLabelText(/username/i), 'existinguser')
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/^password$/i), 'password123')
        await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /create account/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument()
      })
    })

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<SignupPage />)
      
      await act(async () => {
        await user.type(screen.getByLabelText(/username/i), 'testuser')
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/^password$/i), 'password123')
        await user.type(screen.getByLabelText(/confirm password/i), 'password123')
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /create account/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Login Page', () => {
    it('renders login form with required fields', () => {
      render(<LoginPage />)
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('successfully logs in user with valid credentials', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            access_token: 'test-token-456',
            user: {
              id: 1,
              username: 'testuser',
              email: 'test@example.com'
            }
          }
        })
      })
      
      render(<LoginPage />)
      
      // Fill out form
      await act(async () => {
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
      })
      
      // Submit form
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /sign in/i }))
      })
      
      // Verify API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123'
          })
        })
      })
      
      // Verify token storage and redirect
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('access_token', 'test-token-456')
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })

    it('displays error message for invalid credentials', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          detail: 'Invalid credentials'
        })
      })
      
      render(<LoginPage />)
      
      await act(async () => {
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /sign in/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      })
      
      // Should not redirect or store token
      expect(mockPush).not.toHaveBeenCalled()
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
    })

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<LoginPage />)
      
      await act(async () => {
        await user.type(screen.getByLabelText(/email/i), 'test@example.com')
        await user.type(screen.getByLabelText(/password/i), 'password123')
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /sign in/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation Links', () => {
    it('signup page has link to login', () => {
      render(<SignupPage />)
      
      const loginLink = screen.getByRole('link', { name: /sign in/i })
      expect(loginLink).toHaveAttribute('href', '/auth/login')
    })

    it('login page has link to signup', () => {
      render(<LoginPage />)
      
      const signupLink = screen.getByRole('link', { name: /sign up/i })
      expect(signupLink).toHaveAttribute('href', '/auth/signup')
    })

    it('both pages have demo links', () => {
      const { unmount } = render(<SignupPage />)
      expect(screen.getByRole('link', { name: /view demo/i })).toHaveAttribute('href', '/demo')
      
      unmount()
      
      render(<LoginPage />)
      expect(screen.getByRole('link', { name: /view demo/i })).toHaveAttribute('href', '/demo')
    })
  })

  describe('Form Accessibility', () => {
    it('signup form has proper labels and attributes', () => {
      render(<SignupPage />)
      
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
      render(<LoginPage />)
      
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            access_token: 'signup-token-123',
            user: {
              id: 1,
              username: testCredentials.username,
              email: testCredentials.email
            }
          }
        })
      })
      
      const { unmount: unmountSignup } = render(<SignupPage />)
      
      // Fill signup form
      await act(async () => {
        await user.type(screen.getByLabelText(/username/i), testCredentials.username)
        await user.type(screen.getByLabelText(/email/i), testCredentials.email)
        await user.type(screen.getByLabelText(/^password$/i), testCredentials.password)
        await user.type(screen.getByLabelText(/confirm password/i), testCredentials.password)
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /create account/i }))
      })
      
      // Verify signup success
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/feed')
      })
      
      unmountSignup()
      
      // Step 2: Reset mocks for login test
      mockFetch.mockClear()
      mockPush.mockClear()
      
      // Step 3: Login with same credentials
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            access_token: 'login-token-456',
            user: {
              id: 1,
              username: testCredentials.username,
              email: testCredentials.email
            }
          }
        })
      })
      
      render(<LoginPage />)
      
      // Fill login form
      await act(async () => {
        await user.type(screen.getByLabelText(/email/i), testCredentials.email)
        await user.type(screen.getByLabelText(/password/i), testCredentials.password)
      })
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /sign in/i }))
      })
      
      // Verify login success
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/feed')
      })
    })
  })
})