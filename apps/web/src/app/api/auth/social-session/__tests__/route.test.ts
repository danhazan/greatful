/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/social-session/route'

describe('/api/auth/social-session', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  const backendAuthData = {
    success: true,
    data: {
      user: { id: 42, email: 'native@example.com', username: 'native' },
      access_token: 'access_token_123',
      refresh_token: 'refresh_token_123',
      token_type: 'bearer',
      is_new_user: false,
    },
  }

  function mockBackendResponse(status: number, body: unknown) {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch
  }

  it('forwards the token to the backend consume endpoint', async () => {
    mockBackendResponse(200, backendAuthData)
    const request = new NextRequest('http://localhost:3000/api/auth/social-session', {
      method: 'POST',
      body: JSON.stringify({ bootstrap_token: 'opaque.token.value' }),
    })

    const response = await POST(request)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/oauth/web-session/bootstrap/consume'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ bootstrap_token: 'opaque.token.value' }),
      }),
    )
    expect(response.status).toBe(200)
  })

  it('sets auth cookies from the canonical AuthResponse', async () => {
    mockBackendResponse(200, backendAuthData)

    const request = new NextRequest('http://localhost:3000/api/auth/social-session', {
      method: 'POST',
      body: JSON.stringify({ bootstrap_token: 'opaque.token.value' }),
    })

    const response = await POST(request)

    expect(response.cookies.get('refresh_token')?.value).toBe('refresh_token_123')
    expect(response.cookies.get('refresh_token')?.httpOnly).toBe(true)
  })

  it('proxies backend failures without leaking token details', async () => {
    mockBackendResponse(401, { detail: 'Invalid or expired bootstrap token' })
    const request = new NextRequest('http://localhost:3000/api/auth/social-session', {
      method: 'POST',
      body: JSON.stringify({ bootstrap_token: 'opaque.token.value' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('rejects a missing bootstrap_token', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/social-session', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('never places the bootstrap token in cookies', async () => {
    mockBackendResponse(200, backendAuthData)
    const request = new NextRequest('http://localhost:3000/api/auth/social-session', {
      method: 'POST',
      body: JSON.stringify({ bootstrap_token: 'opaque.token.value' }),
    })

    const response = await POST(request)

    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).not.toContain('opaque.token.value')
  })
})