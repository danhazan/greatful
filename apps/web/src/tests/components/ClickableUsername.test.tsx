/**
 * Tests for ClickableUsername component
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ClickableUsername from '@/components/ClickableUsername'

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href, onClick, className, ...props }: any) {
    return (
      <a href={href} onClick={onClick} className={className} {...props}>
        {children}
      </a>
    )
  }
})

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

  it('should render as a link with correct href', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/profile/123')
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

    const link = screen.getByRole('link')
    fireEvent.click(link)

    expect(mockOnClick).toHaveBeenCalled()
  })

  it('should apply custom className', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
        className="custom-class"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveClass('custom-class')
  })

  it('should have proper accessibility attributes', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('aria-label', "View testuser's profile")
  })

  it('should render as a link element (not a button or span)', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
      />
    )

    expect(screen.getByRole('link')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should work with numeric user IDs', () => {
    render(
      <ClickableUsername
        userId={456}
        username="numericuser"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/profile/456')
  })

  it('should display displayName when provided', () => {
    render(
      <ClickableUsername
        userId="123"
        username="testuser"
        displayName="Test User"
      />
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('should fallback to username href when userId is not valid', () => {
    render(
      <ClickableUsername
        userId="invalid-id"
        username="testuser"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/profile/testuser')
  })

  it('should render plain text when no userId or username provided', () => {
    render(<ClickableUsername />)

    expect(screen.getByText('Unknown User')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})