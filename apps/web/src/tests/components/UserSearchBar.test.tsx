import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import UserSearchBar from '@/components/UserSearchBar'

// Mock next/navigation
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  })),
}))

// Mock haptic feedback
jest.mock('@/utils/hapticFeedback', () => ({
  createTouchHandlers: () => ({}),
}))

// Mock ProfilePhotoDisplay
jest.mock('@/components/ProfilePhotoDisplay', () => {
  return function MockProfilePhotoDisplay({ username }: { username: string }) {
    return <div data-testid={`profile-photo-${username}`}>{username[0]}</div>
  }
})

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('UserSearchBar', () => {
  const mockUsers = [
    {
      id: 1,
      username: 'testuser1',
      display_name: 'Test User 1',
      profile_image_url: 'https://example.com/photo1.jpg',
      bio: 'Test bio 1'
    },
    {
      id: 2,
      username: 'testuser2',
      display_name: 'Test User 2',
      profile_image_url: null,
      bio: 'Test bio 2'
    }
  ]



  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockUsers
      })
    })
  })

  it('renders search input with placeholder', () => {
    render(<UserSearchBar placeholder="Search users..." />)
    
    const input = screen.getByPlaceholderText('Search users...')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-label', 'Search for users')
  })

  it('shows loading state when searching', async () => {
    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    
    // Should show loading immediately
    expect(screen.getByText('Searching...')).toBeInTheDocument()
  })

  it('displays search results after debounced search', async () => {
    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    
    // Wait for debounced search (300ms)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/users/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
        body: JSON.stringify({
          query: 'test',
          limit: 10
        }),
      })
    }, { timeout: 500 })

    // Should display search results
    await waitFor(() => {
      expect(screen.getByText('Test User 1')).toBeInTheDocument()
      expect(screen.getByText('@testuser1')).toBeInTheDocument()
      expect(screen.getByText('Test bio 1')).toBeInTheDocument()
    })
  })

  it('handles keyboard navigation', async () => {
    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Test User 1')).toBeInTheDocument()
    })

    // The first result should already be selected (selectedIndex = 0)
    const firstResult = screen.getByRole('option', { name: /Test User 1/ })
    expect(firstResult).toHaveClass('bg-purple-50')
  })

  it('displays clickable user results with proper attributes', async () => {
    render(<UserSearchBar />)
    const input = screen.getByRole('combobox')
    // Type in search query using fireEvent to avoid act warnings
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText('Test User 1')).toBeInTheDocument()
    }, { timeout: 1000 })
    // Get the first result button
    const firstResult = screen.getByRole('option', { name: /Test User 1/ })
    // Verify the dropdown is open and the result is clickable
    expect(firstResult).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'true')
    
    // Verify the result has proper attributes for navigation
    expect(firstResult).toHaveAttribute('type', 'button')
    expect(firstResult).toHaveAttribute('role', 'option')
    expect(firstResult).toHaveAttribute('aria-label', expect.stringContaining('Go to Test User 1\'s profile'))
    
    // Verify the result displays user information correctly
    expect(screen.getByText('Test User 1')).toBeInTheDocument()
    expect(screen.getByText('@testuser1')).toBeInTheDocument()
    expect(screen.getByText('Test bio 1')).toBeInTheDocument()
  })

  it('clears search when clear button is clicked', () => {
    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    
    const clearButton = screen.getByLabelText('Clear search')
    fireEvent.click(clearButton)
    
    expect(input).toHaveValue('')
  })

  it('shows no results message when search returns empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: []
      })
    })

    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'nonexistent' } })
    fireEvent.focus(input)
    
    await waitFor(() => {
      expect(screen.getByText('No users found for "nonexistent"')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'))

    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    
    // Should not crash and should stop loading
    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument()
    })
  })

  it('closes dropdown when clicking outside', async () => {
    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Test User 1')).toBeInTheDocument()
    })

    // Click outside
    fireEvent.mouseDown(document.body)
    
    await waitFor(() => {
      expect(screen.queryByText('Test User 1')).not.toBeInTheDocument()
    })
  })

  it('handles keyboard navigation properly', async () => {
    render(<UserSearchBar />)
    const input = screen.getByRole('combobox')
    // Type in search query using fireEvent to avoid act warnings
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText('Test User 1')).toBeInTheDocument()
    }, { timeout: 1000 })
    // The first result should be selected by default (selectedIndex = 0)
    const firstResult = screen.getByRole('option', { name: /Test User 1/ })
    expect(firstResult).toHaveClass('bg-purple-50')
    expect(firstResult).toHaveAttribute('aria-selected', 'true')
    
    // Verify the dropdown is open
    expect(input).toHaveAttribute('aria-expanded', 'true')
    
    // Test arrow down navigation
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    
    // Second result should now be selected
    await waitFor(() => {
      const secondResult = screen.getByRole('option', { name: /Test User 2/ })
      expect(secondResult).toHaveClass('bg-purple-50')
      expect(secondResult).toHaveAttribute('aria-selected', 'true')
    })
    
    // Test arrow up navigation
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    
    // First result should be selected again
    await waitFor(() => {
      expect(firstResult).toHaveClass('bg-purple-50')
      expect(firstResult).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('handles Escape key to close dropdown', async () => {
    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Test User 1')).toBeInTheDocument()
    })

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })
    
    await waitFor(() => {
      expect(screen.queryByText('Test User 1')).not.toBeInTheDocument()
    })
  })

  it('applies mobile styling when isMobile prop is true', () => {
    render(<UserSearchBar isMobile={true} />)
    
    // In mobile mode, should start collapsed with just a search button
    const searchButton = screen.getByRole('button', { name: 'Search for users' })
    expect(searchButton).toBeInTheDocument()
    
    // Should not show input initially
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<UserSearchBar className="custom-class" />)
    
    const container = screen.getByRole('combobox').closest('div')?.parentElement
    expect(container).toHaveClass('custom-class')
  })

  it('scrolls selected item into view when navigating with keyboard', async () => {
    // Mock scrollIntoView
    const mockScrollIntoView = jest.fn()
    Element.prototype.scrollIntoView = mockScrollIntoView

    // Mock getBoundingClientRect to simulate item being out of view
    const mockGetBoundingClientRect = jest.fn()
    Element.prototype.getBoundingClientRect = mockGetBoundingClientRect

    // Mock container rect (dropdown)
    mockGetBoundingClientRect.mockImplementation(function(this: Element) {
      if (this.classList.contains('max-h-60')) {
        // Container rect
        return {
          top: 100,
          bottom: 300,
          left: 0,
          right: 200,
          width: 200,
          height: 200
        }
      }
      // Item rect - simulate item being below visible area
      return {
        top: 350,
        bottom: 400,
        left: 0,
        right: 200,
        width: 200,
        height: 50
      }
    })

    render(<UserSearchBar />)
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.focus(input)
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Test User 1')).toBeInTheDocument()
    })

    // Navigate down with arrow key to select the second item
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    
    // Wait a bit for the effect to run
    await waitFor(() => {
      // The second user should be selected (aria-selected="true")
      const secondUser = screen.getByRole('option', { name: /Test User 2/ })
      expect(secondUser).toHaveAttribute('aria-selected', 'true')
    })
    
    // Should call scrollIntoView on the selected element
    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }, { timeout: 1000 })
  })

  it('renders mobile icon-only mode when isMobile=true and no placeholder', () => {
    render(<UserSearchBar isMobile={true} placeholder="" />)
    
    // Should show search icon button in collapsed state
    const searchButton = screen.getByRole('button', { name: 'Search for users' })
    expect(searchButton).toBeInTheDocument()
    expect(searchButton).toHaveAttribute('type', 'button')
    
    // Should not have input visible initially (collapsed state)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('expands mobile search when icon is clicked', async () => {
    render(<UserSearchBar isMobile={true} placeholder="" />)
    
    // Initially collapsed - only button visible
    const searchButton = screen.getByRole('button', { name: 'Search for users' })
    expect(searchButton).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    
    // Click to expand
    fireEvent.click(searchButton)
    
    // Should now show the input
    await waitFor(() => {
      const input = screen.getByRole('combobox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('min-h-[44px]') // Mobile expanded styling
    })
  })
})