import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ReactionViewer from '../../components/ReactionViewer'
import { describe, it, beforeEach } from '@jest/globals'

// Mock reactions data - transformed to match ReactionViewer expected format
const mockReactions = [
  {
    id: '1',
    userId: '1',
    userName: 'john_doe',
    userImage: 'https://example.com/john.jpg',
    emojiCode: 'heart_eyes',
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    userId: '2',
    userName: 'jane_smith',
    userImage: 'https://example.com/jane.jpg',
    emojiCode: 'heart_eyes',
    createdAt: '2024-01-15T11:00:00Z'
  },
  {
    id: '3',
    userId: '3',
    userName: 'bob_wilson',
    userImage: undefined,
    emojiCode: 'fire',
    createdAt: '2024-01-15T12:00:00Z'
  },
  {
    id: '4',
    userId: '4',
    userName: 'alice_brown',
    userImage: 'https://example.com/alice.jpg',
    emojiCode: 'pray',
    createdAt: '2024-01-15T13:00:00Z'
  }
]

describe('ReactionViewer', () => {
  const mockOnClose = jest.fn()
  const mockOnUserClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <ReactionViewer
        isOpen={false}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    expect(screen.queryByText('Reactions')).not.toBeInTheDocument()
  })

  it('should render modal when isOpen is true', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    expect(screen.getByText('Reactions (4)')).toBeInTheDocument()
    // Check that the modal content is displayed
    expect(screen.getAllByLabelText('Close reactions modal')).toHaveLength(2) // Header X button and footer Close button
  })

  it('should display reactions grouped by emoji', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    // Should show heart_eyes group with 2 users
    expect(screen.getAllByText('😍')).toHaveLength(3) // One in header, two in individual reactions
    expect(screen.getByText('john_doe')).toBeInTheDocument()
    expect(screen.getByText('jane_smith')).toBeInTheDocument()

    // Should show fire group with 1 user
    expect(screen.getAllByText('🔥')).toHaveLength(2) // One in header, one in individual reaction
    expect(screen.getByText('bob_wilson')).toBeInTheDocument()

    // Should show pray group with 1 user
    expect(screen.getAllByText('🙏')).toHaveLength(2) // One in header, one in individual reaction
    expect(screen.getByText('alice_brown')).toBeInTheDocument()
  })

  it('should show user profile images when available', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    const profileImages = screen.getAllByRole('img')
    expect(profileImages).toHaveLength(3) // 3 users have profile images
    
    expect(profileImages[0]).toHaveAttribute('src', 'https://example.com/john.jpg')
    expect(profileImages[1]).toHaveAttribute('src', 'https://example.com/jane.jpg')
    expect(profileImages[2]).toHaveAttribute('src', 'https://example.com/alice.jpg')
  })

  it('should show default avatar for users without profile images', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    // Bob Wilson doesn't have a profile image, should show default avatar
    const bobElement = screen.getByText('bob_wilson').closest('div')
    expect(bobElement).toBeInTheDocument()
    
    // Should have a div with the first letter of username as fallback
    const avatarFallback = screen.getByText('B')
    expect(avatarFallback).toBeInTheDocument()
  })

  it('should call onUserClick when user is clicked', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    const johnButton = screen.getByText('john_doe').closest('div')
    fireEvent.click(johnButton!)

    expect(mockOnUserClick).toHaveBeenCalledWith(1) // user ID as number
  })

  it('should call onClose when close button is clicked', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    const closeButtons = screen.getAllByLabelText('Close reactions modal')
    fireEvent.click(closeButtons[0]) // Click the first close button (X in header)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should call onClose when backdrop is clicked', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    // Click outside the modal to trigger close (using mousedown as that's what the component listens for)
    const modalContainer = document.querySelector('.fixed.inset-0.flex.items-center')
    fireEvent.mouseDown(modalContainer!)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle empty reactions array', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={[]}
        onUserClick={mockOnUserClick}
      />
    )

    expect(screen.getByText(/Reactions \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('No reactions yet')).toBeInTheDocument()
  })

  it('should group reactions correctly by emoji type', () => {
    const mixedReactions = [
      ...mockReactions,
      {
        id: '5',
        userId: '5',
        userName: 'user5',
        userImage: undefined,
        emojiCode: 'heart_eyes',
        createdAt: '2024-01-15T14:00:00Z'
      }
    ]

    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mixedReactions}
        onUserClick={mockOnUserClick}
      />
    )

    // Should have 3 heart_eyes reactions now - use getAllByText to get all instances
    const heartEyesEmojis = screen.getAllByText('😍')
    expect(heartEyesEmojis.length).toBeGreaterThan(0)
    
    // Should show all 3 users in heart_eyes group
    expect(screen.getByText('john_doe')).toBeInTheDocument()
    expect(screen.getByText('jane_smith')).toBeInTheDocument()
    expect(screen.getByText('user5')).toBeInTheDocument()
  })

  it('should handle keyboard navigation', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    const modal = screen.getByText('Reactions (4)').closest('div')
    
    // Test Escape key - fire on document since that's where the listener is
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should display reaction counts per emoji', () => {
    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        reactions={mockReactions}
        onUserClick={mockOnUserClick}
      />
    )

    // Should show count for heart_eyes (2 users) - look for the count specifically
    expect(screen.getByText('2 reactions')).toBeInTheDocument()

    // Should show count for fire (1 user)
    const fireEmojis = screen.getAllByText('🔥')
    expect(fireEmojis).toHaveLength(2) // One in header, one in individual reaction

    // Should show count for pray (1 user)
    const prayEmojis = screen.getAllByText('🙏')
    expect(prayEmojis).toHaveLength(2) // One in header, one in individual reaction
    
    // Should have two instances of "1 reaction" for fire and pray
    expect(screen.getAllByText('1 reaction')).toHaveLength(2)
  })
})