import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import UserSearchBar from '@/components/UserSearchBar'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock ProfilePhotoDisplay
jest.mock('@/components/ProfilePhotoDisplay', () => ({
  default: ({ username }: { username: string }) => (
    <div data-testid={`profile-photo-${username}`}>Photo</div>
  )
}))

// Mock haptic feedback
jest.mock('@/utils/hapticFeedback', () => ({
  createTouchHandlers: () => ({})
}))

// Mock input styles
jest.mock('@/utils/inputStyles', () => ({
  getCompleteInputStyling: () => ({
    className: 'mocked-input-styles',
    style: {}
  })
}))

// Mock keyboard navigation hook
jest.mock('@/hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: () => ({
    setItemRef: () => () => {}
  })
}))

describe('UserSearchBar Mobile Z-Index Fix', () => {
  beforeEach(() => {
    mockPush.mockClear()
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })

    // Mock fetch for search API
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            {
              id: 1,
              username: 'testuser',
              display_name: 'Test User',
              profile_image_url: 'https://example.com/avatar.jpg'
            }
          ]
        }),
      })
    ) as jest.Mock
  })

  describe('Mobile Search Bar Z-Index Layering', () => {
    it('renders mobile search icon with proper touch target', () => {
      render(<UserSearchBar isMobile={true} />)
      
      const searchButton = screen.getByLabelText('Search for users')
      expect(searchButton).toBeInTheDocument()
      expect(searchButton).toHaveClass('min-w-[44px]', 'min-h-[44px]', 'touch-manipulation')
    })

    it('expands mobile search via portal with proper z-index when clicked', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={true} />)
      
      const searchButton = screen.getByLabelText('Search for users')
      await user.click(searchButton)
      
      // Check that portal container is created and search is rendered via portal
      const portalContainer = document.querySelector('[data-portal="mobile-search"]')
      expect(portalContainer).toBeInTheDocument()
      
      // Check that expanded search container is in the portal with proper z-index
      const expandedContainer = document.querySelector('[role="search"][aria-label="Mobile user search"]')
      expect(expandedContainer).toBeInTheDocument()
      expect(expandedContainer).toHaveStyle('z-index: 9999')
    })

    it('expanded mobile search input has proper styling for visibility', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={true} />)
      
      const searchButton = screen.getByLabelText('Search for users')
      await user.click(searchButton)
      
      // Check that the input has enhanced shadow for visibility
      const searchInput = screen.getByPlaceholderText('Search users...')
      expect(searchInput).toHaveClass('shadow-xl')
    })

    it('search dropdown renders in portal with proper z-index when results are shown', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={true} />)
      
      // Expand search
      const searchButton = screen.getByLabelText('Search for users')
      await user.click(searchButton)
      
      // Type to trigger search
      const searchInput = screen.getByPlaceholderText('Search users...')
      await user.type(searchInput, 'test')
      
      // Wait for dropdown to appear in portal
      await waitFor(() => {
        const dropdown = document.querySelector('#mobile-search-results')
        expect(dropdown).toBeInTheDocument()
        expect(dropdown).toHaveStyle('z-index: 9999')
      })
    })

    it('mobile search closes and collapses when close button is clicked', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={true} />)
      
      // Expand search
      const searchButton = screen.getByLabelText('Search for users')
      await user.click(searchButton)
      
      // Find and click close button
      const closeButton = screen.getByLabelText('Close search')
      await user.click(closeButton)
      
      // Check that portal content is removed
      await waitFor(() => {
        const expandedContainer = document.querySelector('[role="search"][aria-label="Mobile user search"]')
        expect(expandedContainer).not.toBeInTheDocument()
      })
    })

    it('mobile search maintains proper positioning on small screens', async () => {
      const user = userEvent.setup()
      
      // Mock small screen viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375, // iPhone SE width
      })
      
      render(<UserSearchBar isMobile={true} />)
      
      const searchButton = screen.getByLabelText('Search for users')
      await user.click(searchButton)
      
      // Check that expanded search uses fixed positioning with proper constraints in portal
      const expandedContainer = document.querySelector('[role="search"][aria-label="Mobile user search"]')
      expect(expandedContainer).toBeInTheDocument()
      expect(expandedContainer).toHaveClass('fixed')
      
      // Check that portal wrapper is hidden on larger screens
      const portalWrapper = expandedContainer?.closest('.sm\\:hidden')
      expect(portalWrapper).toBeInTheDocument()
    })
  })

  describe('Desktop vs Mobile Z-Index Behavior', () => {
    it('desktop search bar does not use portal positioning', () => {
      render(<UserSearchBar isMobile={false} />)
      
      const searchInput = screen.getByPlaceholderText('Search users...')
      expect(searchInput).toBeInTheDocument()
      
      // Desktop search should not create a portal
      const portalContainer = document.querySelector('[data-portal="mobile-search"]')
      expect(portalContainer).not.toBeInTheDocument()
    })

    it('desktop search dropdown uses absolute positioning', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={false} />)
      
      const searchInput = screen.getByPlaceholderText('Search users...')
      await user.type(searchInput, 'test')
      
      await waitFor(() => {
        const dropdown = document.querySelector('[role="listbox"]')
        expect(dropdown).toBeInTheDocument()
        
        // Desktop dropdown should use absolute positioning
        expect(dropdown).toHaveClass('absolute')
      })
    })
  })

  describe('Z-Index Hierarchy Validation', () => {
    it('ensures mobile search portal escapes navbar stacking context', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={true} />)
      
      const searchButton = screen.getByLabelText('Search for users')
      await user.click(searchButton)
      
      // Check that portal container is appended to document.body
      const portalContainer = document.querySelector('[data-portal="mobile-search"]')
      expect(portalContainer).toBeInTheDocument()
      expect(portalContainer?.parentElement).toBe(document.body)
      
      // Portal content should have high z-index since it's outside stacking context
      const expandedContainer = document.querySelector('[role="search"][aria-label="Mobile user search"]')
      expect(expandedContainer).toHaveStyle('z-index: 9999')
    })

    it('ensures search dropdown renders within portal with proper layering', async () => {
      const user = userEvent.setup()
      render(<UserSearchBar isMobile={true} />)
      
      const searchButton = screen.getByLabelText('Search for users')
      await user.click(searchButton)
      
      const searchInput = screen.getByPlaceholderText('Search users...')
      await user.type(searchInput, 'test')
      
      await waitFor(() => {
        const dropdown = document.querySelector('#mobile-search-results')
        expect(dropdown).toBeInTheDocument()
        
        // Dropdown should be within the portal container
        const portalContainer = document.querySelector('[data-portal="mobile-search"]')
        expect(portalContainer?.contains(dropdown)).toBe(true)
        
        // Both search input and dropdown are in same portal with high z-index
        expect(dropdown).toHaveStyle('z-index: 9999')
      })
    })
  })
})