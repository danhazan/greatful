import { render, screen } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import { describe, expect, it } from '@jest/globals'
import PostCard from '@/components/PostCard'

jest.mock('@/services/analytics', () => ({
  trackReactionEvent: jest.fn(),
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackShareEvent: jest.fn(),
}))

jest.mock('@/utils/auth', () => ({
  isAuthenticated: jest.fn(() => true),
  canInteract: jest.fn(() => true),
  getAccessToken: jest.fn(() => 'mock-token'),
}))

jest.mock('@/utils/imageUtils', () => ({
  getImageUrl: jest.fn((url) => url),
}))

const privacyPost = {
  id: 'privacy-post-1',
  content: 'Privacy indicator test',
  author: {
    id: 'author-1',
    name: 'Author',
    username: 'author',
    image: 'https://example.com/avatar.jpg',
  },
  createdAt: new Date().toISOString(),
  reactionsCount: 1,
  privacyLevel: 'custom' as const,
  privacyRules: ['followers', 'specific_users'],
  specificUsers: [2],
}

describe('PostCard privacy indicator', () => {
  it('shows privacy indicator for author', () => {
    render(<PostCard post={privacyPost as any} currentUserId="author-1" />)
    expect(screen.getByLabelText('Followers and 1 User')).toBeInTheDocument()
  })

  it('does not show privacy indicator for non-authors', () => {
    render(<PostCard post={privacyPost as any} currentUserId="viewer-2" />)
    expect(screen.queryByLabelText('Followers and 1 User')).not.toBeInTheDocument()
  })
})
