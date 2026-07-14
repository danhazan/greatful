import { render, screen, waitFor, fireEvent } from '@/tests/utils/testUtils'
import ForgotPasswordPage from '../page'

function mockResetFetch() {
  global.fetch = jest.fn()
}

describe('Forgot Password Validation', () => {
  beforeEach(() => {
    mockResetFetch()
  })

  it('shows no error while typing an invalid email', () => {
    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: 'notanemail' } })
    expect(screen.queryByText(/Email address is invalid/i)).not.toBeInTheDocument()
  })

  it('shows email error after blur with invalid email', () => {
    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: 'notanemail' } })
    fireEvent.blur(input)
    expect(screen.getByText(/Email address is invalid/i)).toBeInTheDocument()
  })

  it('clears email error after correcting', () => {
    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: 'notanemail' } })
    fireEvent.blur(input)
    expect(screen.getByText(/Email address is invalid/i)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'valid@example.com' } })
    expect(screen.queryByText(/Email address is invalid/i)).not.toBeInTheDocument()
  })

  it('does NOT submit API call when email is invalid', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    const submitButton = screen.getByText('Send Reset Link')

    fireEvent.change(input, { target: { value: 'invalid' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Email address is invalid/i)).toBeInTheDocument()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('submits with valid email', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Reset link sent' }),
    } as Response)

    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    const submitButton = screen.getByText('Send Reset Link')

    fireEvent.change(input, { target: { value: 'user@example.com' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body)
    expect(callBody.email).toBe('user@example.com')
    await waitFor(() => {
      expect(screen.getByText(/reset link has been sent/i)).toBeInTheDocument()
    })
  })

  it('shows backend error in banner', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'This account uses social login' }),
    } as Response)

    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    const submitButton = screen.getByText('Send Reset Link')

    fireEvent.change(input, { target: { value: 'user@example.com' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/This account uses social login/i)).toBeInTheDocument()
    })
  })

  it('shows network error in banner', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockRejectedValue(new Error('Network failure'))

    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    const submitButton = screen.getByText('Send Reset Link')

    fireEvent.change(input, { target: { value: 'user@example.com' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })
  })

  it('blur on empty email shows no error', () => {
    render(<ForgotPasswordPage />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(screen.queryByText(/Email address is invalid/i)).not.toBeInTheDocument()
  })
})
