/**
 * OAuth Service for handling social authentication flows
 */

export interface OAuthProvider {
  google: boolean
  facebook: boolean
}

export interface OAuthProviderStatus {
  providers: OAuthProvider
  redirect_uri: string
  environment: string
  initialized: boolean
}

export interface OAuthLoginResponse {
  user: {
    id: string
    username: string
    email: string
    display_name?: string
    profile_image_url?: string
  }
  tokens: {
    access_token: string
    token_type: string
    refresh_token?: string
  }
  is_new_user: boolean
}

export interface OAuthError {
  error: string
  message: string
  details?: Record<string, any>
}

class OAuthService {
  private baseUrl: string

  constructor() {
    this.baseUrl = '/api/oauth'
  }

  /**
   * Get available OAuth providers and their status
   */
  async getProviders(): Promise<OAuthProviderStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/providers`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to get OAuth providers')
      }

      return data.data || data
    } catch (error) {
      console.error('Error getting OAuth providers:', error)
      throw error
    }
  }

  /**
   * Initiate OAuth login flow
   */
  async initiateLogin(provider: 'google' | 'facebook', redirectUri?: string): Promise<void> {
    try {
      const params = new URLSearchParams()
      if (redirectUri) {
        params.append('redirect_uri', redirectUri)
      }

      const url = `${this.baseUrl}/login/${provider}${params.toString() ? `?${params.toString()}` : ''}`
      
      // Redirect to OAuth provider
      window.location.href = url
    } catch (error) {
      console.error(`Error initiating ${provider} OAuth login:`, error)
      throw error
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    provider: 'google' | 'facebook',
    code: string,
    state?: string
  ): Promise<OAuthLoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/callback/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const error: OAuthError = {
          error: data.error || 'oauth_error',
          message: data.detail || data.message || 'OAuth authentication failed',
          details: data.details
        }
        throw error
      }

      return data.data || data
    } catch (error) {
      console.error(`Error handling ${provider} OAuth callback:`, error)
      throw error
    }
  }

  /**
   * Check if OAuth is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const status = await this.getProviders()
      return status.initialized && (status.providers.google || status.providers.facebook)
    } catch (error) {
      console.error('Error checking OAuth availability:', error)
      return false
    }
  }

  /**
   * Get OAuth error message from error object
   */
  getErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error
    }

    if (error?.message) {
      return error.message
    }

    if (error?.detail) {
      return error.detail
    }

    if (error?.error) {
      return error.error
    }

    return 'OAuth authentication failed. Please try again.'
  }

  /**
   * Handle OAuth errors with user-friendly messages
   */
  handleOAuthError(error: any): string {
    const message = this.getErrorMessage(error)

    // Map common OAuth errors to user-friendly messages
    const errorMappings: Record<string, string> = {
      'access_denied': 'You cancelled the login process. Please try again.',
      'invalid_request': 'Invalid login request. Please try again.',
      'unauthorized_client': 'Login service is not properly configured. Please contact support.',
      'unsupported_response_type': 'Login method not supported. Please try a different method.',
      'invalid_scope': 'Insufficient permissions. Please try again.',
      'server_error': 'Login service is temporarily unavailable. Please try again later.',
      'temporarily_unavailable': 'Login service is temporarily unavailable. Please try again later.',
      'oauth_not_configured': 'Social login is not available at the moment. Please use email login.',
      'provider_not_available': 'This login method is not available. Please try a different method.',
      'token_exchange_failed': 'Login verification failed. Please try again.',
      'authentication_failed': 'Login failed. Please try again.',
      'validation_failed': 'Invalid login data. Please try again.',
      'business_logic_error': 'Login could not be completed. Please try again.',
      'callback_error': 'Login verification failed. Please try again.'
    }

    // Check for specific error codes
    for (const [code, friendlyMessage] of Object.entries(errorMappings)) {
      if (message.toLowerCase().includes(code.toLowerCase())) {
        return friendlyMessage
      }
    }

    // Return the original message if no mapping found
    return message
  }
}

export const oauthService = new OAuthService()
export default oauthService