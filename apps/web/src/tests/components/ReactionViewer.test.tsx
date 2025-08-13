import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReactionViewer from '@/components/ReactionViewer'

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('ReactionViewer', () => {
  const mockOnClose = jest.fn()
  const mockOnUserClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockReactions = [
    {
      id: '1',
      userId: '1',
      userName: 'John Doe',
      userImage: 'https://example.com/john.jpg',
      emojiCode: 'heart_eyes',
      createdAt: '2025-01-08T12:00:00Z'
    },
    {
      id: '2',
      userId: '2',
      userName: 'Jane Smith',
      emojiCode: 'fire',
      createdAt: '2025-01-08T11:00:00Z'
    },
    {
      id: '3',
      userId: '3',
      userName: 'Bob Johnson',
      emojiCode: 'heart_eyes',
      createdAt: '2025-01-08T10:00:00Z'
    }
  ]

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    postId: 'post-123',
    reactions: mockReactions,
    onUserClick: mockOnUserClick,
  }

  it('renders when open', () => {
    render(<ReactionViewer {...defaultProps} />)
    
    expect(screen.getByText('Reactions (3)')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ReactionViewer {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Reactions (3)')).not.toBeInTheDocument()
  })

  it('groups reactions by emoji', () => {
    render(<ReactionViewer {...defaultProps} />)
    
    // Should show both emojis
    expect(screen.getAllByText('😍')).toHaveLength(3) // Header + 2 user reactions
    expect(screen.getAllByText('🔥')).toHaveLength(2) // Header + 1 user reaction
    
    // Should show correct counts
    expect(screen.getByText('2')).toBeInTheDocument() // Heart eyes count
    expect(screen.getByText('1')).toBeInTheDocument() // Fire count
  })

  it('displays user avatars correctly', () => {
    render(<ReactionViewer {...defaultProps} />)
    
    // John has an image
    const johnImage = screen.getByAltText('John Doe')
    expect(johnImage).toHaveAttribute('src', 'https://example.com/john.jpg')
    
    // Jane doesn't have an image, should show initials
    expect(screen.getByText('J')).toBeInTheDocument() // Jane's initial
    expect(screen.getByText('B')).toBeInTheDocument() // Bob's initial
  })

  it('displays formatted dates', () => {
    render(<ReactionViewer {...defaultProps} />)
    
    // Should show formatted dates (multiple instances)
    expect(screen.getAllByText('1/8/2025')).toHaveLength(3)
  })

  it('handles user clicks', async () => {
    const user = userEvent.setup()
    render(<ReactionViewer {...defaultProps} />)
    
    const johnReaction = screen.getByText('John Doe').closest('div')!
    await user.click(johnReaction)
    
    expect(mockOnUserClick).toHaveBeenCalledWith(1)
  })

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<ReactionViewer {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close modal')
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes when Close button is clicked', async () => {
    const user = userEvent.setup()
    render(<ReactionViewer {...defaultProps} />)
    
    const closeButton = screen.getByText('Close')
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes when escape key is pressed', () => {
    render(<ReactionViewer {...defaultProps} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('shows empty state when no reactions', () => {
    render(<ReactionViewer {...defaultProps} reactions={[]} />)
    
    expect(screen.getByText('Reactions (0)')).toBeInTheDocument()
    expect(screen.getByText('No reactions yet')).toBeInTheDocument()
    expect(screen.getByText('Be the first to react!')).toBeInTheDocument()
  })

  it('displays correct emoji count for each group', () => {
    render(<ReactionViewer {...defaultProps} />)
    
    // Should show the counts
    expect(screen.getByText('2')).toBeInTheDocument() // Heart eyes count
    expect(screen.getByText('1')).toBeInTheDocument() // Fire count
  })

  it('handles reactions with unknown emoji codes', () => {
    const reactionsWithUnknown = [
      {
        id: '1',
        userId: '1',
        userName: 'John Doe',
        emojiCode: 'unknown_emoji',
        createdAt: '2025-01-08T12:00:00Z'
      }
    ]

    render(<ReactionViewer {...defaultProps} reactions={reactionsWithUnknown} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    // Should fallback to the emoji code itself (appears twice - header and user reaction)
    expect(screen.getAllByText('unknown_emoji')).toHaveLength(2)
  })

  it('handles long user names with truncation', () => {
    const reactionsWithLongName = [
      {
        id: '1',
        userId: '1',
        userName: 'This is a very long user name that should be truncated',
        emojiCode: 'heart_eyes',
        createdAt: '2025-01-08T12:00:00Z'
      }
    ]

    render(<ReactionViewer {...defaultProps} reactions={reactionsWithLongName} />)
    
    const userName = screen.getByText('This is a very long user name that should be truncated')
    expect(userName).toHaveClass('truncate')
  })

  it('closes when clicking outside the modal', async () => {
    const user = userEvent.setup()
    render(<ReactionViewer {...defaultProps} />)
    
    // Click on the backdrop
    const backdrop = document.querySelector('.fixed.inset-0.bg-black')!
    await user.click(backdrop)
    
    expect(mockOnClose).toHaveBeenCalled()
  })
})