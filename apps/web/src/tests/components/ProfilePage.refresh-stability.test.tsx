import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import ProfilePage from '@/app/profile/page'
import { ToastProvider } from '@/contexts/ToastContext'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/utils/apiClient'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}))

jest.mock('@/contexts/UserContext', () => ({
  useUser: jest.fn()
}))

jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    getCurrentUserProfile: jest.fn(),
    getViewerScope: jest.fn(() => 'user:1'),
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
  return function MockLocationAutocomplete() {
    return <div data-testid="location-autocomplete" />
  }
})

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

describe('ProfilePage refresh stability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})

    mockUseUser.mockReturnValue({
      currentUser: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        displayName: 'Test User',
        profileImageUrl: null
      },
      isLoading: false,
      logout: jest.fn(),
    } as any)

    mockApiClient.getCurrentUserProfile.mockResolvedValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
      bio: 'Stable bio',
      profileImageUrl: null,
      city: '',
      location: null,
      institutions: [],
      websites: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      oauthProvider: null,
    } as any)

    mockApiClient.get.mockResolvedValue([] as any)
    window.localStorage.getItem = jest.fn(() => 'mock-token')
  })

  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore()
  })

  it('renders empty query results without repeated fetch loops', async () => {
    render(
      <ToastProvider>
        <ProfilePage />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText(/Loading your profile/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Stable bio')).toBeInTheDocument()
    expect(screen.getByText('No posts yet')).toBeInTheDocument()
    expect(mockApiClient.getCurrentUserProfile).toHaveBeenCalledTimes(1)
    expect(mockApiClient.get).toHaveBeenCalledTimes(1)
  })
})
