import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import UserListItem from '@/components/UserListItem'

// Mock ProfilePhotoDisplay component
jest.mock('@/components/ProfilePhotoDisplay', () => {
  return function MockProfilePhotoDisplay({ username }: any) {
    return <div data-testid="profile-photo">{username}</div>
  }
})

// Mock formatTimeAgo utility
jest.mock('@/utils/timeAgo', () => ({
  formatTimeAgo: jest.fn((date) => '2h ago')
}))

describe('UserListItem', () => {
  const mockUser = {
    id: 1,
    name: 'John Doe',
    username: 'johndoe',
    image: 'https://example.com/avatar.jpg',
    bio: 'Software developer',
    createdAt: '2023-01-01T00:00:00Z'
  }

  it('should render user information correctly', () => {
    render(
      <UserListItem
        user={mockUser}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
    expect(screen.getByAltText('John Doe\'s profile')).toBeInTheDocument()
  })

  it('should show bio when username is same as name', () => {
    const userWithSameName = {
      ...mockUser,
      name: 'johndoe',
      username: 'johndoe'
    }

    render(
      <UserListItem
        user={userWithSameName}
      />
    )

    expect(screen.getByText('johndoe')).toBeInTheDocument()
    expect(screen.getByText('Software developer')).toBeInTheDocument()
  })

  it('should show timestamp when showTimestamp is true', () => {
    render(
      <UserListItem
        user={mockUser}
        showTimestamp={true}
      />
    )

    // The formatTimeAgo utility will format the date, we just check it's there
    expect(screen.getByText('2y')).toBeInTheDocument()
  })

  it('should render right element when provided', () => {
    const rightElement = <button>Follow</button>

    render(
      <UserListItem
        user={mockUser}
        rightElement={rightElement}
      />
    )

    expect(screen.getByText('Follow')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const mockOnClick = jest.fn()

    render(
      <UserListItem
        user={mockUser}
        onClick={mockOnClick}
      />
    )

    const listItem = screen.getByText('John Doe').closest('div')
    fireEvent.click(listItem!)

    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('should apply custom className', () => {
    render(
      <UserListItem
        user={mockUser}
        className="custom-class"
      />
    )

    const listItem = screen.getByText('John Doe').closest('div')?.parentElement
    expect(listItem).toHaveClass('custom-class')
  })
})