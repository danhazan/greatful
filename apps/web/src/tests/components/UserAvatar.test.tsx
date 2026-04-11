import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import UserAvatar from '../../components/UserAvatar'

describe('UserAvatar', () => {
  const mockUser = {
    id: 1,
    name: 'John Doe',
    displayName: 'Johnny',
    username: 'johndoe',
    profileImageUrl: 'https://example.com/avatar.jpg'
  }

  it('renders user avatar with image', () => {
    render(<UserAvatar user={mockUser} />)
    
    // Should have an img element
    const image = screen.getByRole('img')
    expect(image).toBeInTheDocument()
  })

  it('renders initials fallback when no image', () => {
    const userWithoutImage = { ...mockUser, profileImageUrl: undefined }
    render(<UserAvatar user={userWithoutImage} />)
    
    // Should show initials
    expect(screen.getByText('JO')).toBeInTheDocument()
  })

  it('shows tooltip when enabled', () => {
    render(<UserAvatar user={mockUser} showTooltip={true} onClick={jest.fn()} />)
    
    // Should show username in tooltip
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
  })

  it('uses displayName over name for initials', () => {
    const userWithoutImage = { ...mockUser, profileImageUrl: undefined }
    render(<UserAvatar user={userWithoutImage} />)
    
    // Should use "Johnny" (displayName) not "John Doe" (name)
    expect(screen.getByText('JO')).toBeInTheDocument()
  })

  it('falls back to username when no displayName', () => {
    const userWithoutDisplayName = { ...mockUser, displayName: undefined, profileImageUrl: undefined }
    render(<UserAvatar user={userWithoutDisplayName} />)
    
    // Falls back to username 'johndoe' when displayName is undefined
    expect(screen.getByText('JO')).toBeInTheDocument()
  })

  it('handles image field from UserContext', () => {
    const userWithImageField = {
      ...mockUser,
      profileImageUrl: undefined,
      image: 'https://example.com/user-context-image.jpg'
    }
    render(<UserAvatar user={userWithImageField} />)
    
    const image = screen.getByRole('img')
    expect(image).toBeInTheDocument()
  })
})