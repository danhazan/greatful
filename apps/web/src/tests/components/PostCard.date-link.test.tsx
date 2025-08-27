import React from 'react'
import { render, screen } from '@testing-library/react'
import PostCard from '@/components/PostCard'

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackReactionEvent: jest.fn(),
  trackShareEvent: jest.fn(),
}))

// Mock the auth utils
jest.mock('@/utils/auth', () => ({
  isAuthenticated: () => true,
  canInteract: () => true,
  getAccessToken: () => 'mock-token',
}))

// Mock the image utils
jest.mock('@/utils/imageUtils', () => ({
  getImageUrl: (url: string) => url,
}))

describe('PostCard Date Link', () => {
  const mockPost = {
    id: '1',
    content: 'Test post content',
    author: {
      id: '1',
      name: 'Test User',
      image: 'https://example.com/avatar.jpg'
    },
    createdAt: '2024-01-15T10:30:00Z',
    postType: 'daily' as const,
    heartsCount: 5,
    isHearted: false,
    reactionsCount: 3,
    currentUserReaction: undefined
  }

  it('renders date as clickable link to post page', () => {
    render(
      <PostCard 
        post={mockPost}
        currentUserId="1"
      />
    )

    // Find the date link by its href attribute
    const dateLink = screen.getByRole('link')
    
    // Check that it has the correct href
    expect(dateLink).toHaveAttribute('href', '/post/1')
    
    // Check that it has the correct title
    expect(dateLink).toHaveAttribute('title', 'View post details')
    
    // Check that it has hover styles
    expect(dateLink).toHaveClass('hover:text-purple-600', 'hover:underline')
  })

  it('displays formatted date text in the link', () => {
    render(
      <PostCard 
        post={mockPost}
        currentUserId="1"
      />
    )

    // The date should be formatted and clickable
    const dateLink = screen.getByRole('link')
    
    // Should contain some date text (exact format depends on current date)
    expect(dateLink.textContent).toBeTruthy()
    expect(dateLink.textContent).not.toBe('')
    // Should contain a date-like format
    expect(dateLink.textContent).toMatch(/\d/)
  })

  it('works with different post types', () => {
    const photoPost = { ...mockPost, postType: 'photo' as const }
    
    render(
      <PostCard 
        post={photoPost}
        currentUserId="1"
      />
    )

    const dateLink = screen.getByRole('link')
    expect(dateLink).toHaveAttribute('href', '/post/1')
    expect(dateLink).toHaveAttribute('title', 'View post details')
  })
})