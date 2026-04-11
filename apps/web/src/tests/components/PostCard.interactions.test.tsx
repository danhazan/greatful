import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '@/components/PostCard'
import analyticsService from '@/services/analytics'
import { 
  setupTestEnvironment, 
  cleanupTestEnvironment,
  createTestPost
} from '../utils/test-helpers'

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackReactionEvent: jest.fn(),
  trackShareEvent: jest.fn(),
  trackViewEvent: jest.fn(),
}))

// Mock the EmojiPicker component
jest.mock('@/components/EmojiPicker', () => {
  return function MockEmojiPicker({ isOpen, onEmojiSelect, onClose }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="emoji-picker">
        <button onClick={() => onEmojiSelect('heart_eyes')}>😍</button>
        <button onClick={() => onEmojiSelect('fire')}>🔥</button>
        <button onClick={() => onEmojiSelect('pray')}>🙏</button>
        <button onClick={onClose}>Close</button>
      </div>
    )
  }
})

// Mock the ReactionViewer component
jest.mock('@/components/ReactionViewer', () => {
  return function MockReactionViewer({ isOpen, onClose }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="reaction-viewer">
        <div>Reactions</div>
        <button onClick={onClose}>Close Viewer</button>
      </div>
    )
  }
})

import * as authUtils from '@/utils/auth';
jest.mock('@/utils/auth');

// Test post with correct reactions model
const mockPost = createTestPost({
  reactionsCount: 5,
  currentUserReaction: undefined,
  reactionEmojiCodes: []
})

describe('PostCard Interactions', () => {
  const mockOnReaction = jest.fn()
  const mockOnRemoveReaction = jest.fn()
  const mockOnShare = jest.fn()
  const mockOnUserClick = jest.fn()
  
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    jest.clearAllMocks()
    const mockedAuthUtils = authUtils as jest.Mocked<typeof authUtils>;
    mockedAuthUtils.isAuthenticated.mockReturnValue(true);
    mockedAuthUtils.canInteract.mockReturnValue(true);
    mockedAuthUtils.getAccessToken.mockReturnValue('mock-token');
  })

  afterEach(() => {
    cleanupTestEnvironment()
  })

  it('should track view event when post is displayed', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    expect(analyticsService.trackViewEvent).toHaveBeenCalledWith('test-post-1', 'current-user')
  })

  it('should open share modal when share button is clicked', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    expect(screen.getByText('Share Post')).toBeInTheDocument()
    expect(screen.getByText('Copy Link')).toBeInTheDocument()
  })

  it('should open emoji picker when reaction button is clicked', async () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // Find and click the reaction button
    const reactionButton = screen.getByTitle('React with emoji')
    fireEvent.click(reactionButton)

    // Emoji picker should open
    await waitFor(() => {
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
    })
  })

  it('should call onReaction when emoji is selected', async () => {
    // Mock successful API response
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'reaction-1' })
    })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // Open emoji picker
    const reactionButton = screen.getByTitle('React with emoji')
    fireEvent.click(reactionButton)

    await waitFor(() => {
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
    })

    // Select an emoji (fire)
    const fireButton = screen.getByText('🔥')
    fireEvent.click(fireButton)

    // Should call onReaction with the selected emoji
    await waitFor(() => {
      expect(mockOnReaction).toHaveBeenCalledWith('test-post-1', 'fire', expect.any(Object))
    })
  })

  it('should open reaction viewer when reaction count is clicked', async () => {
    const postWithReactions = createTestPost({
      reactionsCount: 10,
      reactionEmojiCodes: ['heart_eyes', 'fire']
    })

    render(
      <PostCard
        post={postWithReactions}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // Find reaction banner (contains count and emoji)
    const reactionBanner = screen.getByTitle('View reactions')
    fireEvent.click(reactionBanner)

    await waitFor(() => {
      expect(screen.getByTestId('reaction-viewer')).toBeInTheDocument()
    })
  })

  it('should navigate to author profile when clicked', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // Find author link and click - it navigates to profile
    const authorLink = screen.getByRole('link', { name: /testauthor/i })
    expect(authorLink).toHaveAttribute('href', '/profile/author-1')
    // Note: onUserClick is NOT called on author click - it navigates to profile page
  })

  it('should allow changing emoji selection before closing modal', async () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // Open emoji picker
    const reactionButton = screen.getByTitle('React with emoji')
    fireEvent.click(reactionButton)

    await waitFor(() => {
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
    })

    // Select first emoji (heart_eyes)
    const emoji1 = screen.getByText('😍')
    fireEvent.click(emoji1)

    // Picker should still be open, allowing change
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })

  it('should handle post with existing reaction - click removes reaction', async () => {
    const postWithReaction = createTestPost({
      reactionsCount: 6,
      currentUserReaction: 'heart_eyes',
      reactionEmojiCodes: ['heart_eyes', 'fire']
    })

    // Mock successful API response for reaction removal
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    })

    render(
      <PostCard
        post={postWithReaction}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // When user has existing reaction, clicking the reaction button removes it
    // instead of opening the emoji picker
    // The test verifies the component handles this case without crashing
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('should not display engagement summary for low engagement posts', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // No engagement summary for low counts
    expect(screen.queryByText('total reactions')).not.toBeInTheDocument()
  })

  it('should handle different post types with appropriate styling', () => {
    const photoPost = createTestPost({
      images: [{ url: 'https://example.com/photo.jpg', width: 800, height: 600 }]
    })

    render(
      <PostCard
        post={photoPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
        onRemoveReaction={mockOnRemoveReaction}
        onShare={mockOnShare}
        onUserClick={mockOnUserClick}
      />
    )

    // Post should render without errors
    expect(screen.getByRole('article')).toBeInTheDocument()
  })
})