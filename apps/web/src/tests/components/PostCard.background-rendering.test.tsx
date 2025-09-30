import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import PostCard from '@/components/PostCard'
import { POST_STYLES } from '@/components/PostStyleSelector'
import { ToastProvider } from '@/contexts/ToastContext'

// Create a test wrapper with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    {children}
  </ToastProvider>
)

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

describe('PostCard Background Rendering', () => {
  const mockPost = {
    id: 'test-post-1',
    content: 'This is a test post with background styling',
    author: {
      id: 'user-1',
      name: 'Test User',
      username: 'testuser',
      display_name: 'Test User',
      image: 'https://example.com/avatar.jpg'
    },
    createdAt: '2024-01-01T12:00:00Z',
    postType: 'daily' as const,
    heartsCount: 5,
    isHearted: false,
    reactionsCount: 3,
    currentUserReaction: undefined
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders default background style correctly', () => {
    const defaultStyle = POST_STYLES[0] // Default style
    const postWithDefaultStyle = {
      ...mockPost,
      postStyle: defaultStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithDefaultStyle}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    // Find the rich content container
    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that default styles are applied
    expect(richContentContainer).toHaveStyle({
      backgroundColor: '#ffffff',
      color: '#374151'
    })
  })

  it('renders warm sunset background style correctly', () => {
    const warmSunsetStyle = POST_STYLES.find(style => style.id === 'warm-sunset')!
    const postWithWarmSunset = {
      ...mockPost,
      postStyle: warmSunsetStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithWarmSunset}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that warm sunset styles are applied with smart text color
    expect(richContentContainer).toHaveStyle({
      backgroundColor: '#FEF3C7',
      background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)',
      color: '#374151', // Smart text color for light background
      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
    })
  })

  it('renders peaceful purple background style correctly', () => {
    const peacefulPurpleStyle = POST_STYLES.find(style => style.id === 'peaceful-purple')!
    const postWithPeacefulPurple = {
      ...mockPost,
      postStyle: peacefulPurpleStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithPeacefulPurple}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that peaceful purple styles are applied with smart text color
    expect(richContentContainer).toHaveStyle({
      backgroundColor: '#F3E8FF',
      background: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 50%, #C084FC 100%)',
      color: '#374151', // Smart text color for light background
      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
    })
  })

  it('renders elegant dark background style correctly', () => {
    const elegantDarkStyle = POST_STYLES.find(style => style.id === 'elegant-dark')!
    const postWithElegantDark = {
      ...mockPost,
      postStyle: elegantDarkStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithElegantDark}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that elegant dark styles are applied
    expect(richContentContainer).toHaveStyle({
      backgroundColor: '#1F2937',
      color: '#F9FAFB',
      textShadow: '0 1px 2px rgba(0,0,0,0.5)'
    })
  })

  it('renders background gradient when specified', () => {
    const gradientStyle = POST_STYLES.find(style => style.backgroundGradient)!
    const postWithGradient = {
      ...mockPost,
      postStyle: gradientStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithGradient}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that gradient background is applied (fallback to backgroundColor if gradient not supported in test env)
    expect(richContentContainer).toHaveStyle({
      background: gradientStyle.backgroundGradient || gradientStyle.backgroundColor,
      backgroundColor: gradientStyle.backgroundColor
    })
  })

  it('renders border style when specified', () => {
    const borderStyle = POST_STYLES.find(style => style.borderStyle)!
    const postWithBorder = {
      ...mockPost,
      postStyle: borderStyle
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithBorder}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that border style is applied
    expect(richContentContainer).toHaveStyle({
      border: borderStyle.borderStyle
    })
  })

  it('renders font family when specified', () => {
    const styleWithFont = POST_STYLES.find(style => style.fontFamily)
    
    if (styleWithFont) {
      const postWithFont = {
        ...mockPost,
        postStyle: styleWithFont
      }

      render(
        <TestWrapper>
          <PostCard
            post={postWithFont}
            currentUserId="current-user"
          />
        </TestWrapper>
      )

      const richContentContainer = document.querySelector('.rich-content')
      expect(richContentContainer).toBeInTheDocument()
      
      // Check that font family is applied
      expect(richContentContainer).toHaveStyle({
        fontFamily: styleWithFont.fontFamily
      })
    }
  })

  it('handles posts without background styles (default styling)', () => {
    const postWithoutStyle = {
      ...mockPost,
      postStyle: undefined
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithoutStyle}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    // Should render without errors and show content
    expect(screen.getByText('This is a test post with background styling')).toBeInTheDocument()
    
    // Rich content container should exist but without custom styles
    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
  })

  it('handles legacy posts with font properties', () => {
    const legacyPostWithFont = {
      ...mockPost,
      postStyle: {
        id: 'legacy-style',
        name: 'Legacy Style',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        fontFamily: 'Arial, sans-serif'
      }
    }

    render(
      <TestWrapper>
        <PostCard
          post={legacyPostWithFont}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that legacy font properties are applied with explicit text color
    expect(richContentContainer).toHaveStyle({
      backgroundColor: '#ffffff',
      color: '#000000', // Explicit textColor from legacy post
      fontFamily: 'Arial, sans-serif'
    })
  })

  it('prefers post_style over postStyle (backend field priority)', () => {
    const postWithBothStyles = {
      ...mockPost,
      postStyle: POST_STYLES[0], // Default style
      post_style: POST_STYLES[1]  // Warm sunset style (should take priority)
    }

    render(
      <TestWrapper>
        <PostCard
          post={postWithBothStyles}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Should use post_style (backend field) over postStyle
    const warmSunsetStyle = POST_STYLES[1]
    expect(richContentContainer).toHaveStyle({
      backgroundColor: warmSunsetStyle.backgroundColor,
      color: warmSunsetStyle.textColor
    })
  })

  it('maintains consistent styling across different post types', () => {
    const testStyle = POST_STYLES.find(style => style.id === 'nature-green')!
    
    const postTypes: Array<'daily' | 'photo' | 'spontaneous'> = ['daily', 'photo', 'spontaneous']
    
    postTypes.forEach(postType => {
      const postWithType = {
        ...mockPost,
        postType,
        postStyle: testStyle
      }

      const { unmount } = render(
        <TestWrapper>
          <PostCard
            post={postWithType}
            currentUserId="current-user"
          />
        </TestWrapper>
      )

      const richContentContainer = document.querySelector('.rich-content')
      expect(richContentContainer).toBeInTheDocument()
      
      // Background styles should be consistent regardless of post type
      expect(richContentContainer).toHaveStyle({
        backgroundColor: testStyle.backgroundColor,
        color: testStyle.textColor
      })

      unmount()
    })
  })

  it('applies padding and border radius to styled content', () => {
    const styledPost = {
      ...mockPost,
      postStyle: POST_STYLES[1] // Any non-default style
    }

    render(
      <TestWrapper>
        <PostCard
          post={styledPost}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Check that container styling includes padding and border radius
    expect(richContentContainer).toHaveStyle({
      padding: '16px',
      borderRadius: '12px',
      margin: '8px 0'
    })
  })

  it('renders background styles in feed context', () => {
    const styledPost = {
      ...mockPost,
      postStyle: POST_STYLES[2] // Peaceful purple
    }

    // Simulate feed context (no hideFollowButton prop)
    render(
      <TestWrapper>
        <PostCard
          post={styledPost}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Background styles should render correctly in feed context
    const peacefulPurpleStyle = POST_STYLES[2]
    expect(richContentContainer).toHaveStyle({
      backgroundColor: peacefulPurpleStyle.backgroundColor,
      color: peacefulPurpleStyle.textColor
    })
  })

  it('renders background styles in profile context', () => {
    const styledPost = {
      ...mockPost,
      postStyle: POST_STYLES[3] // Nature green
    }

    // Simulate profile context (hideFollowButton = true)
    render(
      <TestWrapper>
        <PostCard
          post={styledPost}
          currentUserId="current-user"
          hideFollowButton={true}
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Background styles should render correctly in profile context
    const natureGreenStyle = POST_STYLES[3]
    expect(richContentContainer).toHaveStyle({
      backgroundColor: natureGreenStyle.backgroundColor,
      color: natureGreenStyle.textColor
    })
  })

  it('renders background styles in shared post context', () => {
    const styledPost = {
      ...mockPost,
      postStyle: POST_STYLES[4] // Ocean blue
    }

    // Simulate shared post context (could be viewed by logged-out users)
    render(
      <TestWrapper>
        <PostCard
          post={styledPost}
          currentUserId={undefined} // Logged-out user
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Background styles should render correctly even for logged-out users
    const oceanBlueStyle = POST_STYLES[4]
    expect(richContentContainer).toHaveStyle({
      backgroundColor: oceanBlueStyle.backgroundColor,
      color: oceanBlueStyle.textColor
    })
  })

  it('handles complex content with background styles', () => {
    const complexPost = {
      ...mockPost,
      content: 'This is **bold** text with *italic* and __underline__ formatting @mention',
      postStyle: POST_STYLES[5] // Rose gold
    }

    render(
      <TestWrapper>
        <PostCard
          post={complexPost}
          currentUserId="current-user"
        />
      </TestWrapper>
    )

    const richContentContainer = document.querySelector('.rich-content')
    expect(richContentContainer).toBeInTheDocument()
    
    // Background styles should apply to complex formatted content
    const roseGoldStyle = POST_STYLES[5]
    expect(richContentContainer).toHaveStyle({
      backgroundColor: roseGoldStyle.backgroundColor,
      color: roseGoldStyle.textColor
    })

    // Content should still be rendered with formatting
    const renderedContent = richContentContainer.querySelector('.rich-content-rendered')
    expect(renderedContent?.innerHTML).toContain('<strong>')
    expect(renderedContent?.innerHTML).toContain('<em>')
    expect(renderedContent?.innerHTML).toContain('<u>')
  })
})