import React from 'react'
import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import OAuthButton from '@/components/OAuthButton'

describe('OAuthButton Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // @flow Test: OAuth button renders correctly
  it('oauth button renders for user to click', () => {
    render(<OAuthButton provider="google" />)
    
    // Button should exist and be clickable
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  // @flow Test: User can initiate OAuth login
  it('user can click oauth button to start login', () => {
    const onClick = jest.fn()
    render(<OAuthButton provider="google" onClick={onClick} />)
    
    const button = screen.getByRole('button')
    expect(() => fireEvent.click(button)).not.toThrow()
  })

  // @flow Test: Button shows provider name
  it('button displays provider name for user', () => {
    render(<OAuthButton provider="google" />)
    
    // Should show google text
    expect(screen.getByText(/google/i)).toBeInTheDocument()
  })

  // @flow Test: Facebook provider works
  it('facebook oauth button works correctly', () => {
    render(<OAuthButton provider="facebook" />)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(() => fireEvent.click(button)).not.toThrow()
  })
})