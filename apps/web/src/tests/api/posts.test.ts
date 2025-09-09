/**
 * @jest-environment node
 */

// Mock fetch before importing anything else
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/posts/route'
import { describe, it, beforeEach, expect } from '@jest/globals'

describe('/api/posts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_BASE_URL = 'http://localhost:8000'
  })

  describe('POST /api/posts', () => {
    it('creates a post successfully', async () => {
      const mockBackendResponse = {
        id: 'post-123',
        content: 'Test gratitude post',
        rich_content: null,
        post_style: null,
        post_type: 'daily',
        author: {
          id: 1,
          username: 'testuser',
          profile_image_url: null
        },
        created_at: '2025-01-08T12:00:00Z',
        image_url: null,
        location: null,
        location_data: null,
        hearts_count: 0,
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
          // No postTypeOverride - let backend classify automatically
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual({
        id: 'post-123',
        content: 'Test gratitude post',
        postStyle: null,
        author: {
          id: '1',
          name: 'testuser',
          image: null
        },
        createdAt: '2025-01-08T12:00:00Z',
        postType: 'daily',
        imageUrl: null,
        location: null,
        location_data: null,
        heartsCount: 0,
        isHearted: false,
        reactionsCount: 0,
        currentUserReaction: null
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: 'Test gratitude post',
            post_style: null,
            title: null,
            image_url: null,
            location: null,
            location_data: null,
            post_type_override: null, // No override - let backend classify
            is_public: true
          })
        }
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test post',
          postType: 'daily'
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
      expect(data.error).toBe('Content is required')
    })

    it('validates post type override', async () => {
      // Mock backend response for invalid post type override
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          detail: 'Invalid post type override. Must be one of: daily, photo, spontaneous'
        })
      } as Response)

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: 'Test content',
          postTypeOverride: 'invalid'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('Invalid post type override')
    })

    it('validates character limits for auto-detected daily posts', async () => {
      // Mock backend response for character limit validation
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 422,
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

    it('validates character limits for post type override', async () => {
      // Mock backend response for character limit validation with override
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 422,
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
          content: 'a'.repeat(5001), // Exceeds 5000 char limit
          postTypeOverride: 'spontaneous'
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
        json: async () => ({ detail: 'Internal server error' })
      })

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: 'Test content',
          postType: 'daily'
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
      const mockBackendResponse = [
        {
          id: 'post-1',
          content: 'First post',
          post_type: 'daily',
          author: {
            id: 1,
            username: 'user1',
            name: 'User One'
          },
          created_at: '2025-01-08T12:00:00Z',
          hearts_count: 5,
          reactions_count: 3
        },
        {
          id: 'post-2',
          content: 'Second post',
          post_type: 'photo',
          author: {
            id: 2,
            username: 'user2',
            name: 'User Two'
          },
          created_at: '2025-01-08T11:00:00Z',
          hearts_count: 2,
          reactions_count: 1
        }
      ]

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
      expect(data).toHaveLength(2)
      expect(data[0]).toEqual({
        id: 'post-1',
        content: 'First post',
        author: {
          id: '1',
          name: 'User One',
          username: 'user1',
          display_name: undefined,
          image: null
        },
        createdAt: '2025-01-08T12:00:00Z',
        postType: 'daily',
        imageUrl: undefined,
        location: undefined,
        heartsCount: 5,
        isHearted: false,
        reactionsCount: 3,
        currentUserReaction: undefined
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/feed?limit=20&offset=0',
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
        json: async () => []
      })

      const request = new NextRequest('http://localhost:3000/api/posts?limit=10&offset=5', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      await GET(request)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/posts/feed?limit=10&offset=5',
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