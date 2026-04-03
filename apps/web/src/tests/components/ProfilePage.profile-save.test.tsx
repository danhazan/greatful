import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfilePage from '@/app/profile/page'
import { ToastProvider } from '@/contexts/ToastContext'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/utils/apiClient'
import { stateSyncUtils } from '@/utils/stateSynchronization'

const mockPush = jest.fn()
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

jest.mock('@/contexts/UserContext', () => ({
  useUser: jest.fn()
}))

jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    getCurrentUserProfile: jest.fn(),
    put: jest.fn(),
    getViewerScope: jest.fn(() => 'user:1'),
    invalidateTags: jest.fn(),
  }
}))

jest.mock('@/utils/stateSynchronization', () => ({
  stateSyncUtils: {
    updateUserProfile: jest.fn()
  }
}))

jest.mock('@/components/Navbar', () => function MockNavbar() {
  return <div data-testid="navbar" />
})
jest.mock('@/components/PostCard', () => function MockPostCard() {
  return <div data-testid="post-card" />
})
jest.mock('@/components/ProfilePhotoUpload', () => function MockProfilePhotoUpload() {
  return null
})
jest.mock('@/components/ProfileImageSection', () => function MockProfileImageSection() {
  return <div data-testid="profile-image-section" />
})
jest.mock('@/components/FollowersModal', () => function MockFollowersModal() {
  return null
})
jest.mock('@/components/FollowingModal', () => function MockFollowingModal() {
  return null
})
jest.mock('@/components/LocationAutocomplete', () => {
  return function MockLocationAutocomplete({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) {
    return (
      <input
        aria-label="Enter city, neighborhood, or place..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
})

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>
const mockStateSyncUtils = stateSyncUtils as jest.Mocked<typeof stateSyncUtils>

const mockCurrentUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  displayName: 'Test User',
  profileImageUrl: null
}

const mockProfile = {
  followerCount: 2,
  followingCount: 3,
  postsCount: 1,
  bio: 'Initial bio',
  city: '',
  location: null,
  institutions: [],
  websites: [],
  joinDate: '2023-01-01T00:00:00Z',
  oauthProvider: null
}

function renderProfilePage() {
  return render(
    <ToastProvider>
      <ProfilePage />
    </ToastProvider>
  )
}

describe('ProfilePage profile save', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockUseUser.mockReturnValue({
      currentUser: mockCurrentUser,
      isLoading: false,
      getUserProfile: jest.fn(() => mockProfile),
      logout: jest.fn()
    } as any)

    mockApiClient.get.mockResolvedValue({ data: [] } as any)
    mockApiClient.getCurrentUserProfile.mockResolvedValue({} as any)
    mockApiClient.put.mockResolvedValue({
      bio: 'Updated bio',
      displayName: 'Updated Name',
      city: 'Barcelona',
      location: null,
      institutions: [],
      websites: [],
      profileImageUrl: null
    } as any)

    window.localStorage.getItem = jest.fn(() => 'mock-token')
  })

  it('saves profile through /api/users/me/profile with PUT and shows production-safe UI feedback', async () => {
    let resolveSave!: (value: any) => void
    const deferred = new Promise<any>((resolve) => {
      resolveSave = resolve
    })
    mockApiClient.put.mockImplementationOnce(() => deferred)

    const user = userEvent.setup()
    renderProfilePage()

    await user.click(await screen.findByRole('button', { name: /Edit Profile/i }))

    const displayNameInput = screen.getByPlaceholderText('How you want to be displayed')
    fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } })

    const bioInput = screen.getByPlaceholderText('Tell us about yourself...')
    fireEvent.change(bioInput, { target: { value: 'Updated bio' } })

    const saveButton = screen.getByRole('button', { name: /^Save$/i })
    await user.click(saveButton)

    expect(mockApiClient.put).toHaveBeenCalledWith('/users/me/profile', expect.objectContaining({
      bio: 'Updated bio',
      displayName: 'Updated Name',
      city: '',
      locationData: undefined,
      institutions: [],
      websites: []
    }))

    expect(screen.getByRole('button', { name: /Saving.../i })).toBeDisabled()

    resolveSave({
      bio: 'Updated bio',
      displayName: 'Updated Name',
      city: 'Barcelona',
      location: null,
      institutions: [],
      websites: [],
      profileImageUrl: null
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Saving.../i })).not.toBeInTheDocument()
    })

    expect(screen.getByText('Updated Name')).toBeInTheDocument()
    expect(screen.getByText('Updated bio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument()
    expect(mockStateSyncUtils.updateUserProfile).toHaveBeenCalled()
  })

  it('shows exactly one error toast and never calls alert on failure', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    mockApiClient.put.mockRejectedValueOnce(new Error('Backend unavailable'))

    const user = userEvent.setup()
    renderProfilePage()

    await user.click(await screen.findByRole('button', { name: /Edit Profile/i }))
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    const toastTitle = await screen.findByText('Failed to Update Profile')
    expect(toastTitle).toBeInTheDocument()
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument()
    expect(screen.getAllByText('Failed to Update Profile')).toHaveLength(1)
    expect(alertSpy).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })
})
