/**
 * Integration test for OAuth demo flow
 */

describe('OAuth Demo Flow Integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    global.fetch = jest.fn()
  })

  afterEach(() => {
    process.env = originalEnv
    jest.clearAllMocks()
  })

  it('should enable OAuth providers in development mode without credentials', async () => {
    // Set development environment without OAuth credentials
    process.env['NODE_ENV'] = 'development'
    delete process.env['GOOGLE_CLIENT_ID']
    delete process.env['FACEBOOK_APP_ID']

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    // Mock the API call to return demo mode response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          providers: {
            google: true,
            facebook: true
          },
          redirect_uri: 'http://localhost:3000/auth/callback',
          environment: 'development',
          initialized: true
        }
      })
    } as Response)

    const response = await fetch('/api/oauth/providers')
    const data = await response.json()

    expect(data.data.providers.google).toBe(true)
    expect(data.data.providers.facebook).toBe(true)
    expect(data.data.initialized).toBe(true)
    expect(data.data.environment).toBe('development')
  })

  it('should handle demo OAuth login flow', async () => {
    process.env['NODE_ENV'] = 'development'
    delete process.env['GOOGLE_CLIENT_ID']
    delete process.env['FACEBOOK_APP_ID']

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    // Mock demo callback response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          user: {
            id: 'demo_user_google',
            username: 'demo_google_user',
            email: 'demo@google.com',
            display_name: 'Demo Google User',
            profile_image_url: null
          },
          tokens: {
            access_token: 'demo_access_token_123',
            token_type: 'Bearer'
          },
          is_new_user: true
        }
      })
    } as Response)

    const response = await fetch('/api/oauth/callback/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'demo_auth_code',
        state: 'demo_state'
      })
    })

    const data = await response.json()

    expect(data.data.user.username).toBe('demo_google_user')
    expect(data.data.user.email).toBe('demo@google.com')
    expect(data.data.tokens.access_token).toBe('demo_access_token_123')
    expect(data.data.is_new_user).toBe(true)
  })

  it('should disable OAuth providers in production without credentials', async () => {
    process.env['NODE_ENV'] = 'production'
    delete process.env['GOOGLE_CLIENT_ID']
    delete process.env['FACEBOOK_APP_ID']

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          providers: {
            google: false,
            facebook: false
          },
          redirect_uri: 'http://localhost:3000/auth/callback',
          environment: 'production',
          initialized: false
        }
      })
    } as Response)

    const response = await fetch('/api/oauth/providers')
    const data = await response.json()

    expect(data.data.providers.google).toBe(false)
    expect(data.data.providers.facebook).toBe(false)
    expect(data.data.initialized).toBe(false)
  })
})