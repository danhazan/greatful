import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import FollowButton from '@/components/FollowButton'

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

// Mock useUserState - always return non-following state
jest.mock('@/hooks/useUserState', () => ({
  useUserState: jest.fn(() => ({
    followState: false,
    toggleFollow: jest.fn(),
    isLoading: false,
    error: null,
  })),
}))

describe('FollowButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  describe('Initial Rendering', () => {
    it('renders follow button with default state', async () => {
      render(<FollowButton userId={123} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Follow me!')).toBeInTheDocument()
    })

    it('has proper ARIA labels', () => {
      render(<FollowButton userId={123} />)
      
      expect(screen.getByLabelText('Follow user 123')).toBeInTheDocument()
    })
  })

  describe('Follow Actions', () => {
    it('renders button that can be clicked', async () => {
      render(<FollowButton userId={123} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })

      // Button should exist and be clickable
      const button = screen.getByRole('button')
      expect(button).not.toBeDisabled()
    })

    it('shows follow text when not following', async () => {
      render(<FollowButton userId={123} />)
      
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles missing token gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      render(<FollowButton userId={123} />)

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })

      // Click should show login prompt
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(screen.getByText(/please log in/i)).toBeInTheDocument()
    })

    it('renders button without crashing when initial state is false', async () => {
      render(<FollowButton userId={123} />)

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })
    })

    it('renders button without crashing when error is null', async () => {
      render(<FollowButton userId={123} />)

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })
    })
  })

  describe('Button Behavior', () => {
    it('button has accessible name', async () => {
      render(<FollowButton userId={456} />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Follow user 456')).toBeInTheDocument()
      })
    })

    it('renders with userId prop', async () => {
      render(<FollowButton userId={789} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })
      
      // Button should have correct accessibility
      expect(screen.getByLabelText('Follow user 789')).toBeInTheDocument()
    })
  })
})