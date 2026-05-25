import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import FollowingModal from '@/components/FollowingModal'

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

function createMockResponse(data: any, status = 200, ok = true) {
  const body = JSON.stringify(data)
  return Promise.resolve({
    ok,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(data),
    headers: new Headers({ 'content-type': 'application/json' }),
  })
}

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

  it('should render modal when isOpen is true', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/users/1/following')) {
        return createMockResponse({
          data: {
            following: [],
            has_more: false
          }
        })
      }
      return createMockResponse({}, 200)
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
    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = jest.fn()

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/users/1/following')) {
        return createMockResponse({
          data: {
            following: [],
            has_more: false
          }
        })
      }
      return createMockResponse({}, 200)
    })

    render(
      <FollowingModal
        isOpen={true}
        onClose={mockOnClose}
        userId={1}
        username="testuser"
      />
    )

    await waitFor(() => {
      const closeButton = screen.getByLabelText('Close following modal')
      fireEvent.click(closeButton)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  it('should display empty state when not following anyone', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/users/1/following')) {
        return createMockResponse({
          data: {
            following: [],
            has_more: false
          }
        })
      }
      return createMockResponse({}, 200)
    })

    render(
      <FollowingModal
        isOpen={true}
        onClose={() => {}}
        userId={1}
        username="testuser"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Not following anyone yet')).toBeInTheDocument()
    })
    expect(screen.getByText('testuser isn\'t following anyone yet.')).toBeInTheDocument()
  })
})
