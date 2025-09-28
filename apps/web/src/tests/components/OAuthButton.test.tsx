import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OAuthButton from '@/components/OAuthButton'

describe('OAuthButton', () => {
  const mockOnOAuthLogin = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders Google OAuth button correctly', () => {
    render(
      <OAuthButton
        provider="google"
        onOAuthLogin={mockOnOAuthLogin}
      />
    )

    const button = screen.getByRole('button', { name: /sign in with google/i })
    expect(button).toBeInTheDocument()
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
  })

  it('renders Facebook OAuth button correctly', () => {
    render(
      <OAuthButton
        provider="facebook"
        onOAuthLogin={mockOnOAuthLogin}
      />
    )

    const button = screen.getByRole('button', { name: /sign in with facebook/i })
    expect(button).toBeInTheDocument()
    expect(screen.getByText('Continue with Facebook')).toBeInTheDocument()
  })

  it('calls onOAuthLogin when clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <OAuthButton
        provider="google"
        onOAuthLogin={mockOnOAuthLogin}
      />
    )

    const button = screen.getByRole('button', { name: /sign in with google/i })
    await user.click(button)

    expect(mockOnOAuthLogin).toHaveBeenCalledWith('google')
  })

  it('shows loading state when processing', async () => {
    const slowOAuthLogin = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    )
    
    const user = userEvent.setup()
    
    render(
      <OAuthButton
        provider="google"
        onOAuthLogin={slowOAuthLogin}
      />
    )

    const button = screen.getByRole('button', { name: /sign in with google/i })
    await user.click(button)

    // Should show loading state
    expect(screen.getByText('Connecting...')).toBeInTheDocument()
    expect(button).toBeDisabled()

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    })
  })

  it('is disabled when disabled prop is true', () => {
    render(
      <OAuthButton
        provider="google"
        onOAuthLogin={mockOnOAuthLogin}
        disabled={true}
      />
    )

    const button = screen.getByRole('button', { name: /sign in with google/i })
    expect(button).toBeDisabled()
  })

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup()
    
    render(
      <OAuthButton
        provider="google"
        onOAuthLogin={mockOnOAuthLogin}
      />
    )

    const button = screen.getByRole('button', { name: /sign in with google/i })
    
    // Focus the button
    await user.tab()
    expect(button).toHaveFocus()

    // Press Enter
    await user.keyboard('{Enter}')
    expect(mockOnOAuthLogin).toHaveBeenCalledWith('google')
  })

  it('applies custom className', () => {
    render(
      <OAuthButton
        provider="google"
        onOAuthLogin={mockOnOAuthLogin}
        className="custom-class"
      />
    )

    const button = screen.getByRole('button', { name: /sign in with google/i })
    expect(button).toHaveClass('custom-class')
  })

  it('handles OAuth login errors gracefully', async () => {
    const errorOAuthLogin = jest.fn().mockRejectedValue(new Error('OAuth failed'))
    const user = userEvent.setup()
    
    render(
      <OAuthButton
        provider="google"
        onOAuthLogin={errorOAuthLogin}
      />
    )

    const button = screen.getByRole('button', { name: /sign in with google/i })
    await user.click(button)

    // Should handle error and return to normal state
    await waitFor(() => {
      expect(screen.getByText('Continue with Google')).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })
  })
})