/**
 * Integration tests for authentication header forwarding
 * Tests that the API proxy correctly forwards auth headers to the backend
 * @jest-environment node
 */

// Mock NextResponse before importing
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status || 200,
      text: async () => JSON.stringify(data),
      ok: (init?.status || 200) < 400
    })
  }
}))

import { proxyApiRequest } from '@/lib/api-proxy'

// Mock fetch
global.fetch = jest.fn()

// Mock Headers if not available
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    private headers: Map<string, string> = new Map()
    
    constructor(init?: HeadersInit) {
      if (init) {
        if (init instanceof Headers) {
          init.forEach((value, key) => this.set(key, value))
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.set(key, value))
        } else {
          Object.entries(init).forEach(([key, value]) => this.set(key, value))
        }
      }
    }
    
    set(key: string, value: string) {
      this.headers.set(key.toLowerCase(), value)
    }
    
    get(key: string): string | null {
      return this.headers.get(key.toLowerCase()) || null
    }
    
    forEach(callback: (value: string, key: string) => void) {
      this.headers.forEach((value, key) => callback(value, key))
    }
  }
}

describe('Auth Header Forwarding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('should forward Authorization header to backend', async () => {
    const mockToken = 'Bearer test-jwt-token'
    
    // Mock successful backend response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ 
        id: 'test-post',
        is_hearted: true,
        current_user_reaction: '❤️'
      }),
      headers: {
        get: (key: string) => key === 'content-type' ? 'application/json' : null
      }
    })

    // Create mock request with Authorization header
    const mockRequest = {
      method: 'GET',
      headers: {
        get: (key: string) => key === 'authorization' ? mockToken : null,
        forEach: (callback: (value: string, key: string) => void) => {
          callback(mockToken, 'authorization')
          callback('application/json', 'content-type')
        }
      }
    }

    // Call the proxy
    const response = await proxyApiRequest(mockRequest, '/api/v1/posts/test-post', {
      requireAuth: false,
      forwardCookies: true,
      passthroughOn401: true
    })

    // Verify fetch was called with correct headers
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/posts/test-post'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers)
      })
    )

    // Get the headers that were sent
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const sentHeaders = fetchCall[1].headers as Headers
    
    // Verify Authorization header was forwarded
    expect(sentHeaders.get('Authorization')).toBe(mockToken)
    
    // Verify response is successful
    expect(response.status).toBe(200)
    
    const responseData = JSON.parse(await response.text())
    expect(responseData.isHearted).toBe(true)
    expect(responseData.currentUserReaction).toBe('❤️')
  })

  it('should work without Authorization header for public endpoints', async () => {
    // Mock successful backend response for anonymous user
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ 
        id: 'test-post',
        is_hearted: false,
        current_user_reaction: null
      }),
      headers: {
        get: (key: string) => key === 'content-type' ? 'application/json' : null
      }
    })

    // Create mock request without Authorization header
    const mockRequest = {
      method: 'GET',
      headers: {
        get: (key: string) => null,
        forEach: (callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type')
        }
      }
    }

    // Call the proxy
    const response = await proxyApiRequest(mockRequest, '/api/v1/posts/test-post', {
      requireAuth: false,
      forwardCookies: true,
      passthroughOn401: true
    })

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalled()

    // Get the headers that were sent
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const sentHeaders = fetchCall[1].headers as Headers
    
    // Verify no Authorization header was sent
    expect(sentHeaders.get('Authorization')).toBeNull()
    
    // Verify response is successful
    expect(response.status).toBe(200)
    
    const responseData = JSON.parse(await response.text())
    expect(responseData.isHearted).toBe(false)
    expect(responseData.currentUserReaction).toBeNull()
  })

  it('should return 401 early when auth is required but missing', async () => {
    // Create mock request without Authorization header
    const mockRequest = {
      method: 'GET',
      headers: {
        get: (key: string) => null,
        forEach: (callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type')
        }
      }
    }

    // Call the proxy with requireAuth: true
    const response = await proxyApiRequest(mockRequest, '/api/v1/users/me/profile', {
      requireAuth: true,
      forwardCookies: true,
      passthroughOn401: true
    })

    // Should return 401 without calling backend
    expect(response.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
    
    const responseData = JSON.parse(await response.text())
    expect(responseData.error).toBe('Authorization header required')
  })

  it('should forward Cookie header when present', async () => {
    const mockCookie = 'session=abc123; csrf=xyz789'
    
    // Mock successful backend response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
      headers: {
        get: (key: string) => key === 'content-type' ? 'application/json' : null
      }
    })

    // Create mock request with Cookie header
    const mockRequest = {
      method: 'GET',
      headers: {
        get: (key: string) => key === 'cookie' ? mockCookie : null,
        forEach: (callback: (value: string, key: string) => void) => {
          callback(mockCookie, 'cookie')
          callback('application/json', 'content-type')
        }
      }
    }

    // Call the proxy
    await proxyApiRequest(mockRequest, '/api/v1/test', {
      requireAuth: false,
      forwardCookies: true,
      passthroughOn401: true
    })

    // Get the headers that were sent
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const sentHeaders = fetchCall[1].headers as Headers
    
    // Verify Cookie header was forwarded
    expect(sentHeaders.get('Cookie')).toBe(mockCookie)
  })
})