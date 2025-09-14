import { describe, it, expect } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import PostCard from '@/components/PostCard'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the RTL utilities
jest.mock('@/utils/rtlUtils', () => ({
  getTextDirection: jest.fn((text: string) => {
    // Simple mock: if text contains Hebrew characters, return 'rtl'
    return /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr'
  }),
  getTextAlignmentClass: jest.fn((text: string) => {
    return /[\u0590-\u05FF]/.test(text) ? 'text-right' : 'text-left'
  }),
  getDirectionAttribute: jest.fn((text: string) => {
    return /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr'
  }),
  getTextDirectionFromPlainText: jest.fn((text: string) => {
    // Simple mock: if text contains Hebrew characters, return 'rtl'
    return /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr'
  })
}))

const mockPost = {
  id: "1",
  content: "שלום עולם! זה פוסט בעברית",
  author: {
    id: "1",
    name: "Test User",
    username: "testuser",
    display_name: "Test User"
  },
  createdAt: new Date().toISOString(),
  postType: "daily" as const,
  heartsCount: 0,
  isHearted: false,
  reactionsCount: 0
}

const mockEnglishPost = {
  id: "2",
  content: "Hello World! This is an English post",
  author: {
    id: "1",
    name: "Test User",
    username: "testuser",
    display_name: "Test User"
  },
  createdAt: new Date().toISOString(),
  postType: "daily" as const,
  heartsCount: 0,
  isHearted: false,
  reactionsCount: 0
}

describe('PostCard RTL Support', () => {
  const renderPostCard = (post: any) => {
    return render(
      <ToastProvider>
        <PostCard
          post={post}
          currentUserId="1"
          onHeart={() => {}}
          onReaction={() => {}}
          onRemoveReaction={() => {}}
          onShare={() => {}}
          onUserClick={() => {}}
        />
      </ToastProvider>
    )
  }

  it('should apply RTL direction to Hebrew content', () => {
    renderPostCard(mockPost)
    
    // Find the post content container
    const contentContainer = document.querySelector('.post-content-area')
    expect(contentContainer).toHaveAttribute('dir', 'rtl')
  })

  it('should apply LTR direction to English content', () => {
    renderPostCard(mockEnglishPost)
    
    // Find the post content container
    const contentContainer = document.querySelector('.post-content-area')
    expect(contentContainer).toHaveAttribute('dir', 'ltr')
  })

  it('should apply correct text alignment classes', () => {
    renderPostCard(mockPost)
    
    // Check that the rich content renderer has the correct alignment class
    const richContentElement = document.querySelector('.rich-content-rendered')
    expect(richContentElement).toHaveClass('text-right')
  })

  it('should apply correct text alignment for English content', () => {
    renderPostCard(mockEnglishPost)
    
    // Check that the rich content renderer has the correct alignment class
    const richContentElement = document.querySelector('.rich-content-rendered')
    expect(richContentElement).toHaveClass('text-left')
  })

  it('should have RTL direction attribute for proper alignment', () => {
    renderPostCard(mockPost)
    
    // Check that the rich content renderer has RTL direction
    const richContentElement = document.querySelector('.rich-content-rendered')
    expect(richContentElement).toHaveAttribute('dir', 'rtl')
  })

  it('should have LTR direction attribute for proper alignment', () => {
    renderPostCard(mockEnglishPost)
    
    // Check that the rich content renderer has LTR direction
    const richContentElement = document.querySelector('.rich-content-rendered')
    expect(richContentElement).toHaveAttribute('dir', 'ltr')
  })
})