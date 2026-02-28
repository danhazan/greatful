import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import MentionAutocomplete from '@/components/MentionAutocomplete'

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

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    
    // Mock successful API response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [
          {
            id: 1,
            username: 'testuser',
            display_name: 'Test User',
            profile_image_url: 'https://example.com/test.jpg',
            bio: 'Test bio'
          }
        ],
      }),
    } as Response)
  })

  // Simplified tests - just test basic rendering
  it('renders nothing when isOpen is false', () => {
    render(<MentionAutocomplete {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Searching...')).not.toBeInTheDocument()
  })

  it('renders loading state when open', async () => {
    render(<MentionAutocomplete {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Searching...')).toBeInTheDocument()
    })
  })

  it('applies correct positioning styles', () => {
    const { container } = render(<MentionAutocomplete {...defaultProps} />)
    
    const dropdown = container.querySelector('[data-mention-autocomplete]')
    expect(dropdown).toBeInTheDocument()
    expect(dropdown).toHaveStyle('left: 100px')
    expect(dropdown).toHaveStyle('top: 200px')
  })

  it('applies custom className', () => {
    const { container } = render(
      <MentionAutocomplete {...defaultProps} className="custom-class" />
    )
    
    const dropdown = container.querySelector('.custom-class')
    expect(dropdown).toBeInTheDocument()
  })

  it('renders canonical user search row fields', async () => {
    render(<MentionAutocomplete {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('@testuser')).toBeInTheDocument()
      expect(screen.getByText('Test bio')).toBeInTheDocument()
    }, { timeout: 1000 })
  })
})
