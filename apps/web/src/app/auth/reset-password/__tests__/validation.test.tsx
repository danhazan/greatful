import { render, screen, waitFor, fireEvent, act } from '@/tests/utils/testUtils'
import { jest } from '@jest/globals'
import { ResetPasswordForm } from '../ResetPasswordForm'

beforeEach(() => {
  global.fetch = jest.fn()
})

async function renderWithToken(token: string | null = 'valid-token') {
  const view = render(<ResetPasswordForm token={token} />)
  await act(async () => {})
  return view
}

describe('Reset Password Validation', () => {
  it('shows no error while typing a short password', async () => {
    await renderWithToken()
    const input = screen.getByLabelText(/^new password/i)
    fireEvent.change(input, { target: { value: 'short' } })
    expect(screen.queryByText(/Password must be at least 8 characters/i)).not.toBeInTheDocument()
  })

  it('submit short password shows passwordError, no mismatch shown', async () => {
    await renderWithToken()
    const passwordInput = screen.getByLabelText(/^new password/i)
    const btn = screen.getByTestId('reset-submit')

    expect(btn).not.toBeDisabled()
    fireEvent.change(passwordInput, { target: { value: 'short' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()
  })

  it('submit mismatched passwords shows confirmPasswordError', async () => {
    await renderWithToken()
    const passwordInput = screen.getByLabelText(/^new password/i)
    const confirmInput = screen.getByLabelText(/confirm new password/i)
    const btn = screen.getByTestId('reset-submit')

    expect(btn).not.toBeDisabled()
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'different' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('correcting password clears both errors on typing', async () => {
    await renderWithToken()
    const passwordInput = screen.getByLabelText(/^new password/i)
    const confirmInput = screen.getByLabelText(/confirm new password/i)

    fireEvent.change(passwordInput, { target: { value: 'short' } })
    fireEvent.change(confirmInput, { target: { value: 'different' } })
    fireEvent.blur(confirmInput)
    expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument()
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()

    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    expect(screen.queryByText(/Password must be at least 8 characters/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()
  })

  it('correcting confirm password clears confirmPasswordError on typing', async () => {
    await renderWithToken()
    const passwordInput = screen.getByLabelText(/^new password/i)
    const confirmInput = screen.getByLabelText(/confirm new password/i)

    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'mismatch' } })
    fireEvent.blur(confirmInput)
    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()

    fireEvent.change(confirmInput, { target: { value: 'password123' } })
    expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument()
  })

  it('valid submit succeeds', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Password has been reset successfully.' }),
    } as Response)

    await renderWithToken()
    const passwordInput = screen.getByLabelText(/^new password/i)
    const confirmInput = screen.getByLabelText(/confirm new password/i)
    const btn = screen.getByTestId('reset-submit')

    expect(btn).not.toBeDisabled()
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'password123' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText(/Password has been reset successfully/i)).toBeInTheDocument()
    })
  })

  it('expired token shows backend error in banner', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Invalid or expired password reset token' }),
    } as Response)

    await renderWithToken()
    const passwordInput = screen.getByLabelText(/^new password/i)
    const confirmInput = screen.getByLabelText(/confirm new password/i)
    const btn = screen.getByTestId('reset-submit')

    expect(btn).not.toBeDisabled()
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'password123' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText(/Invalid or expired password reset token/i)).toBeInTheDocument()
    })
  })

  it('shows network error in banner', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockRejectedValue(new Error('Network failure'))

    await renderWithToken()
    const passwordInput = screen.getByLabelText(/^new password/i)
    const confirmInput = screen.getByLabelText(/confirm new password/i)
    const btn = screen.getByTestId('reset-submit')

    expect(btn).not.toBeDisabled()
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmInput, { target: { value: 'password123' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })
  })
})
