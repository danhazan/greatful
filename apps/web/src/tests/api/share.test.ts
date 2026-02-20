/**
 * @jest-environment node
 */

// Mock fetch before importing anything else
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'

describe('Share API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env['BACKEND_URL'] = 'http://localhost:8000'
    // Mock successful backend response
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'share-123',
        user_id: 1,
        post_id: 'post-123',
        share_method: 'url',
        share_url: 'http://localhost:3000/post/post-123',
        created_at: '2025-01-08T12:00:00Z'
      })
    })
  })

  describe('POST /api/posts/[id]/share', () => {
    it('should proxy URL share request to backend', async () => {
      const { POST } = await import('@/app/api/posts/[id]/share/route')
      
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/share', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          share_method: 'url'
        })
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/post-123/share',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            share_method: 'url'
          })
        }
      )

      expect(response.status).toBe(201)
      // API now returns camelCase
      expect(data.shareMethod).toBe('url')
      expect(data.shareUrl).toContain('/post/post-123')
    })

    it('should proxy message share request to backend', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'share-456',
          user_id: 1,
          post_id: 'post-123',
          share_method: 'message',
          recipient_count: 2,
          message_content: 'Check this out!',
          created_at: '2025-01-08T12:00:00Z'
        })
      })

      const { POST } = await import('@/app/api/posts/[id]/share/route')
      
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/share', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          share_method: 'message',
          recipient_ids: [2, 3],
          message: 'Check this out!'
        })
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/post-123/share',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            share_method: 'message',
            recipient_ids: [2, 3],
            message: 'Check this out!'
          })
        }
      )

      expect(response.status).toBe(201)
      // API now returns camelCase
      expect(data.shareMethod).toBe('message')
      expect(data.recipientCount).toBe(2)
      expect(data.messageContent).toBe('Check this out!')
    })

    it('should handle backend validation errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          detail: 'Message share requires at least one recipient'
        })
      })

      const { POST } = await import('@/app/api/posts/[id]/share/route')
      
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/share', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          share_method: 'message',
          recipient_ids: [],
          message: 'Test'
        })
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      
      expect(response.status).toBe(422)
    })

    it('should handle rate limit errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          detail: 'Share rate limit exceeded. You can share 20 posts per hour. Try again in 15 minutes.'
        })
      })

      const { POST } = await import('@/app/api/posts/[id]/share/route')
      
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/share', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          share_method: 'message',
          recipient_ids: [2],
          message: 'Test'
        })
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      
      expect(response.status).toBe(429)
    })

    it('should handle authentication errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          detail: 'Not authenticated'
        })
      })

      const { POST } = await import('@/app/api/posts/[id]/share/route')
      
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          share_method: 'url'
        })
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      
      expect(response.status).toBe(401)
    })

    it('should handle post not found errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          detail: 'Post not found'
        })
      })

      const { POST } = await import('@/app/api/posts/[id]/share/route')
      
      const request = new NextRequest('http://localhost:3000/api/posts/nonexistent/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          share_method: 'url'
        })
      })

      const response = await POST(request, { params: { id: 'nonexistent' } })
      
      expect(response.status).toBe(401)
    })
  })
})