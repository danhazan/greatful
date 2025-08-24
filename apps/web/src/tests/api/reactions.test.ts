/**
 * @jest-environment node
 */

// Mock fetch before importing anything else
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '@/app/api/posts/[id]/reactions/route'

describe('/api/posts/[id]/reactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_BASE_URL = 'http://localhost:8000'
  })

  describe('GET /api/posts/[id]/reactions', () => {
    it('fetches reactions successfully', async () => {
      const mockBackendResponse = [
        {
          id: 'reaction-1',
          user_id: 1,
          emoji_code: 'heart_eyes',
          created_at: '2025-01-08T12:00:00Z',
          user: {
            username: 'john_doe',
            profile_image_url: 'https://example.com/john.jpg'
          }
        },
        {
          id: 'reaction-2',
          user_id: 2,
          emoji_code: 'fire',
          created_at: '2025-01-08T11:00:00Z',
          user: {
            username: 'jane_smith',
            profile_image_url: null
          }
        }
      ]

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse
      })

      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await GET(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0]).toEqual({
        id: 'reaction-1',
        userId: '1',
        userName: 'john_doe',
        userImage: 'https://example.com/john.jpg',
        emojiCode: 'heart_eyes',
        createdAt: '2025-01-08T12:00:00Z'
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/post-123/reactions',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'GET'
      })

      const response = await GET(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })

    it('handles backend errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Post not found' })
      })

      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await GET(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Post not found')
    })
  })

  describe('POST /api/posts/[id]/reactions', () => {
    it('adds reaction successfully', async () => {
      const mockBackendResponse = {
        id: 'reaction-123',
        user_id: 1,
        emoji_code: 'heart_eyes',
        created_at: '2025-01-08T12:00:00Z',
        user: {
          username: 'testuser',
          profile_image_url: null
        }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse
      })

      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          emoji_code: 'heart_eyes'
        })
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual({
        id: 'reaction-123',
        userId: '1',
        userName: 'testuser',
        userImage: null,
        emojiCode: 'heart_eyes',
        createdAt: '2025-01-08T12:00:00Z'
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/post-123/reactions',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emoji_code: 'heart_eyes'
          })
        }
      )
    })

    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Emoji code is required')
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'POST',
        body: JSON.stringify({
          emoji_code: 'heart_eyes'
        })
      })

      const response = await POST(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })
  })

  describe('DELETE /api/posts/[id]/reactions', () => {
    it('removes reaction successfully', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'DELETE',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await DELETE(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/post-123/reactions',
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })

    it('handles backend errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Reaction not found' })
      })

      const request = new NextRequest('http://localhost:3000/api/posts/post-123/reactions', {
        method: 'DELETE',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await DELETE(request, { params: { id: 'post-123' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Reaction not found')
    })
  })
})