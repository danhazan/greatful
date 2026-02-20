"use client"

import { useState, useEffect, useCallback } from 'react'
import oauthService, { OAuthProviderStatus } from '@/services/oauthService'

interface UseOAuthReturn {
  providers: OAuthProviderStatus | null
  isLoading: boolean
  error: string | null
  isAvailable: boolean
  handleOAuthLogin: (provider: 'google' | 'facebook') => Promise<void>
  clearError: () => void
}

export const useOAuth = (): UseOAuthReturn => {
  const [providers, setProviders] = useState<OAuthProviderStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load OAuth provider status
  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const status = await oauthService.getProviders()
      setProviders(status)
    } catch (err: any) {
      console.error('Error loading OAuth providers:', err)

      // Don't show error messages for OAuth not being configured
      const errorMessage = oauthService.getErrorMessage(err)
      if (!errorMessage.includes('Failed to get OAuth providers') &&
        !errorMessage.includes('OAuth not configured') &&
        !errorMessage.includes('Internal server error')) {
        setError(oauthService.handleOAuthError(err))
      }

      // Set default providers state when OAuth is not configured
      setProviders({
        providers: { google: false, facebook: false },
        redirectUri: window.location.origin + '/auth/callback/google',
        environment: 'development',
        initialized: false
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  // Handle OAuth login
  const handleOAuthLogin = useCallback(async (provider: 'google' | 'facebook') => {
    try {
      setError(null)

      // Check if provider is available
      if (!providers?.providers[provider]) {
        throw new Error(`${provider} login is not available at the moment`)
      }

      // Initiate OAuth flow (this will redirect)
      await oauthService.initiateLogin(provider, window.location.origin + `/auth/callback/${provider}`)
    } catch (err: any) {
      console.error(`Error initiating ${provider} OAuth:`, err)
      setError(oauthService.handleOAuthError(err))
      throw err
    }
  }, [providers])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Check if OAuth is available
  const isAvailable = Boolean(
    providers?.initialized &&
    (providers.providers.google || providers.providers.facebook)
  )

  return {
    providers,
    isLoading,
    error,
    isAvailable,
    handleOAuthLogin,
    clearError
  }
}