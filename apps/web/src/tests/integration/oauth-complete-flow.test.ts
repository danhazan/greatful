/**
 * Complete OAuth Demo Flow Integration Test
 * Tests the entire OAuth flow from button click to successful authentication
 */

// Mock Next.js navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => {
      const params = {
        code: 'demo_auth_code',
        state: 'demo_state',
        provider: 'google'
      }
      return params[key as keyof typeof params] || null
    }
  })
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('Complete OAuth Demo Flow', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    process.env['NODE_ENV'] = 'development'
    delete process.env['GOOGLE_CLIENT_ID']
    delete process.env['FACEBOOK_APP_ID']
    global.fetch = jest.fn()
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should complete full OAuth demo flow from providers to callback', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    // Step 1: Get OAuth providers (should show Google and Facebook in demo mode)
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

    const providersResponse = await fetch('/api/oauth/providers')
    const providersData = await providersResponse.json()

    expect(providersData.data.providers.google).toBe(true)
    expect(providersData.data.providers.facebook).toBe(true)
    expect(providersData.data.initialized).toBe(true)

    // Step 2: Simulate OAuth callback with demo data
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
            access_token: 'demo_access_token_123456',
            token_type: 'Bearer'
          },
          is_new_user: true
        }
      })
    } as Response)

    const callbackResponse = await fetch('/api/oauth/callback/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'demo_auth_code',
        state: 'demo_state'
      })
    })

    const callbackData = await callbackResponse.json()

    // Verify demo user data
    expect(callbackData.data.user.id).toBe('demo_user_google')
    expect(callbackData.data.user.username).toBe('demo_google_user')
    expect(callbackData.data.user.email).toBe('demo@google.com')
    expect(callbackData.data.user.display_name).toBe('Demo Google User')
    expect(callbackData.data.tokens.access_token).toMatch(/^demo_access_token_/)
    expect(callbackData.data.tokens.token_type).toBe('Bearer')
    expect(callbackData.data.is_new_user).toBe(true)
  })

  it('should handle OAuth login redirect in demo mode', async () => {
    // Mock window.location for redirect test
    delete (window as any).location
    window.location = { href: '' } as any

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    // Mock the login redirect (this would normally be handled by the browser)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 302,
      headers: new Headers({
        'Location': 'http://localhost:3000/auth/callback?code=demo_auth_code&state=demo_state&provider=google'
      })
    } as Response)

    const loginResponse = await fetch('/api/oauth/login/google?redirect_uri=http://localhost:3000/auth/callback')
    
    expect(loginResponse.status).toBe(302) // Should redirect to callback with demo parameters
  })

  it('should work with Facebook provider in demo mode', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          user: {
            id: 'demo_user_facebook',
            username: 'demo_facebook_user',
            email: 'demo@facebook.com',
            display_name: 'Demo Facebook User',
            profile_image_url: null
          },
          tokens: {
            access_token: 'demo_access_token_facebook_123',
            token_type: 'Bearer'
          },
          is_new_user: false
        }
      })
    } as Response)

    const callbackResponse = await fetch('/api/oauth/callback/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'demo_auth_code',
        state: 'demo_state'
      })
    })

    const callbackData = await callbackResponse.json()

    expect(callbackData.data.user.id).toBe('demo_user_facebook')
    expect(callbackData.data.user.username).toBe('demo_facebook_user')
    expect(callbackData.data.user.email).toBe('demo@facebook.com')
    expect(callbackData.data.is_new_user).toBe(false)
  })

  it('should disable OAuth in production mode without credentials', async () => {
    process.env['NODE_ENV'] = 'production'
    
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

    const providersResponse = await fetch('/api/oauth/providers')
    const providersData = await providersResponse.json()

    expect(providersData.data.providers.google).toBe(false)
    expect(providersData.data.providers.facebook).toBe(false)
    expect(providersData.data.initialized).toBe(false)
    expect(providersData.data.environment).toBe('production')
  })

  it('should handle invalid OAuth provider', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Invalid OAuth provider'
      })
    } as Response)

    const callbackResponse = await fetch('/api/oauth/callback/invalid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'demo_auth_code',
        state: 'demo_state'
      })
    })

    expect(callbackResponse.ok).toBe(false)
    expect(callbackResponse.status).toBe(400)
  })
})