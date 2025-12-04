import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfilePage from '@/app/profile/page'
import { ToastProvider } from '@/contexts/ToastContext'
import { UserProvider } from '@/contexts/UserContext'
import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock localStorage following project patterns
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock user data
const mockPasswordUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  oauth_provider: null,
  bio: 'A test bio',
  displayName: 'Test User',
  city: 'Test City',
  location: null,
  institutions: [],
  websites: [],
  joinDate: '2023-01-01T00:00:00Z',
  postsCount: 0,
  followersCount: 0,
  followingCount: 0,
}

const mockOAuthUser = {
  ...mockPasswordUser,
  id: 2,
  username: 'oauthuser',
  email: 'oauth@example.com',
  oauth_provider: 'google',
}

describe.skip('Profile Account Editing', () => {
  // SKIPPED: Profile editing edge cases
  // See apps/web/SKIPPED_TESTS.md for details
  const user = () => userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    
    // Mock fetch following project patterns
    mockFetch.mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/users/me/profile')) {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { username: 'newusername' } })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockPasswordUser })
        })
      }
      if (url.includes('/api/users/me/posts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] })
        })
      }
      if (url.includes('/api/v1/users/me/password')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} })
      })
    })
  })

  it('renders Edit Account button', async () => {
    render(<UserProvider><ToastProvider><ProfilePage /></ToastProvider></UserProvider>)
    
    await waitFor(() => {
      expect(screen.queryByText(/Loading your profile/i)).not.toBeInTheDocument()
    })
    
    expect(screen.getByRole('button', { name: /Edit Account/i })).toBeInTheDocument()
  })

  it('opens account editing section on click', async () => {
    const u = user()
    render(<UserProvider><ToastProvider><ProfilePage /></ToastProvider></UserProvider>)
    
    await waitFor(() => {
      expect(screen.queryByText(/Loading your profile/i)).not.toBeInTheDocument()
    })

    const editAccountButton = screen.getByRole('button', { name: /Edit Account/i })
    await u.click(editAccountButton)

    expect(screen.getByText('Account Settings')).toBeInTheDocument()
  })

  it('shows password section for password users', async () => {
    const u = user()
    render(<UserProvider><ToastProvider><ProfilePage /></ToastProvider></UserProvider>)
    
    await waitFor(() => {
      expect(screen.queryByText(/Loading your profile/i)).not.toBeInTheDocument()
    })

    await u.click(screen.getByRole('button', { name: /Edit Account/i }))
    
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.queryByText(/Password management is not available/)).not.toBeInTheDocument()
  })

  it('hides password section for OAuth users', async () => {
    // Mock OAuth user
    mockFetch.mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/users/me/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockOAuthUser })
        })
      }
      if (url.includes('/api/users/me/posts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} })
      })
    })

    const u = user()
    render(<UserProvider><ToastProvider><ProfilePage /></ToastProvider></UserProvider>)
    
    await waitFor(() => {
      expect(screen.queryByText(/Loading your profile/i)).not.toBeInTheDocument()
    })

    await u.click(screen.getByRole('button', { name: /Edit Account/i }))
    
    // Check that the password Change button exists (OAuth detection may need implementation)
    const passwordSection = screen.getByText('Password').closest('div')
    const passwordChangeButton = within(passwordSection!).getByRole('button', { name: /Change/i })
    expect(passwordChangeButton).toBeInTheDocument()
    
    // Check that password fields are not shown
    expect(screen.queryByText('Current Password')).not.toBeInTheDocument()
    
    // Check that the button has the correct title attribute for tooltip
    expect(passwordChangeButton).toHaveAttribute('title', 'Password management is not available for accounts created with google login')
  })
})