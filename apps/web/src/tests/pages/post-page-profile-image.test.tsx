/**
 * Test for post page profile image display fix
 * Verifies that the post page correctly displays author profile images
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import PostPage from '@/app/post/[id]/page'
import { UserProvider } from '@/contexts/UserContext'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  notFound: jest.fn(),
}))

// Mock the API response
const mockPostData = {
  id: "test-post-id",
  content: "Test post content",
  title: null,
  author: {
    id: 1,
    username: "testuser",
    display_name: "Test User",
    name: "Test User",
    image: "/uploads/profile_photos/test-profile.jpg"
  },
  created_at: "2025-01-01T12:00:00Z",
  post_type: "daily",
  image_url: null,
  location: null,
  hearts_count: 5,
  reactions_count: 2,
  current_user_reaction: null,
  is_hearted: false
}

// Mock fetch
global.fetch = jest.fn()

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <UserProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </UserProvider>
)

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('Post Page Profile Image', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock localStorage to provide access token
    mockLocalStorage.getItem.mockReturnValue('mock-access-token')
    
    // Mock successful API response
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => mockPostData,
    } as Response)
  })

  it('should correctly map author.image field from API response', async () => {
    const params = { id: 'test-post-id' }
    
    render(
      <TestWrapper>
        <PostPage params={params} />
      </TestWrapper>
    )

    // Wait for the post to load
    await waitFor(() => {
      expect(screen.getByText('Test post content')).toBeInTheDocument()
    })

    // Verify that the API was called (Next.js API route, not FastAPI directly)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/posts/test-post-id'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-access-token',
          'Content-Type': 'application/json',
        }),
      })
    )

    // The profile image should be rendered (even if it fails to load, the img element should exist)
    // We look for the ProfilePhotoDisplay component which should render an img or fallback
    const profileElements = screen.getAllByRole('img', { hidden: true })
    expect(profileElements.length).toBeGreaterThan(0)
  })

  it('should handle missing profile image gracefully', async () => {
    // Mock response with no profile image
    const mockDataNoImage = {
      ...mockPostData,
      author: {
        ...mockPostData.author,
        image: null
      }
    }

    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => mockDataNoImage,
    } as Response)

    const params = { id: 'test-post-id' }
    
    render(
      <TestWrapper>
        <PostPage params={params} />
      </TestWrapper>
    )

    // Wait for the post to load
    await waitFor(() => {
      expect(screen.getByText('Test post content')).toBeInTheDocument()
    })

    // Should still render the post content even without profile image
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('should transform API response correctly', async () => {
    const params = { id: 'test-post-id' }
    
    render(
      <TestWrapper>
        <PostPage params={params} />
      </TestWrapper>
    )

    // Wait for the post to load
    await waitFor(() => {
      expect(screen.getByText('Test post content')).toBeInTheDocument()
    })

    // Verify the author name is displayed correctly
    expect(screen.getByText('Test User')).toBeInTheDocument()
    
    // Verify the profile image has the correct src attribute
    const profileImage = screen.getByAltText("testuser's profile")
    expect(profileImage).toHaveAttribute('src', 'http://localhost:8000/uploads/profile_photos/test-profile.jpg')
  })
})