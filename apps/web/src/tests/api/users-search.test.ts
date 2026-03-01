/**
 * @jest-environment node
 */

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/users/search/route'

describe('/api/users/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env['NEXT_PUBLIC_API_URL'] = 'http://localhost:8000'
  })

  it('normalizes wrapped search response user profileImageUrl to absolute URL', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 7,
            username: 'search_user',
            display_name: 'Search User',
            profile_image_url: '/uploads/profile_photos/search_user.jpg',
            bio: 'test bio',
          },
        ],
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/users/search', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: 'search', limit: 10 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.data[0].profileImageUrl).toBe('http://localhost:8000/uploads/profile_photos/search_user.jpg')
    expect(data.data[0].image).toBe('http://localhost:8000/uploads/profile_photos/search_user.jpg')
  })
})
