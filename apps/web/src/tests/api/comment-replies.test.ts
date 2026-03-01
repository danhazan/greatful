/**
 * @jest-environment node
 */

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/comments/[id]/replies/route'

describe('/api/comments/[id]/replies', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env['API_BASE_URL'] = 'http://localhost:8000'
    process.env['NEXT_PUBLIC_API_URL'] = 'http://localhost:8000'
  })

  it('normalizes reply user profileImageUrl to absolute URL', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'reply-1',
            content: 'reply',
            user: {
              id: 22,
              username: 'reply_user',
              profile_image_url: '/uploads/profile_photos/reply_user.jpg',
            },
          },
        ],
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/comments/comment-1/replies', {
      method: 'GET',
      headers: { authorization: 'Bearer test-token' },
    })

    const response = await GET(request, { params: { id: 'comment-1' } })
    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data[0].user.profileImageUrl).toBe('http://localhost:8000/uploads/profile_photos/reply_user.jpg')
  })
})
