import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import UserAvatar from '../../components/UserAvatar'

describe('UserAvatar', () => {
  const mockUser = {
    id: 1,
    name: 'John Doe',
    display_name: 'Johnny',
    username: 'johndoe',
    profile_image_url: 'https://example.com/avatar.jpg'
  }

  it('renders user avatar with image', () => {
    render(<UserAvatar user={mockUser} />)
    
    const image = screen.getByRole('img', { name: /Johnny's profile picture/i })
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('renders initials fallback when no image', () => {
    const userWithoutImage = { ...mockUser, profile_image_url: undefined }
    render(<UserAvatar user={userWithoutImage} />)
    
    const avatar = screen.getByLabelText(/Johnny's avatar/i)
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('JO')
  })

  it('renders initials fallback when image fails to load', () => {
    render(<UserAvatar user={mockUser} />)
    
    const image = screen.getByRole('img')
    fireEvent.error(image)
    
    const avatar = screen.getByLabelText(/Johnny's avatar/i)
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('JO')
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
    const userWithoutImage = { ...mockUser, profile_image_url: undefined }
    
    const { rerender } = render(<UserAvatar user={userWithoutImage} size="sm" />)
    let avatar = screen.getByLabelText(/Johnny's avatar/i)
    expect(avatar).toHaveClass('h-6', 'w-6')

    rerender(<UserAvatar user={userWithoutImage} size="md" />)
    avatar = screen.getByLabelText(/Johnny's avatar/i)
    expect(avatar).toHaveClass('h-8', 'w-8')

    rerender(<UserAvatar user={userWithoutImage} size="lg" />)
    avatar = screen.getByLabelText(/Johnny's avatar/i)
    expect(avatar).toHaveClass('h-12', 'w-12')
  })

  it('uses display_name over name for initials', () => {
    const userWithoutImage = { ...mockUser, profile_image_url: undefined }
    render(<UserAvatar user={userWithoutImage} />)
    
    // Should use "Johnny" (display_name) not "John Doe" (name)
    const avatar = screen.getByLabelText(/Johnny's avatar/i)
    expect(avatar).toHaveTextContent('JO') // First two letters of "Johnny"
  })

  it('falls back to name when no display_name', () => {
    const userWithoutDisplayName = { ...mockUser, display_name: undefined, profile_image_url: undefined }
    render(<UserAvatar user={userWithoutDisplayName} />)
    
    const avatar = screen.getByLabelText(/John Doe's avatar/i)
    expect(avatar).toHaveTextContent('JD') // First letters of "John Doe"
  })

  it('handles image field from UserContext', () => {
    const userWithImageField = {
      ...mockUser,
      profile_image_url: undefined,
      image: 'https://example.com/user-context-image.jpg'
    }
    render(<UserAvatar user={userWithImageField} />)
    
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'https://example.com/user-context-image.jpg')
  })
})