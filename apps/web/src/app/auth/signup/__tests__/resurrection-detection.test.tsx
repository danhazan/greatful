import { render, screen, waitFor, fireEvent } from '@/tests/utils/testUtils'
import { jest } from '@jest/globals'
import SignupPage from '../page'

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ reloadUser: jest.fn(), user: null }),
}))

jest.mock('@/hooks/useAuthRedirect', () => ({
  usePostLoginRedirect: () => ({ redirectTo: '/feed', clearRedirect: jest.fn() }),
}))

// auth mock provided by testUtils

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

function fillValidForm(usernameInput: HTMLElement, emailInput: HTMLElement, passwordInput: HTMLElement, confirmPasswordInput: HTMLElement) {
  fireEvent.change(usernameInput, { target: { value: 'testuser' } })
  fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
  fireEvent.change(passwordInput, { target: { value: 'password123' } })
  fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
}

describe('Signup Page Field Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('shows no error while typing in an untouched username field', () => {
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'ab' } })
    expect(screen.queryByText(/Username must be between/i)).not.toBeInTheDocument()
  })

  it('shows username error after blur', () => {
    render(<SignupPage />)
    const input = screen.getByLabelText(/username/i)
    fireEvent.change(input, { target: { value: 'ab' } })
    fireEvent.blur(input)
    expect(screen.getByText(/Username must be between 3 and 30 characters/i)).toBeInTheDocument()
  })

  it('clears username error immediately after correcting a touched field', () => {
    render(<SignupPage />)
    const input = screen.getByLabelText(/username/i)
    fireEvent.change(input, { target: { value: 'ab' } })
    fireEvent.blur(input)
    expect(screen.getByText(/Username must be between/i)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'validuser' } })
    expect(screen.queryByText(/Username must be between/i)).not.toBeInTheDocument()
  })

  it('shows no error while typing in an untouched email field', () => {
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'notanemail' } })
    expect(screen.queryByText(/Email address is invalid/i)).not.toBeInTheDocument()
  })

  it('shows email error after blur', () => {
    render(<SignupPage />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: 'notanemail' } })
    fireEvent.blur(input)
    expect(screen.getByText(/Email address is invalid/i)).toBeInTheDocument()
  })

  it('clears email error immediately after correcting a touched field', () => {
    render(<SignupPage />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: 'notanemail' } })
    fireEvent.blur(input)
    expect(screen.getByText(/Email address is invalid/i)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'valid@example.com' } })
    expect(screen.queryByText(/Email address is invalid/i)).not.toBeInTheDocument()
  })

  it('shows no error while typing in an untouched password field', () => {
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'short' } })
    expect(screen.queryByText(/Password must be at least 8 characters/i)).not.toBeInTheDocument()
  })

  it('blur on empty fields shows no errors', () => {
    render(<SignupPage />)
    const usernameInput = screen.getByLabelText(/username/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)

    fireEvent.focus(usernameInput)
    fireEvent.blur(usernameInput)
    expect(screen.queryByText(/Username must be between/i)).not.toBeInTheDocument()

    fireEvent.focus(emailInput)
    fireEvent.blur(emailInput)
    expect(screen.queryByText(/Email address is invalid/i)).not.toBeInTheDocument()

    fireEvent.focus(passwordInput)
    fireEvent.blur(passwordInput)
    expect(screen.queryByText(/Password must be at least 8 characters/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()

    fireEvent.focus(confirmInput)
    fireEvent.blur(confirmInput)
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()
  })

  it('password blur alone does not validate', () => {
    render(<SignupPage />)
    const input = screen.getByLabelText(/^password/i)
    fireEvent.change(input, { target: { value: 'short' } })
    fireEvent.blur(input)
    expect(screen.queryByText(/Password must be at least 8 characters/i)).not.toBeInTheDocument()
  })

  it('confirmPassword blur validates password strength and confirmation', () => {
    render(<SignupPage />)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)
    fireEvent.change(passwordInput, { target: { value: 'short' } })
    fireEvent.change(confirmInput, { target: { value: 'different' } })
    fireEvent.blur(confirmInput)
    expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument()
    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()
  })

  it('shows no mismatch error while typing confirmPassword untouched', () => {
    render(<SignupPage />)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'different' } })
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()
  })

  it('shows password mismatch after both fields are touched', () => {
    render(<SignupPage />)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'different' } })
    fireEvent.blur(passwordInput)
    fireEvent.blur(confirmInput)
    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()
  })

  it('revalidates confirmPassword when password changes and confirmPassword is blurred', () => {
    render(<SignupPage />)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'password123' } })
    fireEvent.blur(confirmInput)
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()

    fireEvent.change(passwordInput, { target: { value: 'password456' } })
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Password must be at least/i)).not.toBeInTheDocument()

    fireEvent.blur(confirmInput)
    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()

    fireEvent.change(confirmInput, { target: { value: 'password456' } })
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()

    fireEvent.blur(confirmInput)
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()
  })

  it('shows all validation errors on submit with empty fields', async () => {
    render(<SignupPage />)
    const submitButton = screen.getByText('Create Account')
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText(/Username must be between 3 and 30/i)).toBeInTheDocument()
      expect(screen.getByText(/Email address is invalid/i)).toBeInTheDocument()
      expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument()
    })
  })

  function mockSignupFetch(response: Partial<Response>) {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && (url.includes('/auth/signup') || url.includes('/auth/login'))) {
        return Promise.resolve(response as Response)
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    })
    return mockFetch
  }

  it('shows backend error in banner on API failure', async () => {
    mockSignupFetch({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Username already exists' }),
    })

    render(<SignupPage />)
    const usernameInput = screen.getByLabelText(/username/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByText('Create Account')

    fillValidForm(usernameInput, emailInput, passwordInput, confirmPasswordInput)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument()
    })
  })

  it('submits successfully with valid data and normal auth response', async () => {
    mockSignupFetch({
      ok: true,
      json: async () => ({
        access_token: 'test-token',
        token_type: 'bearer',
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      }),
    })

    render(<SignupPage />)
    const usernameInput = screen.getByLabelText(/username/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByText('Create Account')

    fillValidForm(usernameInput, emailInput, passwordInput, confirmPasswordInput)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.queryByText(/Network error/)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'test-token')
    })
  })

  it('submits normalized email with whitespace', async () => {
    let requestBody: any = null
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/auth/signup')) {
        return Promise.resolve({
          ok: true,
          json: async () => { requestBody = null; return { ok: true } },
        } as Response)
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    })

    render(<SignupPage />)
    const usernameInput = screen.getByLabelText(/username/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByText('Create Account')

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(emailInput, { target: { value: '  User@Example.com  ' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    const call = mockFetch.mock.calls.find(([url]) =>
      typeof url === 'string' && url.includes('/auth/signup')
    )
    expect(call).toBeDefined()
    if (call) {
      const body = JSON.parse((call[1] as any).body as string)
      expect(body.email).toBe('User@Example.com')
    }
  })
})

describe('Signup Page Resurrection Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('opens ResurrectionDialog on 409 with resurrection_available', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && (url.includes('/auth/signup') || url.includes('/auth/login'))) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            type: 'resurrection_available',
            code: 'resurrection_available',
            message: 'An account with this email was previously deleted.',
          }),
        } as Response)
      }
      return Promise.resolve({ ok: false, json: async () => ({}) } as Response)
    })

    render(<SignupPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByText('Create Account')

    fillValidForm(usernameInput, emailInput, passwordInput, confirmPasswordInput)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/We found a deleted account/i)).toBeInTheDocument()
    })
  })
})
