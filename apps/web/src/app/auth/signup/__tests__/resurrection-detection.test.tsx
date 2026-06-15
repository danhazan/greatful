import React from 'react'
import { render, screen, waitFor, fireEvent } from '@/tests/utils/testUtils'
import { jest } from '@jest/globals'

const mockPush = jest.fn()

jest.mock('next/navigation', () => {
  const m = require('@/tests/mocks/nextNavigationMock')
  return {
    ...m.mockNavigation,
    useRouter: () => m.createMockRouter({ push: mockPush }),
  }
})

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ reloadUser: jest.fn(), user: null }),
}))

jest.mock('@/hooks/useAuthRedirect', () => ({
  usePostLoginRedirect: () => ({ redirectTo: '/feed', clearRedirect: jest.fn() }),
}))

jest.mock('@/utils/auth', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  getAccessToken: jest.fn(),
}))

jest.mock('@/hooks/useOAuth', () => ({
  useOAuth: () => ({
    providers: null,
    isLoading: false,
    error: null,
    isAvailable: false,
    handleOAuthLogin: jest.fn(),
    clearError: jest.fn(),
  }),
}))

describe('Signup Page Resurrection Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('opens ResurrectionDialog on 409 with resurrection_available', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        type: 'resurrection_available',
        code: 'resurrection_available',
        message: 'An account with this email was previously deleted.',
      }),
    } as Response)

    const SignupPage = (await import('../page')).default
    render(<SignupPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByText('Create Account')

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/We found a deleted account/i)).toBeInTheDocument()
    })
  })
})
