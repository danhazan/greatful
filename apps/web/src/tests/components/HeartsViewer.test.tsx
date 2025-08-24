import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import HeartsViewer from '../../components/HeartsViewer'
import { describe, it, beforeEach } from '@jest/globals'

// Mock hearts data
const mockHearts = [
  {
    id: '1',
    userId: '1',
    userName: 'john_doe',
    userImage: 'https://example.com/john.jpg',
    createdAt: '2024-01-15T10:30:45Z'
  },
  {
    id: '2',
    userId: '2',
    userName: 'jane_smith',
    userImage: 'https://example.com/jane.jpg',
    createdAt: '2024-01-15T11:15:30Z'
  },
  {
    id: '3',
    userId: '3',
    userName: 'bob_wilson',
    userImage: undefined,
    createdAt: '2024-01-15T12:45:15Z'
  }
]

describe('HeartsViewer', () => {
  const mockOnClose = jest.fn()
  const mockOnUserClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <HeartsViewer
        isOpen={false}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    expect(screen.queryByText('Hearts')).not.toBeInTheDocument()
  })

  it('should render modal when isOpen is true', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    expect(screen.getByText('Hearts (3)')).toBeInTheDocument()
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument()
  })

  it('should display all hearts with user information', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    // Should show all users
    expect(screen.getByText('john_doe')).toBeInTheDocument()
    expect(screen.getByText('jane_smith')).toBeInTheDocument()
    expect(screen.getByText('bob_wilson')).toBeInTheDocument()
  })

  it('should show user profile images when available', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    const profileImages = screen.getAllByRole('img')
    expect(profileImages).toHaveLength(2) // 2 users have profile images
    
    expect(profileImages[0]).toHaveAttribute('src', 'https://example.com/john.jpg')
    expect(profileImages[1]).toHaveAttribute('src', 'https://example.com/jane.jpg')
  })

  it('should show default avatar for users without profile images', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
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

  it('should display time ago format for each heart', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    // Should show time ago format (e.g., "2m", "1h", "3d")
    // Since the mock dates are from 2024 and we're testing in current time,
    // they should show as time ago format
    const timeElements = screen.getAllByText(/\d+[smhdwy]/)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('should call onUserClick when user is clicked', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    const johnButton = screen.getByText('john_doe').closest('div')
    fireEvent.click(johnButton!)

    expect(mockOnUserClick).toHaveBeenCalledWith(1) // user ID as number
  })

  it('should call onClose when close button is clicked', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    const closeButton = screen.getByLabelText('Close modal')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should call onClose when backdrop is clicked', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    // Click outside the modal to trigger close
    const modalContainer = document.querySelector('.fixed.inset-0.flex.items-center')
    fireEvent.mouseDown(modalContainer!)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle empty hearts array', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={[]}
        onUserClick={mockOnUserClick}
      />
    )

    expect(screen.getByText(/Hearts \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('No hearts yet')).toBeInTheDocument()
    expect(screen.getByText('Be the first to heart this post!')).toBeInTheDocument()
  })

  it('should handle keyboard navigation', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    // Test Escape key
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show heart icons for each user', () => {
    render(
      <HeartsViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="test-post"
        hearts={mockHearts}
        onUserClick={mockOnUserClick}
      />
    )

    // Should have heart icons (one in header, one for each user)
    const heartIcons = document.querySelectorAll('.lucide-heart')
    expect(heartIcons.length).toBeGreaterThan(0)
  })
})