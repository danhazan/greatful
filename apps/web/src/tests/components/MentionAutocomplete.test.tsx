import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import MentionAutocomplete from '@/components/MentionAutocomplete'
import { UserInfo } from '@/../../shared/types/core'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>

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

describe('MentionAutocomplete', () => {
  const mockOnUserSelect = jest.fn()
  const mockOnClose = jest.fn()
  
  const defaultProps = {
    isOpen: true,
    searchQuery: 'test',
    onUserSelect: mockOnUserSelect,
    onClose: mockOnClose,
    position: { x: 100, y: 200 },
  }

  const mockUsers = [
    {
      id: 1,
      username: 'testuser1',
      profile_image_url: 'https://example.com/avatar1.jpg',
      bio: 'Test user 1 bio',
    },
    {
      id: 2,
      username: 'testuser2',
      profile_image_url: null,
      bio: 'Test user 2 bio',
    },
    {
      id: 3,
      username: 'testuser3',
      profile_image_url: 'https://example.com/avatar3.jpg',
      bio: null,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    
    // Mock successful API response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockUsers,
      }),
    } as Response)
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(<MentionAutocomplete {...defaultProps} isOpen={false} />)
      
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument()
      expect(screen.queryByText('Type to search for users...')).not.toBeInTheDocument()
    })

    it('renders loading state initially', async () => {
      jest.useFakeTimers()
      
      render(<MentionAutocomplete {...defaultProps} />)
      
      expect(screen.getByText('Searching...')).toBeInTheDocument()
      
      // Advance timers to trigger the search
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      // Wait for the search to complete
      await waitFor(() => {
        expect(screen.queryByText('Searching...')).not.toBeInTheDocument()
      })
      
      jest.useRealTimers()
    })

    it('renders empty state when no query provided', async () => {
      render(<MentionAutocomplete {...defaultProps} searchQuery="" />)
      
      await waitFor(() => {
        expect(screen.getByText('Type to search for users...')).toBeInTheDocument()
      })
    })

    it('renders no results message when search returns empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [],
        }),
      } as Response)

      render(<MentionAutocomplete {...defaultProps} searchQuery="nonexistent" />)
      
      await waitFor(() => {
        expect(screen.getByText('No users found for "nonexistent"')).toBeInTheDocument()
      })
    })

    it('renders user list when search returns results', async () => {
      jest.useFakeTimers()
      
      render(<MentionAutocomplete {...defaultProps} />)
      
      // Advance timers to trigger the search
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
        expect(screen.getByText('@testuser2')).toBeInTheDocument()
        expect(screen.getByText('@testuser3')).toBeInTheDocument()
      })
      
      jest.useRealTimers()
    })

    it('displays user avatars and bios correctly', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        // Check avatar images
        const avatar1 = screen.getByAltText('testuser1')
        expect(avatar1).toHaveAttribute('src', 'https://example.com/avatar1.jpg')
        
        // Check fallback avatar for user without image
        expect(screen.getByText('T')).toBeInTheDocument() // First letter of testuser2
        
        // Check bios
        expect(screen.getByText('Test user 1 bio')).toBeInTheDocument()
        expect(screen.getByText('Test user 2 bio')).toBeInTheDocument()
      })
    })

    it('applies correct positioning styles', () => {
      const { container } = render(<MentionAutocomplete {...defaultProps} />)
      
      const dropdown = container.querySelector('div[style*="left: 100px"]')
      expect(dropdown).toBeInTheDocument()
      expect(dropdown).toHaveStyle('top: 200px')
    })
  })

  describe('Search Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('debounces search requests with 300ms delay', async () => {
      const { rerender } = render(<MentionAutocomplete {...defaultProps} searchQuery="t" />)
      
      // Change query multiple times quickly
      rerender(<MentionAutocomplete {...defaultProps} searchQuery="te" />)
      rerender(<MentionAutocomplete {...defaultProps} searchQuery="tes" />)
      rerender(<MentionAutocomplete {...defaultProps} searchQuery="test" />)
      
      // Should not have called fetch yet
      expect(mockFetch).not.toHaveBeenCalled()
      
      // Fast-forward 300ms
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      // Should have called fetch only once with the final query
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(mockFetch).toHaveBeenCalledWith('/api/users/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
          body: JSON.stringify({
            query: 'test',
            limit: 10,
          }),
        })
      })
    })

    it('removes @ symbol from search query', async () => {
      render(<MentionAutocomplete {...defaultProps} searchQuery="@testuser" />)
      
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/search', 
          expect.objectContaining({
            body: JSON.stringify({
              query: 'testuser', // @ should be removed
              limit: 10,
            }),
          })
        )
      })
    })

    it('handles API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<MentionAutocomplete {...defaultProps} />)
      
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      await waitFor(() => {
        expect(screen.getByText('No users found for "test"')).toBeInTheDocument()
      })
    })

    it('handles missing auth token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      render(<MentionAutocomplete {...defaultProps} />)
      
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })

    it('does not search for empty or very short queries', async () => {
      const { rerender } = render(<MentionAutocomplete {...defaultProps} searchQuery="" />)
      
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      expect(mockFetch).not.toHaveBeenCalled()
      
      // Reset mock call count
      mockFetch.mockClear()
      
      // Test with whitespace only
      rerender(<MentionAutocomplete {...defaultProps} searchQuery="   " />)
      
      act(() => {
        jest.advanceTimersByTime(300)
      })
      
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('User Interaction', () => {
    it('calls onUserSelect when user is clicked', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('@testuser1'))
      
      expect(mockOnUserSelect).toHaveBeenCalledWith({
        id: 1,
        username: 'testuser1',
        profile_image_url: 'https://example.com/avatar1.jpg',
        bio: 'Test user 1 bio',
      })
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('updates selected index on mouse hover', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser2')).toBeInTheDocument()
      })
      
      const user2Button = screen.getByText('@testuser2').closest('button')
      fireEvent.mouseEnter(user2Button!)
      
      // The hovered item should have the selected background
      expect(user2Button).toHaveClass('bg-purple-50')
    })

    it('closes dropdown when clicking outside', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      // Click outside the dropdown
      fireEvent.mouseDown(document.body)
      
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Keyboard Navigation', () => {
    it('navigates with arrow keys', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      // First item should be selected by default
      const firstButton = screen.getByText('@testuser1').closest('button')
      expect(firstButton).toHaveClass('bg-purple-50')
      
      // Press arrow down
      fireEvent.keyDown(document, { key: 'ArrowDown' })
      
      // Second item should be selected
      const secondButton = screen.getByText('@testuser2').closest('button')
      expect(secondButton).toHaveClass('bg-purple-50')
      
      // Press arrow up
      fireEvent.keyDown(document, { key: 'ArrowUp' })
      
      // First item should be selected again
      expect(firstButton).toHaveClass('bg-purple-50')
    })

    it('wraps around when navigating past boundaries', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      // Press arrow up from first item (should wrap to last)
      fireEvent.keyDown(document, { key: 'ArrowUp' })
      
      const lastButton = screen.getByText('@testuser3').closest('button')
      expect(lastButton).toHaveClass('bg-purple-50')
      
      // Press arrow down from last item (should wrap to first)
      fireEvent.keyDown(document, { key: 'ArrowDown' })
      
      const firstButton = screen.getByText('@testuser1').closest('button')
      expect(firstButton).toHaveClass('bg-purple-50')
    })

    it('selects user with Enter key', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      // Navigate to second user
      fireEvent.keyDown(document, { key: 'ArrowDown' })
      
      // Press Enter
      fireEvent.keyDown(document, { key: 'Enter' })
      
      expect(mockOnUserSelect).toHaveBeenCalledWith({
        id: 2,
        username: 'testuser2',
        profile_image_url: null,
        bio: 'Test user 2 bio',
      })
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('closes dropdown with Escape key', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('ignores keyboard events when dropdown is closed', () => {
      render(<MentionAutocomplete {...defaultProps} isOpen={false} />)
      
      fireEvent.keyDown(document, { key: 'ArrowDown' })
      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(mockOnUserSelect).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })

    it('supports focus management', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      const firstButton = screen.getByText('@testuser1').closest('button')
      firstButton?.focus()
      
      expect(document.activeElement).toBe(firstButton)
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <MentionAutocomplete {...defaultProps} className="custom-class" />
      )
      
      const dropdown = container.querySelector('.custom-class')
      expect(dropdown).toBeInTheDocument()
    })

    it('has consistent purple theme styling', async () => {
      render(<MentionAutocomplete {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('@testuser1')).toBeInTheDocument()
      })
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('hover:bg-purple-50')
        expect(button).toHaveClass('focus:bg-purple-50')
      })
    })
  })
})