/**
 * @jest-environment node
 */

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/posts/[id]/comments/route'

describe('/api/posts/[id]/comments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env['API_BASE_URL'] = 'http://localhost:8000'
    process.env['NEXT_PUBLIC_API_URL'] = 'http://localhost:8000'
  })

  it('maps parentCommentId to parent_comment_id for backend requests', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'comment-1',
        content: 'Reply',
        parent_comment_id: 'parent-1',
        created_at: '2025-01-08T12:00:00Z'
      })
    })

    const request = new NextRequest('http://localhost:3000/api/posts/post-123/comments', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer test-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        content: 'Reply',
        parentCommentId: 'parent-1'
      })
    })

    const response = await POST(request, { params: { id: 'post-123' } })
    expect(response.status).toBe(201)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/posts/post-123/comments',
      expect.objectContaining({
        body: JSON.stringify({
          content: 'Reply',
          parent_comment_id: 'parent-1'
        })
      })
    )
  })

  it('normalizes comment user profileImageUrl to absolute URL', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'comment-1',
            content: 'Top comment',
            user: {
              id: 10,
              username: 'alice',
              profile_image_url: '/uploads/profile_photos/alice.jpg'
            },
            replies: [
              {
                id: 'reply-1',
                content: 'Nested reply',
                user: {
                  id: 11,
                  username: 'bob',
                  profile_image_url: '/uploads/profile_photos/bob.jpg'
                }
              }
            ]
          }
        ]
      })
    })

    const request = new NextRequest('http://localhost:3000/api/posts/post-123/comments', {
      method: 'GET',
      headers: { 'authorization': 'Bearer test-token' }
    })

    const response = await GET(request, { params: { id: 'post-123' } })
    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data[0].user.profileImageUrl).toBe('http://localhost:8000/uploads/profile_photos/alice.jpg')
    expect(data[0].replies[0].user.profileImageUrl).toBe('http://localhost:8000/uploads/profile_photos/bob.jpg')
  })
})
