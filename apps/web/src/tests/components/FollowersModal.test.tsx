import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import FollowersModal from '@/components/FollowersModal'

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

describe('FollowersModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <FollowersModal
        isOpen={false}
        onClose={() => {}}
        userId={1}
        username="testuser"
      />
    )

    expect(screen.queryByText('testuser\'s Followers')).not.toBeInTheDocument()
  })

  it('should render modal when isOpen is true', async () => {
    // Mock successful empty response
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/users/1/followers')) {
        return createMockResponse({
          data: {
            followers: [],
            has_more: false
          }
        })
      }
      return createMockResponse({ ok: false }, 404, false)
    })

    render(
      <FollowersModal
        isOpen={true}
        onClose={() => {}}
        userId={1}
        username="testuser"
      />
    )

    expect(screen.getByText('testuser\'s Followers')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = jest.fn()

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/users/1/followers')) {
        return createMockResponse({
          data: {
            followers: [],
            has_more: false
          }
        })
      }
      return createMockResponse({ ok: false }, 404, false)
    })

    render(
      <FollowersModal
        isOpen={true}
        onClose={mockOnClose}
        userId={1}
        username="testuser"
      />
    )

    await waitFor(() => {
      const closeButton = screen.getByLabelText('Close followers modal')
      fireEvent.click(closeButton)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  it('should display empty state when no followers', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/users/1/followers')) {
        return createMockResponse({
          data: {
            followers: [],
            has_more: false
          }
        })
      }
      return createMockResponse({ ok: false }, 404, false)
    })

    render(
      <FollowersModal
        isOpen={true}
        onClose={() => {}}
        userId={1}
        username="testuser"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No followers yet')).toBeInTheDocument()
    })
    expect(screen.getByText('testuser doesn\'t have any followers yet.')).toBeInTheDocument()
  })
})