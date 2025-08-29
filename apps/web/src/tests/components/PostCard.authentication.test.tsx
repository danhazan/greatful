import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PostCard from '@/components/PostCard'
import * as authUtils from '@/utils/auth'

// Mock the auth utilities
jest.mock('@/utils/auth', () => ({
  isAuthenticated: jest.fn(),
  getAccessToken: jest.fn(),
  canInteract: jest.fn(),
}))

// Mock analytics service
jest.mock('@/services/analytics', () => ({
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackReactionEvent: jest.fn(),
  trackShareEvent: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

const mockPost = {
  id: 'test-post-1',
  content: 'Test gratitude post content',
  author: {
    id: '1',
    name: 'Test User',
    image: 'https://example.com/avatar.jpg',
  },
  createdAt: '2025-01-08T10:00:00Z',
  postType: 'daily' as const,
  heartsCount: 5,
  reactionsCount: 3,
  isHearted: false,
  currentUserReaction: undefined,
}

const mockHandlers = {
  onHeart: jest.fn(),
  onReaction: jest.fn(),
  onRemoveReaction: jest.fn(),
  onShare: jest.fn(),
  onUserClick: jest.fn(),
}

describe('PostCard Authentication Controls', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(false)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue(null)
      ;(authUtils.canInteract as jest.Mock).mockReturnValue(false)
    })

    it('should show authentication notice', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      expect(screen.getByText('Join to interact with this post')).toBeInTheDocument()
      expect(screen.getByText('Log In')).toBeInTheDocument()
      expect(screen.getByText('Sign Up')).toBeInTheDocument()
    })

    it('should show counters but with disabled styling', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      // Heart button should have disabled styling
      const heartButton = screen.getByTitle('Login to like posts')
      expect(heartButton).toHaveClass('text-gray-400')
      expect(heartButton).toBeInTheDocument()
      
      // Reaction button should have disabled styling
      const reactionButton = screen.getByTitle('Login to react to posts')
      expect(reactionButton).toHaveClass('text-gray-400')
      expect(reactionButton).toBeInTheDocument()
    })

    it('should call handlers when trying to interact (for redirect handling)', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      // Click heart button
      const heartButton = screen.getByTitle('Login to like posts')
      fireEvent.click(heartButton)
      
      expect(mockHandlers.onHeart).toHaveBeenCalledWith('test-post-1', false)
    })

    it('should call reaction handler when trying to react (for redirect handling)', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      // Click reaction button
      const reactionButton = screen.getByTitle('Login to react to posts')
      fireEvent.click(reactionButton)
      
      expect(mockHandlers.onReaction).toHaveBeenCalledWith('test-post-1', 'heart_eyes')
    })

    it('should not show user-specific interaction states', () => {
      const heartedPost = { ...mockPost, isHearted: true, currentUserReaction: 'heart_eyes' }
      render(<PostCard post={heartedPost} {...mockHandlers} />)
      
      // Heart should not be filled for unauthenticated users
      const heartButton = screen.getByTitle('Login to like posts')
      const heartIcon = heartButton.querySelector('svg')
      expect(heartIcon).not.toHaveClass('fill-current')
    })

    it('should allow sharing (sharing is public)', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      const shareButton = screen.getByRole('button', { name: /share/i })
      expect(shareButton).not.toHaveClass('text-gray-400')
      expect(shareButton).not.toHaveAttribute('disabled')
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue('mock-token')
      ;(authUtils.canInteract as jest.Mock).mockReturnValue(true)
    })

    it('should not show authentication notice', () => {
      render(<PostCard post={mockPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
    })

    it('should enable interactions with proper styling', () => {
      render(<PostCard post={mockPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      // Should not show authentication notice
      expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
      
      // Heart button should not have disabled styling
      const heartButton = screen.queryByTitle('Login to like posts')
      expect(heartButton).not.toBeInTheDocument()
      
      // Reaction button should not have disabled styling
      const reactionButton = screen.queryByTitle('Login to react to posts')
      expect(reactionButton).not.toBeInTheDocument()
    })

    it('should show user-specific interaction states', () => {
      const heartedPost = { ...mockPost, isHearted: true }
      render(<PostCard post={heartedPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      // Heart should be filled for authenticated users who hearted the post
      const heartButtons = screen.getAllByRole('button')
      const heartButton = heartButtons.find(button => 
        button.querySelector('svg.lucide-heart')
      )
      const heartIcon = heartButton?.querySelector('svg')
      expect(heartIcon).toHaveClass('fill-current')
    })

    it('should make API calls when interacting', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      render(<PostCard post={mockPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      // Find heart button by looking for buttons that contain heart icon
      const buttons = screen.getAllByRole('button')
      const heartButton = buttons.find(button => {
        const svg = button.querySelector('svg')
        return svg && svg.classList.contains('lucide-heart')
      })
      
      expect(heartButton).toBeInTheDocument()
      
      if (heartButton) {
        fireEvent.click(heartButton)
        
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/heart', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json',
            },
          })
        })
      }
    })
  })

  describe('authentication state changes', () => {
    it('should update UI when authentication state changes', () => {
      const { rerender } = render(<PostCard post={mockPost} {...mockHandlers} />)
      
      // Initially not authenticated
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(false)
      expect(screen.getByText('Join to interact with this post')).toBeInTheDocument()
      
      // Simulate authentication
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue('mock-token')
      
      rerender(<PostCard post={mockPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
    })
  })
})