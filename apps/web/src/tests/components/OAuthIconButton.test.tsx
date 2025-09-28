import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import OAuthIconButton from '@/components/OAuthIconButton'

describe('OAuthIconButton', () => {
  const mockOnOAuthLogin = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Google Provider', () => {
    it('renders Google icon button correctly', () => {
      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('title', 'Sign in with Google')
    })

    it('calls onOAuthLogin when clicked', async () => {
      mockOnOAuthLogin.mockResolvedValue(undefined)

      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockOnOAuthLogin).toHaveBeenCalledWith('google')
      })
    })

    it('shows loading state when OAuth is in progress', async () => {
      let resolveOAuth: () => void
      const oauthPromise = new Promise<void>((resolve) => {
        resolveOAuth = resolve
      })
      mockOnOAuthLogin.mockReturnValue(oauthPromise)

      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      fireEvent.click(button)

      // Should show loading spinner
      await waitFor(() => {
        expect(screen.getByRole('button')).toContainElement(
          document.querySelector('.animate-spin')
        )
      })

      // Resolve the OAuth promise
      resolveOAuth!()

      // Should return to normal state
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })
  })

  describe('Facebook Provider', () => {
    it('renders Facebook icon button correctly', () => {
      render(
        <OAuthIconButton
          provider="facebook"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with facebook/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('title', 'Sign in with Facebook')
    })

    it('calls onOAuthLogin when clicked', async () => {
      mockOnOAuthLogin.mockResolvedValue(undefined)

      render(
        <OAuthIconButton
          provider="facebook"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with facebook/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockOnOAuthLogin).toHaveBeenCalledWith('facebook')
      })
    })
  })

  describe('Disabled State', () => {
    it('does not call onOAuthLogin when disabled', () => {
      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
          disabled={true}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      expect(button).toBeDisabled()

      fireEvent.click(button)
      expect(mockOnOAuthLogin).not.toHaveBeenCalled()
    })

    it('applies disabled styling', () => {
      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
          disabled={true}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
    })
  })

  describe('Error Handling', () => {
    it('handles OAuth errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockOnOAuthLogin.mockRejectedValue(new Error('OAuth failed'))

      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('google OAuth error:', expect.any(Error))
      })

      // Button should return to normal state after error
      await waitFor(() => {
        expect(button).not.toBeDisabled()
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })

      consoleError.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      expect(button).toHaveAttribute('aria-label', 'Sign in with Google')
      expect(button).toHaveAttribute('title', 'Sign in with Google')
    })

    it('has proper focus styles', () => {
      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-purple-500')
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(
        <OAuthIconButton
          provider="google"
          onOAuthLogin={mockOnOAuthLogin}
          className="custom-class"
        />
      )

      const button = screen.getByRole('button', { name: /sign in with google/i })
      expect(button).toHaveClass('custom-class')
    })
  })
})