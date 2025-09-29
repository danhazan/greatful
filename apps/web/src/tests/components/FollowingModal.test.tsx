import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import FollowingModal from '@/components/FollowingModal'

// Mock the auth utility
jest.mock('@/utils/auth', () => ({
  getAccessToken: jest.fn(() => 'mock-token')
}))

// Mock the UserAvatar component
jest.mock('@/components/UserAvatar', () => {
  return function MockUserAvatar({ user, onClick }: any) {
    return (
      <div 
        onClick={onClick}
        data-testid={`user-avatar-${user.id}`}
        className="cursor-pointer"
      >
        {user.name}
      </div>
    )
  }
})

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('FollowingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <FollowingModal
        isOpen={false}
        onClose={() => {}}
        userId={1}
        username="testuser"
      />
    )

    expect(screen.queryByText('testuser is Following')).not.toBeInTheDocument()
  })

  it('should render modal when isOpen is true', () => {
    // Mock successful empty response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          following: [],
          has_more: false
        }
      })
    })

    render(
      <FollowingModal
        isOpen={true}
        onClose={() => {}}
        userId={1}
        username="testuser"
      />
    )

    expect(screen.getByText('testuser is Following')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = jest.fn()

    // Mock successful empty response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          following: [],
          has_more: false
        }
      })
    })

    render(
      <FollowingModal
        isOpen={true}
        onClose={mockOnClose}
        userId={1}
        username="testuser"
      />
    )

    const closeButton = screen.getByLabelText('Close following modal')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should display empty state when not following anyone', () => {
    // Mock successful empty response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          following: [],
          has_more: false
        }
      })
    })

    render(
      <FollowingModal
        isOpen={true}
        onClose={() => {}}
        userId={1}
        username="testuser"
      />
    )

    expect(screen.getByText('Not following anyone yet')).toBeInTheDocument()
    expect(screen.getByText('testuser isn\'t following anyone yet.')).toBeInTheDocument()
  })
})