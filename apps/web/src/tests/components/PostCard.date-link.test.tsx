import React from 'react'
import { render, screen } from '@/tests/utils/testUtils'
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
      username: 'testuser',
      displayName: 'Test User',
      image: 'https://example.com/avatar.jpg'
    },
    createdAt: '2024-01-15T10:30:00Z',
    reactionsCount: 3,
    currentUserReaction: undefined,
    reactionEmojiCodes: []
  }

  const photoPost = {
    ...mockPost,
    id: 'photo-1',
    images: [{ url: 'https://example.com/photo.jpg', width: 800, height: 600 }]
  }

  it('renders date as clickable link to post page', () => {
    render(
      <PostCard 
        post={mockPost}
        currentUserId="1"
      />
    )

    // Find date link by its title attribute (more reliable than accessible name)
    const dateLink = screen.getByTitle('View post details')
    
    // Check that it has the correct href
    expect(dateLink).toHaveAttribute('href', '/post/1')
  })

  it('displays formatted date text in the link', () => {
    render(
      <PostCard 
        post={mockPost}
        currentUserId="1"
      />
    )

    // The date should be formatted and clickable - find by title
    const dateLink = screen.getByTitle('View post details')
    
    // Should contain some date text (exact format depends on current date)
    expect(dateLink.textContent).toBeTruthy()
    expect(dateLink.textContent).not.toBe('')
  })

  it('works with different post types', () => {
    render(
      <PostCard 
        post={photoPost}
        currentUserId="1"
      />
    )

    const dateLink = screen.getByTitle('View post details')
    expect(dateLink).toHaveAttribute('href', '/post/photo-1')
  })
})