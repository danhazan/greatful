import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClickableProfilePicture from '@/components/ClickableProfilePicture'

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href, onClick, className, ...props }: any) {
    return (
      <a href={href} onClick={onClick} className={className} {...props}>
        {children}
      </a>
    )
  }
})

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

// Mock fetch
global.fetch = jest.fn()

describe('ClickableProfilePicture', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  describe('Profile Picture Display', () => {
    it('should display profile picture when imageUrl is provided', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          imageUrl="https://example.com/profile.jpg"
          displayName="Test User"
        />
      )

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/profile.jpg')
      expect(img).toHaveAttribute('alt', 'Test User')
    })

    it('should display letter avatar when no imageUrl is provided', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      expect(screen.getByText('T')).toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('should fallback to letter avatar when image fails to load', async () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          imageUrl="https://example.com/broken-image.jpg"
          displayName="Test User"
        />
      )

      const img = screen.getByRole('img')
      
      // Simulate image load error
      fireEvent.error(img)

      await waitFor(() => {
        expect(screen.getByText('T')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
      })
    })

    it('should handle missing displayName gracefully', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
        />
      )

      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('should show question mark when no user data is provided', () => {
      render(<ClickableProfilePicture />)

      expect(screen.getByText('?')).toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    it('should apply correct size classes for small size', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          size="small"
        />
      )

      const link = screen.getByRole('link')
      const sizeDiv = link.querySelector('.w-8')
      expect(sizeDiv).toBeInTheDocument()
    })

    it('should apply correct size classes for medium size (default)', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
        />
      )

      const link = screen.getByRole('link')
      const sizeDiv = link.querySelector('.w-10')
      expect(sizeDiv).toBeInTheDocument()
    })

    it('should apply correct size classes for large size', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          size="large"
        />
      )

      const link = screen.getByRole('link')
      const sizeDiv = link.querySelector('.w-12')
      expect(sizeDiv).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should render as a link with correct href for valid userId', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/profile/123')
    })

    it('should use username as href fallback when userId is not a valid ID', () => {
      render(
        <ClickableProfilePicture
          userId="invalid-id"
          username="testuser"
          displayName="Test User"
        />
      )

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/profile/testuser')
    })

    it('should call custom onClick handler when provided', () => {
      const mockOnClick = jest.fn()
      
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
          onClick={mockOnClick}
        />
      )

      const link = screen.getByRole('link')
      fireEvent.click(link)

      expect(mockOnClick).toHaveBeenCalled()
    })

    it('should not render a profile link when profile navigation is disabled', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          imageUrl="https://example.com/image-thumb.jpg"
          displayName="Test User"
          disableProfileNavigation
        />
      )

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/image-thumb.jpg')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('aria-label', "View Test User's profile")
    })

    it('should render as an <a> element (not a button)', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      expect(screen.getByRole('link')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should not render a link when no user data is provided', () => {
      render(<ClickableProfilePicture />)

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('Link Behavior', () => {
    it('should work with numeric user IDs', () => {
      render(
        <ClickableProfilePicture
          userId={456}
          username="numericuser"
        />
      )

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/profile/456')
    })

    it('should fallback to username when only username is provided', () => {
      render(
        <ClickableProfilePicture
          username="testuser"
          displayName="Test User"
        />
      )

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/profile/testuser')
    })
  })
})
