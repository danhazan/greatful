import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import SinglePostView from '@/components/SinglePostView'
import { UserProvider } from '@/contexts/UserContext'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock fetch
global.fetch = jest.fn()

const mockPost = {
  id: 'test-post-1',
  content: 'This is plain content',
  richContent: 'This is **bold** and *italic* rich content with @mention',
  postStyle: {
    id: 'test-style',
    name: 'Test Style',
    backgroundColor: '#f0f8ff',
    backgroundGradient: 'linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%)',
    textColor: '#1e3a8a',
    borderStyle: '2px solid #3b82f6',
    fontFamily: 'Georgia, serif',
    textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
  },
  author: {
    id: '1',
    name: 'Test Author',
    username: 'testauthor',
    display_name: 'Test Author',
    image: '/test-avatar.jpg'
  },
  createdAt: '2024-01-01T12:00:00Z',
  postType: 'daily' as const,
  imageUrl: '/test-image.jpg',
  location: 'Test Location',
  heartsCount: 5,
  isHearted: false,
  reactionsCount: 3,
  currentUserReaction: 'heart_eyes'
}

const mockUser = {
  id: '2',
  name: 'Current User',
  email: 'user@example.com'
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <UserProvider>
      {children}
    </UserProvider>
  </ToastProvider>
)

describe('SinglePostView Rich Content Support', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      writable: true
    })
  })

  it('displays rich content with proper styling when post has rich content and post style', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPost
    })

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('bold')).toBeInTheDocument()
    })

    // Check that rich content is rendered
    const boldText = screen.getByText('bold')
    expect(boldText.tagName).toBe('STRONG')

    // Check that post style is applied
    const styledContainer = boldText.closest('.rich-content')
    expect(styledContainer).toHaveStyle({
      backgroundColor: '#f0f8ff',
      background: 'linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%)',
      color: '#1e3a8a',
      border: '2px solid #3b82f6',
      fontFamily: 'Georgia, serif',
      textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
    })
  })

  it('falls back to plain content when rich content is not available', async () => {
    const plainPost = {
      ...mockPost,
      richContent: undefined,
      postStyle: undefined
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => plainPost
    })

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('This is plain content')).toBeInTheDocument()
    })

    // Should not have rich content styling
    const content = screen.getByText('This is plain content')
    expect(content.closest('.rich-content')).not.toBeInTheDocument()
  })

  it('handles posts with rich content but no post style', async () => {
    const richContentOnlyPost = {
      ...mockPost,
      postStyle: undefined
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => richContentOnlyPost
    })

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('bold')).toBeInTheDocument()
    })

    // Should have rich content formatting but no custom styling
    const boldText = screen.getByText('bold')
    expect(boldText.tagName).toBe('STRONG')
    
    const container = boldText.closest('.rich-content-rendered')
    expect(container).toBeInTheDocument()
  })

  it('handles posts with post style but no rich content', async () => {
    const styleOnlyPost = {
      ...mockPost,
      richContent: undefined
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => styleOnlyPost
    })

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('This is plain content')).toBeInTheDocument()
    })

    // Should have post style applied to plain content
    const content = screen.getByText('This is plain content')
    const styledContainer = content.closest('.rich-content')
    expect(styledContainer).toHaveStyle({
      backgroundColor: '#f0f8ff',
      color: '#1e3a8a'
    })
  })

  it('makes API request with proper authentication headers', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPost
    })

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/posts/test-post-1', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      })
    })
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404
    })

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Post not found')).toBeInTheDocument()
    })
  })

  it('displays loading state while fetching post', () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    expect(screen.getByText('Loading post...')).toBeInTheDocument()
  })

  it('handles mentions in rich content with click functionality', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPost
    })

    render(
      <TestWrapper>
        <SinglePostView postId="test-post-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('@mention')).toBeInTheDocument()
    })

    // The mention should be clickable (though we're not testing the click here
    // as it would require more complex mocking of the router)
    const mention = screen.getByText('@mention')
    expect(mention).toHaveClass('mention')
  })
})