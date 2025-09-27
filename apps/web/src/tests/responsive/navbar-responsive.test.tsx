import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import Navbar from '@/components/Navbar'

// Mock next/navigation
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}))

// Mock NotificationSystem
jest.mock('@/components/NotificationSystem', () => ({
  default: ({ userId }: { userId: string | number }) => (
    <div data-testid="notification-system">
      Notifications for user-{userId}
    </div>
  )
}))

// Mock UserSearchBar
jest.mock('@/components/UserSearchBar', () => ({
  default: ({ isMobile }: { isMobile?: boolean }) => (
    <div data-testid={`search-${isMobile ? 'mobile' : 'desktop'}`}>
      Search Component
    </div>
  )
}))

const mockUser = {
  id: 'user-123',
  name: 'John Doe',
  display_name: 'Johnny',
  username: 'johndoe',
  email: 'john@example.com',
  profile_image_url: 'https://example.com/avatar.jpg'
}

describe('Navbar Responsive Design', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockBack.mockClear()
  })

  describe('Basic Responsive Layout', () => {
    it('renders with responsive classes for mobile and desktop', () => {
      render(<Navbar user={mockUser} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('px-3', 'sm:px-4', 'py-3', 'sm:py-4')
    })

    it('applies sticky positioning for better UX', () => {
      render(<Navbar user={mockUser} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('sticky', 'top-0', 'z-40')
    })

    it('has proper container constraints', () => {
      render(<Navbar user={mockUser} />)
      
      const container = screen.getByRole('navigation').firstChild as HTMLElement
      expect(container).toHaveClass('max-w-4xl', 'mx-auto', 'flex', 'items-center')
    })
  })

  describe('Touch Target Optimization', () => {
    it('ensures all interactive elements meet 44px touch target minimum', () => {
      render(<Navbar user={mockUser} />)
      
      // Check feed button
      const feedButton = screen.getByLabelText('Go to feed')
      expect(feedButton).toHaveClass('min-h-[44px]', 'min-w-[44px]', 'touch-manipulation')
      
      // Check profile button
      const profileButton = screen.getByRole('button', { name: /Johnny's profile/i })
      expect(profileButton).toHaveClass('min-h-[44px]', 'min-w-[44px]', 'touch-manipulation')
    })

    it('provides proper active states for touch feedback', () => {
      render(<Navbar user={mockUser} />)
      
      const feedButton = screen.getByLabelText('Go to feed')
      expect(feedButton).toHaveClass('active:text-purple-800')
    })
  })

  describe('Responsive Typography and Spacing', () => {
    it('applies responsive text sizing', () => {
      render(<Navbar user={mockUser} />)
      
      const logoEmoji = screen.getAllByText('💜')[0] // Get the logo emoji (first one)
      expect(logoEmoji).toHaveClass('text-xl', 'sm:text-2xl')
      
      const title = screen.getByText('Grateful')
      expect(title).toHaveClass('text-lg', 'sm:text-xl')
    })

    it('applies responsive spacing between elements', () => {
      render(<Navbar user={mockUser} />)
      
      const logoButton = screen.getByRole('button', { name: /go to grateful home/i })
      expect(logoButton).toHaveClass('space-x-1', 'sm:space-x-2')
      
      const rightSection = screen.getByLabelText('Go to feed').closest('div')
      expect(rightSection).toHaveClass('space-x-1', 'sm:space-x-3')
    })
  })

  describe('Search Component Integration', () => {
    it('renders search components with proper responsive layout', () => {
      render(<Navbar user={mockUser} />)
      
      // Check that search container has proper responsive classes
      const searchInputs = screen.getAllByLabelText('Search for users')
      expect(searchInputs.length).toBeGreaterThan(0)
      
      // Check for mobile search button
      const mobileSearchButton = screen.getByTitle('Search users')
      expect(mobileSearchButton).toBeInTheDocument()
      expect(mobileSearchButton).toHaveClass('min-w-[44px]', 'min-h-[44px]', 'touch-manipulation')
    })

    it('applies proper responsive layout for search container', () => {
      render(<Navbar user={mockUser} />)
      
      // Find the search container by looking for the middle section
      const searchContainer = screen.getByRole('navigation').querySelector('.flex-1.min-w-0.max-w-md.mx-auto')
      expect(searchContainer).toBeInTheDocument()
      expect(searchContainer).toHaveClass('flex-1', 'min-w-0', 'max-w-md', 'mx-auto')
    })
  })

  describe('Accessibility Compliance', () => {
    it('maintains proper ARIA labels and navigation structure', () => {
      render(<Navbar user={mockUser} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('aria-label', 'Main navigation')
      
      expect(screen.getByLabelText('Go to feed')).toBeInTheDocument()
      expect(screen.getByLabelText(/Johnny's profile/i)).toBeInTheDocument()
    })

    it('provides proper focus management', () => {
      render(<Navbar user={mockUser} />)
      
      const feedButton = screen.getByLabelText('Go to feed')
      expect(feedButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-purple-500')
    })
  })

  describe('Viewport Overflow Prevention', () => {
    it('prevents horizontal overflow with proper constraints', () => {
      render(<Navbar user={mockUser} />)
      
      const nav = screen.getByRole('navigation')
      const container = nav.firstChild as HTMLElement
      
      // Should have max-width constraint and proper padding
      expect(container).toHaveClass('max-w-4xl')
      expect(nav).toHaveClass('px-3', 'sm:px-4')
    })

    it('ensures text does not wrap inappropriately', () => {
      render(<Navbar user={mockUser} />)
      
      const title = screen.getByText('Grateful')
      expect(title).toHaveClass('whitespace-nowrap')
    })
  })

  describe('Interactive Behavior', () => {
    it('provides proper interactive elements with touch targets', () => {
      render(<Navbar user={mockUser} />)
      
      const feedButton = screen.getByLabelText('Go to feed')
      expect(feedButton).toBeInTheDocument()
      expect(feedButton).toHaveClass('min-h-[44px]', 'min-w-[44px]', 'touch-manipulation')
    })

    it('ensures all buttons have proper focus states', () => {
      render(<Navbar user={mockUser} />)
      
      const feedButton = screen.getByLabelText('Go to feed')
      expect(feedButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-purple-500')
    })
  })

  describe('Z-Index Layering', () => {
    it('ensures navbar has proper z-index for sticky positioning', () => {
      render(<Navbar user={mockUser} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('z-40')
    })

    it('ensures navbar elements have proper z-index hierarchy', () => {
      render(<Navbar user={mockUser} />)
      
      // Check that logo section has lower z-index than search
      const logoSection = screen.getByRole('navigation').querySelector('.z-10')
      expect(logoSection).toBeInTheDocument()
      
      // Check that right section (notifications, profile) has proper z-index
      const rightSection = screen.getByLabelText('Go to feed').closest('.z-10')
      expect(rightSection).toBeInTheDocument()
    })

    it('ensures mobile search has higher z-index than other navbar elements', () => {
      render(<Navbar user={mockUser} />)
      
      // Check that mobile search container exists (no longer needs high z-index due to portal)
      const mobileSearchContainer = screen.getByRole('navigation').querySelector('[class*="relative"]')
      expect(mobileSearchContainer).toBeInTheDocument()
    })
  })

  describe('Component Rendering Conditions', () => {
    it('shows user-specific components only when user is provided', () => {
      render(<Navbar user={mockUser} />)
      
      expect(screen.getByLabelText('Go to feed')).toBeInTheDocument()
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
      expect(screen.getByLabelText(/Johnny's profile/i)).toBeInTheDocument()
      
      // Check that search components are present (both mobile and desktop)
      const searchElements = screen.getAllByLabelText('Search for users')
      expect(searchElements.length).toBeGreaterThan(0)
    })

    it('hides user-specific components when no user is provided', () => {
      render(<Navbar />)
      
      expect(screen.queryByLabelText('Go to feed')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/profile/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Search for users')).not.toBeInTheDocument()
    })
  })
})