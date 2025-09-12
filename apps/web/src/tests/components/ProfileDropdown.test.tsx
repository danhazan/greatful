import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import ProfileDropdown from '../../components/ProfileDropdown'

const mockPush = jest.fn()
const mockBack = jest.fn()

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn()
  })
}))

describe('ProfileDropdown', () => {
  const mockUser = {
    id: 1,
    name: 'John Doe',
    display_name: 'Johnny',
    username: 'johndoe',
    email: 'john@example.com',
    profile_image_url: 'https://example.com/avatar.jpg'
  }

  const defaultProps = {
    user: mockUser,
    isOpen: false,
    onToggle: jest.fn(),
    onClose: jest.fn(),
    onLogout: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders user avatar button', () => {
    render(<ProfileDropdown {...defaultProps} />)
    
    const avatarButton = screen.getByRole('button', { name: /Johnny's profile/i })
    expect(avatarButton).toBeInTheDocument()
  })

  it('shows dropdown when isOpen is true', () => {
    render(<ProfileDropdown {...defaultProps} isOpen={true} />)
    
    const dropdown = screen.getByRole('menu', { name: /Profile menu/i })
    expect(dropdown).toBeInTheDocument()
    
    const profileButton = screen.getByRole('button', { name: /Go to profile page/i })
    const logoutButton = screen.getByRole('menuitem', { name: /Log out of account/i })
    
    expect(profileButton).toBeInTheDocument()
    expect(logoutButton).toBeInTheDocument()
  })

  it('hides dropdown when isOpen is false', () => {
    render(<ProfileDropdown {...defaultProps} isOpen={false} />)
    
    const dropdown = screen.queryByRole('menu', { name: /Profile menu/i })
    expect(dropdown).not.toBeInTheDocument()
  })

  it('calls onToggle when avatar is clicked', () => {
    const onToggle = jest.fn()
    render(<ProfileDropdown {...defaultProps} onToggle={onToggle} />)
    
    const avatarButton = screen.getByRole('button', { name: /Johnny's profile/i })
    fireEvent.click(avatarButton)
    
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('closes dropdown when user info is clicked', () => {
    render(<ProfileDropdown {...defaultProps} isOpen={true} />)
    
    const profileButton = screen.getByRole('button', { name: /Go to profile page/i })
    fireEvent.click(profileButton)
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    // Note: Router navigation is tested in integration tests
  })

  it('calls onLogout when Logout is clicked', () => {
    const onLogout = jest.fn()
    render(<ProfileDropdown {...defaultProps} isOpen={true} onLogout={onLogout} />)
    
    const logoutButton = screen.getByRole('menuitem', { name: /Log out of account/i })
    fireEvent.click(logoutButton)
    
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('displays user information in clickable dropdown header', () => {
    render(<ProfileDropdown {...defaultProps} isOpen={true} />)
    
    expect(screen.getByText('Johnny')).toBeInTheDocument()
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
    
    // Verify the header is clickable
    const profileButton = screen.getByRole('button', { name: /Go to profile page/i })
    expect(profileButton).toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', async () => {
    const onClose = jest.fn()
    render(<ProfileDropdown {...defaultProps} isOpen={true} onClose={onClose} />)
    
    // Click outside the dropdown
    fireEvent.mouseDown(document.body)
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('closes dropdown when pressing Escape key', async () => {
    const onClose = jest.fn()
    render(<ProfileDropdown {...defaultProps} isOpen={true} onClose={onClose} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('does not close dropdown when clicking inside', async () => {
    const onClose = jest.fn()
    render(<ProfileDropdown {...defaultProps} isOpen={true} onClose={onClose} />)
    
    const dropdown = screen.getByRole('menu')
    fireEvent.mouseDown(dropdown)
    
    // Wait a bit to ensure no close event is triggered
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows tooltip on avatar when dropdown is closed', () => {
    render(<ProfileDropdown {...defaultProps} isOpen={false} />)
    
    const avatarButton = screen.getByRole('button', { name: /Johnny's profile/i })
    expect(avatarButton).toBeInTheDocument()
    
    // Check that tooltip content exists (even if not visible)
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
  })

  it('hides tooltip on avatar when dropdown is open', () => {
    render(<ProfileDropdown {...defaultProps} isOpen={true} />)
    
    const avatarButton = screen.getByRole('button', { name: /Johnny's profile/i })
    expect(avatarButton).toBeInTheDocument()
    
    // When dropdown is open, username appears in dropdown header, not as tooltip
    // The tooltip should not be visible (though the text appears in dropdown)
    const dropdown = screen.getByRole('menu')
    expect(dropdown).toBeInTheDocument()
    expect(screen.getByText('@johndoe')).toBeInTheDocument() // In dropdown header
  })

  it('falls back to name when no display_name', () => {
    const userWithoutDisplayName = { ...mockUser, display_name: undefined }
    render(<ProfileDropdown {...defaultProps} user={userWithoutDisplayName} isOpen={true} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
  })

  it('displays username correctly', () => {
    render(<ProfileDropdown {...defaultProps} isOpen={true} />)
    
    expect(screen.getByText('Johnny')).toBeInTheDocument()
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
  })
})