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
    
    // Component uses displayName for aria-label
    const avatar = screen.getByLabelText(/Johnny's avatar/i)
    expect(avatar).toBeInTheDocument()
    // Should have an img element with the correct src
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('renders initials fallback when no image', () => {
    const userWithoutImage = { ...mockUser, profileImageUrl: undefined }
    render(<UserAvatar user={userWithoutImage} />)
    
    const avatar = screen.getByLabelText(/Johnny's avatar fallback/i)
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('JO')
  })

  it('renders initials fallback when image fails to load', () => {
    render(<UserAvatar user={mockUser} />)
    
    const avatar = screen.getByLabelText(/Johnny's avatar/i)
    fireEvent.error(avatar)
    
    const fallback = screen.getByLabelText(/Johnny's avatar fallback/i)
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveTextContent('JO')
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<UserAvatar user={mockUser} onClick={handleClick} />)
    
    const button = screen.getByRole('button', { name: /Johnny's profile/i })
    fireEvent.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows tooltip when enabled', () => {
    render(<UserAvatar user={mockUser} showTooltip={true} onClick={jest.fn()} />)
    
    const button = screen.getByRole('button', { name: /Johnny's profile/i })
    expect(button).toBeInTheDocument()
    
    // Check that tooltip content exists (even if not visible)
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
  })

  it('applies correct size classes', () => {
    const userWithoutImage = { ...mockUser, profileImageUrl: undefined }
    
    const { rerender } = render(<UserAvatar user={userWithoutImage} size="sm" />)
    let avatar = screen.getByLabelText(/Johnny's avatar fallback/i)
    expect(avatar).toHaveClass('h-6', 'w-6')

    rerender(<UserAvatar user={userWithoutImage} size="md" />)
    avatar = screen.getByLabelText(/Johnny's avatar fallback/i)
    expect(avatar).toHaveClass('h-8', 'w-8')

    rerender(<UserAvatar user={userWithoutImage} size="lg" />)
    avatar = screen.getByLabelText(/Johnny's avatar fallback/i)
    expect(avatar).toHaveClass('h-12', 'w-12')
  })

  it('uses displayName over name for initials', () => {
    const userWithoutImage = { ...mockUser, profileImageUrl: undefined }
    render(<UserAvatar user={userWithoutImage} />)
    
    // Should use "Johnny" (displayName) not "John Doe" (name)
    const avatar = screen.getByLabelText(/Johnny's avatar fallback/i)
    expect(avatar).toHaveTextContent('JO') // First two letters of "Johnny"
  })

  it('falls back to username when no displayName', () => {
    const userWithoutDisplayName = { ...mockUser, displayName: undefined, profileImageUrl: undefined }
    render(<UserAvatar user={userWithoutDisplayName} />)
    
    // Falls back to username 'johndoe' when displayName is undefined
    const avatar = screen.getByLabelText(/johndoe's avatar fallback/i)
    expect(avatar).toHaveTextContent('JO') // First two letters of username fallback
  })

  it('handles image field from UserContext', () => {
    const userWithImageField = {
      ...mockUser,
      profileImageUrl: undefined,
      image: 'https://example.com/user-context-image.jpg'
    }
    render(<UserAvatar user={userWithImageField} />)
    
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'https://example.com/user-context-image.jpg')
  })
})