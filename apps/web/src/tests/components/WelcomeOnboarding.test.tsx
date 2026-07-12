// IMPORTANT: Do NOT import jest from @jest/globals. Use global jest instead.
// jest.mock factory runs BEFORE imports are initialized, so locally imported
// jest would be in Temporal Dead Zone, causing the factory to throw silently
// and the mock to not be applied.

const mockReloadUser = jest.fn(() => Promise.resolve())

jest.mock('@/contexts/UserContext', () => ({
  useUser: jest.fn(),
}))

jest.mock('@/hooks/useLocale', () => ({
  useLocaleWithUpdate: () => ({ locale: 'en-US', updatePreference: jest.fn() }),
  useLocale: () => 'en-US',
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/welcome',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/components/ProfilePhotoUpload', () => {
  const Mock = ({ onPhotoUpdate, onControlledFile }: any) =>
    React.createElement('div', { 'data-testid': 'profile-photo-upload' },
      React.createElement('button', {
        onClick: () => onControlledFile?.(new Blob(), { x: 0, y: 0, radius: 100 })
      }, 'Upload Photo'),
      React.createElement('button', {
        onClick: () => onPhotoUpdate?.(null)
      }, 'Remove Photo')
    )
  return Mock
})

jest.mock('@/components/settings/ProfileInformationForm', () => {
  const Mock = ({ value, onChange }: any) =>
    React.createElement('div', { 'data-testid': 'profile-info-form' },
      React.createElement('input', {
        'data-testid': 'display-name-input',
        defaultValue: value.displayName,
        onChange: (e: any) => onChange({ ...value, displayName: e.target.value })
      }),
    )
  return Mock
})

jest.mock('@/components/settings/AccountSettingsForm', () => {
  const Mock = ({ value, onChange, usernameError, isUsernameEditable, onToggleUsernameEdit, onCancelUsernameEdit }: any) =>
    React.createElement('div', { 'data-testid': 'account-settings-form' },
      React.createElement('input', {
        'data-testid': 'username-input',
        defaultValue: value.username,
        onChange: (e: any) => onChange({ ...value, username: e.target.value })
      }),
      usernameError ? React.createElement('p', { 'data-testid': 'username-error' }, usernameError) : null,
      onToggleUsernameEdit ? React.createElement('button', {
        onClick: () => isUsernameEditable && onCancelUsernameEdit ? onCancelUsernameEdit() : onToggleUsernameEdit()
      }, isUsernameEditable ? 'Cancel' : 'Change') : null,
    )
  return Mock
})

const mockFetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }))
global.fetch = mockFetch as any

const mockPush = jest.fn()

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useUser } from '@/contexts/UserContext'
import WelcomePage from '@/app/(welcome)/welcome/page'

beforeEach(() => {
  jest.clearAllMocks()
  ;(useUser as jest.Mock).mockReturnValue({
    currentUser: { id: '1', signupEligible: true, username: 'test', email: 'test@test.com' },
    isLoading: false,
    reloadUser: mockReloadUser,
  })
})

describe('Welcome Onboarding', () => {
  describe('Route Protection', () => {
    it('redirects to login when unauthenticated', () => {
      ;(useUser as jest.Mock).mockReturnValue({ currentUser: null, isLoading: false })
      render(React.createElement(WelcomePage))
      expect(mockPush).toHaveBeenCalledWith('/auth/login')
    })

    it('redirects to profile when signup token absent or expired', () => {
      ;(useUser as jest.Mock).mockReturnValue({
        currentUser: { id: '1', signupEligible: false },
        isLoading: false,
      })
      render(React.createElement(WelcomePage))
      expect(mockPush).toHaveBeenCalledWith('/profile')
    })

    it('renders welcome page when authenticated and signup token valid', () => {
      render(React.createElement(WelcomePage))
      expect(screen.queryByText('Welcome to Grateful')).toBeTruthy()
    })
  })

  describe('Navigation', () => {
    it('shows Welcome slide by default', () => {
      render(React.createElement(WelcomePage))
      expect(screen.getByText('Welcome to Grateful')).toBeTruthy()
    })

    it('navigates through slides with Next button', () => {
      render(React.createElement(WelcomePage))
      fireEvent.click(screen.getByText('Next'))
      expect(screen.getByTestId('profile-info-form')).toBeTruthy()
    })

    it('navigates back with Previous button', () => {
      render(React.createElement(WelcomePage))
      fireEvent.click(screen.getByText('Next'))
      expect(screen.getByTestId('profile-info-form')).toBeTruthy()
      fireEvent.click(screen.getByText('Previous'))
      expect(screen.getByText('Welcome to Grateful')).toBeTruthy()
    })

    it('shows Finish on the info slide only', () => {
      render(React.createElement(WelcomePage))
      expect(screen.queryByText('Finish')).toBeFalsy()
      const nextBtn = screen.getByText('Next')
      fireEvent.click(nextBtn)
      expect(screen.queryByText('Finish')).toBeFalsy()
      fireEvent.click(nextBtn)
      expect(screen.queryByText('Finish')).toBeFalsy()
      fireEvent.click(nextBtn)
      expect(screen.getByText('Finish')).toBeTruthy()
    })

    it('shows All set! on the info slide', () => {
      render(React.createElement(WelcomePage))
      const nextBtn = screen.getByText('Next')
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      expect(screen.getByText('All set!')).toBeTruthy()
      expect(screen.getByText(/You can now start sharing/)).toBeTruthy()
    })
  })

  describe('Finish Confirmation Dialog', () => {
    function nextToLastSlide() {
      const nextBtn = screen.getByText('Next')
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
    }

    it('shows confirmation dialog when Finish is pressed', () => {
      render(React.createElement(WelcomePage))
      nextToLastSlide()
      expect(screen.queryByText(/Your profile can always be edited/)).toBeFalsy()
      fireEvent.click(screen.getByText('Finish'))
      expect(screen.getByText(/Your profile can always be edited/)).toBeTruthy()
    })

    it('closes dialog on Cancel without submitting', () => {
      render(React.createElement(WelcomePage))
      nextToLastSlide()
      fireEvent.click(screen.getByText('Finish'))
      expect(screen.getByText(/Your profile can always be edited/)).toBeTruthy()
      fireEvent.click(screen.getByText('Cancel'))
      expect(screen.queryByText(/Your profile can always be edited/)).toBeFalsy()
      expect(mockFetch).not.toHaveBeenCalledWith('/api/users/me/onboarding', expect.anything())
    })

    it('sends POST from dialog Finish button', () => {
      render(React.createElement(WelcomePage))
      nextToLastSlide()
      fireEvent.click(screen.getByText('Finish'))
      fireEvent.click(screen.getAllByText('Finish')[1])

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/me/onboarding',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('redirects to profile on success after reloadUser', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

      render(React.createElement(WelcomePage))
      nextToLastSlide()
      fireEvent.click(screen.getByText('Finish'))
      fireEvent.click(screen.getAllByText('Finish')[1])

      await waitFor(() => expect(mockReloadUser).toHaveBeenCalled())
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile'))
    })
  })

  describe('Skip is removed', () => {
    it('does not render a Skip button on any slide', () => {
      render(React.createElement(WelcomePage))
      expect(screen.queryByText('Skip')).toBeFalsy()
      fireEvent.click(screen.getByText('Next'))
      expect(screen.queryByText('Skip')).toBeFalsy()
      fireEvent.click(screen.getByText('Next'))
      expect(screen.queryByText('Skip')).toBeFalsy()
      fireEvent.click(screen.getByText('Next'))
      expect(screen.queryByText('Skip')).toBeFalsy()
    })
  })

  describe('Photo Removal', () => {
    const renderWithPhoto = () => {
      (useUser as jest.Mock).mockReturnValue({
        currentUser: {
          id: '1',
          signupEligible: true,
          username: 'test',
          email: 'test@test.com',
          profileImageUrl: 'https://oauth.example.com/photo.jpg',
        },
        isLoading: false,
        reloadUser: mockReloadUser,
      })
      return render(React.createElement(WelcomePage))
    }

    function submitOnboarding() {
      const nextBtn = screen.getByText('Next')
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      fireEvent.click(screen.getByText('Finish'))
      fireEvent.click(screen.getAllByText('Finish')[1])
    }

    it('sends remove_profile_image=true when user removes photo', () => {
      renderWithPhoto()
      fireEvent.click(screen.getByText('Remove Photo'))
      submitOnboarding()

      const callBody = mockFetch.mock.calls[0][1].body
      expect(callBody).toBeInstanceOf(FormData)
      expect((callBody as FormData).get('remove_profile_image')).toBe('true')
      expect((callBody as FormData).get('file')).toBeNull()
    })

    it('does not send remove_profile_image when new file uploaded after remove', () => {
      renderWithPhoto()
      fireEvent.click(screen.getByText('Remove Photo'))
      fireEvent.click(screen.getByText('Upload Photo'))
      submitOnboarding()

      const callBody = mockFetch.mock.calls[0][1].body
      expect(callBody).toBeInstanceOf(FormData)
      expect((callBody as FormData).get('remove_profile_image')).toBeNull()
      expect((callBody as FormData).get('file')).toBeTruthy()
    })

    it('does not send remove_profile_image when normal user removes photo', () => {
      (useUser as jest.Mock).mockReturnValue({
        currentUser: {
          id: '1',
          signupEligible: true,
          username: 'test',
          email: 'test@test.com',
          // No profileImageUrl — normal user, not OAuth
        },
        isLoading: false,
        reloadUser: mockReloadUser,
      })
      render(React.createElement(WelcomePage))
      fireEvent.click(screen.getByText('Remove Photo'))
      submitOnboarding()

      const callBody = mockFetch.mock.calls[0][1].body
      expect(callBody).toBeInstanceOf(FormData)
      expect((callBody as FormData).get('remove_profile_image')).toBeNull()
      expect((callBody as FormData).get('file')).toBeNull()
    })
  })

  describe('Validation Errors', () => {
    function nextToLastAndClickFinish() {
      const nextBtn = screen.getByText('Next')
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      fireEvent.click(screen.getByText('Finish')) // opens dialog
      fireEvent.click(screen.getAllByText('Finish')[1]) // submits
    }

    it('navigates to account slide on username conflict', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'already_exists',
            message: 'Username already taken',
            details: { resource: 'user' },
          },
        }),
      })

      render(React.createElement(WelcomePage))
      nextToLastAndClickFinish()

      await waitFor(() => expect(screen.getByTestId('account-settings-form')).toBeTruthy())
    })

    it('shows generic error for 422 without error code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: [{ loc: ['body', 'display_name'], msg: 'too long' }] }),
      })

      render(React.createElement(WelcomePage))
      nextToLastAndClickFinish()

      // 422 from FastAPI native validation lacks error.code → falls to generic error display
      await waitFor(() => expect(screen.getByText(/too long/i)).toBeTruthy())
    })

    it('clears username error when user edits the field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'already_exists',
            message: 'Username already taken',
            details: { resource: 'user' },
          },
        }),
      })

      render(React.createElement(WelcomePage))
      nextToLastAndClickFinish()

      await waitFor(() => expect(screen.getByTestId('username-error')).toBeTruthy())
      expect(screen.getByText('Username already taken')).toBeTruthy()

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'newusername' } })

      await waitFor(() => {
        expect(screen.queryByTestId('username-error')).toBeFalsy()
      })
    })

    it('clears username error when user presses Cancel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'already_exists',
            message: 'Username already taken',
            details: { resource: 'user' },
          },
        }),
      })

      render(React.createElement(WelcomePage))
      nextToLastAndClickFinish()

      await waitFor(() => expect(screen.getByTestId('username-error')).toBeTruthy())
      expect(screen.getByText('Username already taken')).toBeTruthy()

      // Click Change to make username editable, then Cancel
      fireEvent.click(screen.getByText('Change'))
      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.queryByTestId('username-error')).toBeFalsy()
      })
    })
  })
})
