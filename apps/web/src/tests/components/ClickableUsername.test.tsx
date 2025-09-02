/**
 * Tests for ClickableUsername component
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ClickableUsername from '@/components/ClickableUsername'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('ClickableUsername', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render username text', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
      />
    )

    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('should navigate to user profile when clicked with valid ID', async () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
      />
    )

    const usernameElement = screen.getByText('testuser')
    fireEvent.click(usernameElement)

    // Wait for async navigation
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockPush).toHaveBeenCalledWith('/profile/123')
  })

  it('should navigate to user profile when Enter key is pressed', () => {
    render(
      <ClickableUsername
        userId="456"
        username="anotheruser"
      />
    )

    const usernameElement = screen.getByText('anotheruser')
    fireEvent.keyDown(usernameElement, { key: 'Enter' })

    expect(mockPush).toHaveBeenCalledWith('/profile/456')
  })

  it('should navigate to user profile when Space key is pressed', () => {
    render(
      <ClickableUsername
        userId="789"
        username="spaceuser"
      />
    )

    const usernameElement = screen.getByText('spaceuser')
    fireEvent.keyDown(usernameElement, { key: ' ' })

    expect(mockPush).toHaveBeenCalledWith('/profile/789')
  })

  it('should not navigate when other keys are pressed', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
      />
    )

    const usernameElement = screen.getByText('testuser')
    fireEvent.keyDown(usernameElement, { key: 'Tab' })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should call custom onClick handler when provided', () => {
    const mockOnClick = jest.fn()
    
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
        onClick={mockOnClick}
      />
    )

    const usernameElement = screen.getByText('testuser')
    fireEvent.click(usernameElement)

    expect(mockOnClick).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/profile/123')
  })

  it('should apply custom className', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
        className="custom-class"
      />
    )

    const usernameElement = screen.getByText('testuser')
    expect(usernameElement).toHaveClass('custom-class')
  })

  it('should have proper accessibility attributes', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
      />
    )

    const usernameElement = screen.getByText('testuser')
    expect(usernameElement).toHaveAttribute('role', 'button')
    expect(usernameElement).toHaveAttribute('tabIndex', '0')
    expect(usernameElement).toHaveAttribute('aria-label', "View testuser's profile")
  })

  it('should prevent event propagation when clicked', () => {
    const parentClickHandler = jest.fn()
    
    render(
      <div onClick={parentClickHandler}>
        <ClickableUsername
          userId="123"
          username="testuser"
        />
      </div>
    )

    const usernameElement = screen.getByText('testuser')
    fireEvent.click(usernameElement)

    // Parent click handler should not be called due to stopPropagation
    expect(parentClickHandler).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/profile/123')
  })

  it('should work with numeric user IDs', () => {
    render(
      <ClickableUsername
        userId={456}
        username="numericuser"
      />
    )

    const usernameElement = screen.getByText('numericuser')
    fireEvent.click(usernameElement)

    expect(mockPush).toHaveBeenCalledWith('/profile/456')
  })
})