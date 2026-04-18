/**
 * @jest-environment node
 */

// Mock fetch before importing anything else
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/posts/route'
import { describe, it, beforeEach, expect, jest } from '@jest/globals'

describe('/api/posts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env['API_BASE_URL'] = 'http://localhost:8000'
  })

  describe('POST /api/posts', () => {
    it('creates a post successfully', async () => {
      const mockBackendResponse = {
        id: 'post-123',
        content: 'Test gratitude post',
        rich_content: null,
        post_style: null,
        author: {
          id: 1,
          username: 'testuser',
          profile_image_url: null
        },
        created_at: '2025-01-08T12:00:00Z',
        image_url: null,
        location: null,
        location_data: null,
        reactions_count: 0,
        current_user_reaction: null
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse
      })

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Test gratitude post'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toMatchObject({
        id: 'post-123',
        content: 'Test gratitude post',
        postStyle: null,
        author: {
          id: '1',
          username: 'testuser',
          profileImageUrl: null
        },
        createdAt: '2025-01-08T12:00:00Z',
        imageUrl: null,
        location: null,
        locationData: null,
        reactionsCount: 0,
        currentUserReaction: null
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"content":"Test gratitude post"')
        })
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test post',
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })

    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Either content or image must be provided')
    })

    it('allows image-only posts', async () => {
      // Mock successful backend response for image-only post
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'test-post-id',
          content: '',
          author: {
            id: 1,
            username: 'testuser',
            display_name: 'Test User',
            email: 'test@example.com'
          },
          created_at: '2023-01-01T00:00:00Z',
          image_url: 'http://localhost:8000/uploads/test-image.jpg',
          reactions_count: 0
        })
      } as Response)

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          content: '',
          image_url: 'http://localhost:8000/uploads/test-image.jpg'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.id).toBe('test-post-id')
      expect(data.content).toBe('')
      expect(data.imageUrl).toBe('http://localhost:8000/uploads/test-image.jpg')
    })

    it('maps camelCase request fields to backend snake_case payload', async () => {
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'post-camel-123',
          content: 'camel payload',
          author: { id: 1, username: 'testuser', profile_image_url: null },
          created_at: '2025-01-08T12:00:00Z',
          image_url: 'https://example.com/test.png'
        })
      } as Response)

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          content: 'camel payload',
          richContent: '<p>rich</p>',
          postStyle: 'sunset',
          imageUrl: 'https://example.com/test.png',
          locationData: '{"city":"Tel Aviv"}',
          isPublic: false
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(201)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"content":"camel payload"')
        })
      )
    })


    it('validates character limits for posts', async () => {
      // Mock backend response for character limit validation
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: {
          get: () => 'application/json'
        },
        json: async () => ({
          detail: 'Content too long. Maximum 5000 characters allowed. Current: 5001 characters.'
        })
      } as Response)

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: 'a'.repeat(5001) // Long content exceeds universal limit
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('Content too long')
    })


    it('handles backend errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => 'application/json'
        },
        json: async () => ({ detail: 'Internal server error' })
      })

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: 'Test content',
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('GET /api/posts', () => {
    it('fetches posts successfully', async () => {
      const mockBackendResponse = {
        posts: [
          {
            id: 'post-1',
            content: 'First post',
            author: {
              id: 1,
              username: 'user1',
              name: 'User One'
            },
            created_at: '2025-01-08T12:00:00Z',
            reactions_count: 3
          },
          {
            id: 'post-2',
            content: 'Second post',
            author: {
              id: 2,
              username: 'user2',
              name: 'User Two'
            },
            created_at: '2025-01-08T11:00:00Z',
            reactions_count: 1
          }
        ],
        next_cursor: null
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse
      })

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.posts).toHaveLength(2)
      expect(data.posts[0]).toMatchObject({
        id: 'post-1',
        content: 'First post',
        author: {
          id: '1',
          name: 'User One',
          username: 'user1'
        },
        createdAt: '2025-01-08T12:00:00Z',
        reactionsCount: 3
      })
      expect(data.nextCursor).toBeNull()

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/feed?page_size=10',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('handles query parameters', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: [], next_cursor: null })
      })

      const request = new NextRequest('http://localhost:3000/api/posts?cursor=abc123&page_size=5', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      await GET(request)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/feed?cursor=abc123&page_size=5',
        expect.any(Object)
      )
    })

    it('forwards filter query parameters', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: [], next_cursor: null })
      })

      const request = new NextRequest(
        'http://localhost:3000/api/posts?page_size=10&required_filters=today&required_filters=images&boost_filters=mine&boost_filters=last_week',
        {
          method: 'GET',
          headers: {
            'authorization': 'Bearer test-token'
          }
        }
      )

      await GET(request)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/feed?page_size=10&required_filters=today&required_filters=images&boost_filters=mine&boost_filters=last_week',
        expect.any(Object)
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })
  })
})
