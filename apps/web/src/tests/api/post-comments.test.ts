/**
 * @jest-environment node
 */

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/posts/[id]/comments/route'

describe('/api/posts/[id]/comments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env['API_BASE_URL'] = 'http://localhost:8000'
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
})
