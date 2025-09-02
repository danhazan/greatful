import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import ClickableProfilePicture from '@/components/ClickableProfilePicture'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}))

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
  const mockPush = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush
    })
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
      const { container } = render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          size="small"
        />
      )

      const avatar = container.querySelector('[role="button"]')
      expect(avatar).toHaveClass('w-8', 'h-8')
    })

    it('should apply correct size classes for medium size (default)', () => {
      const { container } = render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
        />
      )

      const avatar = container.querySelector('[role="button"]')
      expect(avatar).toHaveClass('w-10', 'h-10')
    })

    it('should apply correct size classes for large size', () => {
      const { container } = render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          size="large"
        />
      )

      const avatar = container.querySelector('[role="button"]')
      expect(avatar).toHaveClass('w-12', 'h-12')
    })
  })

  describe('Navigation', () => {
    it('should navigate to profile when clicked with valid userId', async () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      const avatar = screen.getByRole('button')
      fireEvent.click(avatar)

      expect(mockPush).toHaveBeenCalledWith('/profile/123')
    })

    it('should resolve username to ID when userId is invalid', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 456 }
        })
      })

      render(
        <ClickableProfilePicture
          userId="invalid-id"
          username="testuser"
          displayName="Test User"
        />
      )

      const avatar = screen.getByRole('button')
      fireEvent.click(avatar)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/users/by-username/testuser', {
          headers: {
            'Authorization': 'Bearer mock-token'
          }
        })
        expect(mockPush).toHaveBeenCalledWith('/profile/456')
      })
    })

    it('should handle keyboard navigation (Enter key)', async () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      const avatar = screen.getByRole('button')
      fireEvent.keyDown(avatar, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/profile/123')
    })

    it('should handle keyboard navigation (Space key)', async () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      const avatar = screen.getByRole('button')
      fireEvent.keyDown(avatar, { key: ' ' })

      expect(mockPush).toHaveBeenCalledWith('/profile/123')
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

      const avatar = screen.getByRole('button')
      fireEvent.click(avatar)

      expect(mockOnClick).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/profile/123')
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

      const avatar = screen.getByRole('button')
      expect(avatar).toHaveAttribute('aria-label', "View Test User's profile")
    })

    it('should be focusable', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      const avatar = screen.getByRole('button')
      expect(avatar).toHaveAttribute('tabIndex', '0')
    })

    it('should have proper role attribute', () => {
      render(
        <ClickableProfilePicture
          userId="123"
          username="testuser"
          displayName="Test User"
        />
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing access token gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(
        <ClickableProfilePicture
          userId="invalid-id"
          username="testuser"
          displayName="Test User"
        />
      )

      const avatar = screen.getByRole('button')
      fireEvent.click(avatar)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No access token available for username resolution')
      })

      consoleSpy.mockRestore()
    })

    it('should handle API errors gracefully', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'))
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(
        <ClickableProfilePicture
          userId="invalid-id"
          username="testuser"
          displayName="Test User"
        />
      )

      const avatar = screen.getByRole('button')
      fireEvent.click(avatar)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to resolve username to ID:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })
})