/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/users/me/route'

describe('/api/users/me regression route', () => {
  const originalNodeEnv = process.env['NODE_ENV']

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv
    jest.restoreAllMocks()
  })

  it('returns a clear error for the deprecated PATCH route', async () => {
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH'
    })

    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid route for profile updates. Use /api/users/me/profile with PUT.')
  })

  it('logs a development warning when the old route is hit', async () => {
    process.env['NODE_ENV'] = 'development'
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH'
    })

    await PATCH(request)

    expect(warnSpy).toHaveBeenCalledWith(
      '[api/users/me] Deprecated profile update route hit. Use /api/users/me/profile with PUT instead.'
    )
  })
})
