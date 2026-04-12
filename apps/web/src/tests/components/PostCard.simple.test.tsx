import { render, screen } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'
import { describe, it } from '@jest/globals'

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackReactionEvent: jest.fn(),
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackShareEvent: jest.fn(),
}))

// Mock the emoji mapping utility
jest.mock('@/utils/emojiMapping', () => ({
  getEmojiFromCode: jest.fn((code) => {
    const mapping: {[key: string]: string} = {
      'heart': '💜',
      'heart_eyes': '😍',
      'joy': '😂',
      'thinking': '🤔',
      'fire': '🔥',
      'pray': '🙏'
    }
    return mapping[code] || '😊'
  }),
  getAvailableEmojis: jest.fn(() => [
    { code: 'heart', emoji: '💜', label: 'Heart' },
    { code: 'heart_face', emoji: '😍', label: 'Love it' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
    { code: 'pray', emoji: '🙏', label: 'Grateful' },
    { code: 'muscle', emoji: '💪', label: 'Strong' },
    { code: 'clap', emoji: '👏', label: 'Applause' },
    { code: 'joy', emoji: '😂', label: 'Funny' },
    { code: 'star', emoji: '⭐', label: 'Amazing' }
  ]),
}))

// Mock the auth utilities
jest.mock('@/utils/auth', () => ({
  isAuthenticated: jest.fn(() => true),
  canInteract: jest.fn(() => true),
  getAccessToken: jest.fn(() => 'mock-token'),
}))

// Mock the image utilities
jest.mock('@/utils/imageUtils', () => ({
  getImageUrl: jest.fn((url) => url),
}))

const mockPost = {
  id: 'test-post-1',
  content: 'Test post content',
  author: {
    id: 'author-1',
    name: 'Test Author',
    username: 'testauthor',
    image: 'https://example.com/avatar.jpg',
  },
  createdAt: new Date().toISOString(),
  reactionsCount: 5,
  currentUserReaction: undefined,
  reactionEmojiCodes: [],
}

describe('PostCard Simple Tests', () => {
  it('should render post content correctly', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    expect(screen.getByText('Test post content')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })

  it('should render post in article element', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    expect(screen.getByRole('article')).toBeInTheDocument()
  })
})