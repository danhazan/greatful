import oauthService from '@/services/oauthService'

// Mock fetch globally
global.fetch = jest.fn()

describe('OAuthService', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock window.location
    delete (window as any).location
    window.location = { href: '' } as any
  })

  describe('getProviders', () => {
    it('returns provider status successfully', async () => {
      const mockResponse = {
        data: {
          providers: { google: true, facebook: false },
          redirect_uri: 'http://localhost:3000/auth/callback',
          environment: 'development',
          initialized: true
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await oauthService.getProviders()

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/oauth/providers')
      expect(result).toEqual(mockResponse.data)
    })

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'OAuth not configured' })
      } as Response)

      await expect(oauthService.getProviders()).rejects.toThrow('OAuth not configured')
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(oauthService.getProviders()).rejects.toThrow('Network error')
    })
  })

  describe('initiateLogin', () => {
    it('redirects to OAuth provider URL', async () => {
      await oauthService.initiateLogin('google')

      expect(window.location.href).toBe('http://localhost:8000/api/v1/oauth/login/google')
    })

    it('includes redirect URI in query params', async () => {
      await oauthService.initiateLogin('google', 'http://localhost:3000/callback')

      expect(window.location.href).toBe('http://localhost:8000/api/v1/oauth/login/google?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback')
    })

    it('works with Facebook provider', async () => {
      await oauthService.initiateLogin('facebook')

      expect(window.location.href).toBe('http://localhost:8000/api/v1/oauth/login/facebook')
    })
  })

  describe('handleCallback', () => {
    it('processes OAuth callback successfully', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', username: 'testuser', email: 'test@example.com' },
          tokens: { access_token: 'token123', token_type: 'Bearer' },
          is_new_user: false
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await oauthService.handleCallback('google', 'auth_code_123', 'state_456')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/oauth/callback/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'auth_code_123', state: 'state_456' })
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('handles callback errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ 
          error: 'invalid_grant',
          detail: 'Authorization code expired',
          details: { code: 'EXPIRED_CODE' }
        })
      } as Response)

      await expect(
        oauthService.handleCallback('google', 'expired_code')
      ).rejects.toMatchObject({
        error: 'invalid_grant',
        message: 'Authorization code expired'
      })
    })
  })

  describe('isAvailable', () => {
    it('returns true when OAuth is initialized and providers are available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            providers: { google: true, facebook: false },
            initialized: true
          }
        })
      } as Response)

      const result = await oauthService.isAvailable()
      expect(result).toBe(true)
    })

    it('returns false when OAuth is not initialized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            providers: { google: true, facebook: false },
            initialized: false
          }
        })
      } as Response)

      const result = await oauthService.isAvailable()
      expect(result).toBe(false)
    })

    it('returns false when no providers are available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            providers: { google: false, facebook: false },
            initialized: true
          }
        })
      } as Response)

      const result = await oauthService.isAvailable()
      expect(result).toBe(false)
    })

    it('returns false on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await oauthService.isAvailable()
      expect(result).toBe(false)
    })
  })

  describe('error handling', () => {
    it('maps common OAuth errors to user-friendly messages', () => {
      const testCases = [
        { error: 'access_denied', expected: 'You cancelled the login process. Please try again.' },
        { error: 'invalid_request', expected: 'Invalid login request. Please try again.' },
        { error: 'server_error', expected: 'Login service is temporarily unavailable. Please try again later.' },
        { error: 'oauth_not_configured', expected: 'Social login is not available at the moment. Please use email login.' }
      ]

      testCases.forEach(({ error, expected }) => {
        const result = oauthService.handleOAuthError(error)
        expect(result).toBe(expected)
      })
    })

    it('returns original message for unmapped errors', () => {
      const customError = 'Custom error message'
      const result = oauthService.handleOAuthError(customError)
      expect(result).toBe(customError)
    })

    it('handles error objects with message property', () => {
      const error = { message: 'Error message from object' }
      const result = oauthService.handleOAuthError(error)
      expect(result).toBe('Error message from object')
    })

    it('extracts error message from various error formats', () => {
      const testCases = [
        { input: 'string error', expected: 'string error' },
        { input: { message: 'message error' }, expected: 'message error' },
        { input: { detail: 'detail error' }, expected: 'detail error' },
        { input: { error: 'error property' }, expected: 'error property' },
        { input: {}, expected: 'OAuth authentication failed. Please try again.' }
      ]

      testCases.forEach(({ input, expected }) => {
        const result = oauthService.getErrorMessage(input)
        expect(result).toBe(expected)
      })
    })
  })
})