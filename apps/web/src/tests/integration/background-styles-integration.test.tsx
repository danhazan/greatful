import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import PostCard from '@/components/PostCard'
import { POST_STYLES } from '@/components/PostStyleSelector'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn()
  })
}))

// Mock auth utilities
jest.mock('@/utils/auth', () => ({
  isAuthenticated: () => true,
  getAccessToken: () => 'mock-token'
}))

// Mock analytics service
jest.mock('@/services/analytics', () => ({
  default: {
    trackViewEvent: jest.fn(),
    trackHeartEvent: jest.fn(),
    trackReactionEvent: jest.fn()
  }
}))

// Mock state synchronization hook
jest.mock('@/hooks/useStateSynchronization', () => ({
  usePostStateSynchronization: jest.fn()
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    {children}
  </ToastProvider>
)

describe('Background Styles Integration', () => {
  const mockPost = {
    id: 'integration-test-post',
    content: 'Testing background styles integration with **bold** text and @mention',
    author: {
      id: 'author-1',
      name: 'Test Author',
      username: 'testauthor',
      display_name: 'Test Author',
      image: 'https://example.com/author.jpg'
    },
    createdAt: '2024-01-01T12:00:00Z',
    postType: 'daily' as const,
    heartsCount: 10,
    isHearted: false,
    reactionsCount: 5,
    currentUserReaction: undefined
  }

  it('integrates background styles with rich content rendering', async () => {
    const warmSunsetStyle = POST_STYLES.find(style => style.id === 'warm-sunset')!
    const postWithStyle = {
      ...mockPost,
      postStyle: warmSunsetStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithStyle}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText(/Testing background styles integration/)).toBeInTheDocument()
    })

    // Check that the rich content container exists and has the correct styles
    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Verify background styles are applied with smart text color
    expect(richContentContainer).toHaveStyle({
      backgroundColor: warmSunsetStyle.backgroundColor,
      color: '#374151' // Smart text color for light background
    })

    // Verify that rich content formatting is preserved
    const renderedContent = richContentContainer?.querySelector('.rich-content-rendered')
    expect(renderedContent).toBeInTheDocument()
    expect(renderedContent?.innerHTML).toContain('<strong>bold</strong>')
    expect(renderedContent?.innerHTML).toContain('@mention')
  })

  it('handles posts with post_style field (backend format)', async () => {
    const elegantDarkStyle = POST_STYLES.find(style => style.id === 'elegant-dark')!
    const postWithBackendStyle = {
      ...mockPost,
      post_style: elegantDarkStyle // Backend field name
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithBackendStyle}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Testing background styles integration/)).toBeInTheDocument()
    })

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Verify elegant dark styles are applied (keeps explicit white text)
    expect(richContentContainer).toHaveStyle({
      backgroundColor: elegantDarkStyle.backgroundColor,
      color: elegantDarkStyle.textColor // Keeps explicit white for dark theme
    })
  })

  it('gracefully handles posts without background styles', async () => {
    const postWithoutStyle = {
      ...mockPost,
      postStyle: undefined,
      post_style: undefined
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithoutStyle}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Testing background styles integration/)).toBeInTheDocument()
    })

    // Should render without errors
    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Content should still be formatted properly even without background styles
    const renderedContent = richContentContainer?.querySelector('.rich-content-rendered')
    expect(renderedContent).toBeInTheDocument()
    expect(renderedContent?.innerHTML).toContain('<strong>bold</strong>')
  })

  it('works across different post contexts (feed, profile, shared)', async () => {
    const natureGreenStyle = POST_STYLES.find(style => style.id === 'nature-green')!
    const styledPost = {
      ...mockPost,
      postStyle: natureGreenStyle
    }

    // Test feed context
    const { rerender } = render(
      <TestWrapper>
        <PostCard
          post={styledPost}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Testing background styles integration/)).toBeInTheDocument()
    })

    let richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toHaveStyle({
      backgroundColor: natureGreenStyle.backgroundColor,
      color: '#374151' // Smart text color for light background
    })

    // Test profile context
    rerender(
      <TestWrapper>
        <PostCard
          post={styledPost}
          currentUserId="current-user"
          hideFollowButton={true}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Testing background styles integration/)).toBeInTheDocument()
    })

    richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toHaveStyle({
      backgroundColor: natureGreenStyle.backgroundColor,
      color: '#374151' // Smart text color for light background
    })

    // Test shared post context (logged-out user)
    rerender(
      <TestWrapper>
        <PostCard
          post={styledPost}
          currentUserId={undefined}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Testing background styles integration/)).toBeInTheDocument()
    })

    richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toHaveStyle({
      backgroundColor: natureGreenStyle.backgroundColor,
      color: '#374151' // Smart text color for light background
    })
  })

  it('maintains style consistency with complex content', async () => {
    const roseGoldStyle = POST_STYLES.find(style => style.id === 'rose-gold')!
    const complexPost = {
      ...mockPost,
      content: `This is a complex post with:

**Bold text** and *italic text*
__Underlined text__

@mention1 and @mention2

Multiple paragraphs to test
line breaks and formatting.`,
      postStyle: roseGoldStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={complexPost}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/This is a complex post with/)).toBeInTheDocument()
    })

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Verify background styles are applied to complex content with smart text color
    expect(richContentContainer).toHaveStyle({
      backgroundColor: roseGoldStyle.backgroundColor,
      color: '#374151' // Smart text color for light background
    })

    // Verify all formatting is preserved
    const renderedContent = richContentContainer?.querySelector('.rich-content-rendered')
    expect(renderedContent).toBeInTheDocument()
    expect(renderedContent?.innerHTML).toContain('<strong>Bold text</strong>')
    expect(renderedContent?.innerHTML).toContain('<em>italic text</em>')
    expect(renderedContent?.innerHTML).toContain('<u>Underlined text</u>')
    expect(renderedContent?.innerHTML).toContain('@mention1')
    expect(renderedContent?.innerHTML).toContain('@mention2')
  })
})