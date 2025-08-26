/**
 * @jest-environment node
 */

// Mock fetch before importing anything else
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/notifications/route'
import { POST as MarkAsRead } from '@/app/api/notifications/[notificationId]/read/route'
import { POST as MarkAllAsRead } from '@/app/api/notifications/read-all/route'

describe('/api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_BASE_URL = 'http://localhost:8000'
  })

  describe('GET /api/notifications', () => {
    it('fetches notifications successfully', async () => {
      const mockBackendResponse = [
        {
          id: 'notification-1',
          type: 'reaction',
          message: 'reacted to your post',
          post_id: 'post-1',
          from_user: {
            id: 2,
            username: 'john_doe',
            profile_image_url: 'https://example.com/john.jpg'
          },
          created_at: '2025-01-08T12:00:00Z',
          read: false
        },
        {
          id: 'notification-2',
          type: 'comment',
          message: 'commented on your post',
          post_id: 'post-2',
          from_user: {
            id: 3,
            username: 'jane_smith',
            profile_image_url: null
          },
          created_at: '2025-01-08T11:00:00Z',
          read: true
        }
      ]

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse
      })

      const request = new NextRequest('http://localhost:3000/api/notifications', {
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
        id: 'notification-1',
        type: 'reaction',
        message: 'reacted to your post',
        postId: 'post-1',
        fromUser: {
          id: 2,
          name: 'john_doe',
          image: 'https://example.com/john.jpg'
        },
        createdAt: '2025-01-08T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/notifications?limit=20&offset=0',
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

      const request = new NextRequest('http://localhost:3000/api/notifications?limit=10&offset=5', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      await GET(request)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/notifications?limit=10&offset=5',
        expect.any(Object)
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })

    it('handles backend errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' })
      })

      const request = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST /api/notifications/[id]/read', () => {
    it('marks notification as read successfully', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      const request = new NextRequest('http://localhost:3000/api/notifications/notification-1/read', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await MarkAsRead(request, { params: { notificationId: 'notification-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/notifications/notification-1/read',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/notifications/notification-1/read', {
        method: 'POST'
      })

      const response = await MarkAsRead(request, { params: { notificationId: 'notification-1' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })

    it('handles backend errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Notification not found' })
      })

      const request = new NextRequest('http://localhost:3000/api/notifications/notification-1/read', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await MarkAsRead(request, { params: { notificationId: 'notification-1' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Notification not found')
    })
  })

  describe('POST /api/notifications/read-all', () => {
    it('marks all notifications as read successfully', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      const request = new NextRequest('http://localhost:3000/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await MarkAllAsRead(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/notifications/read-all',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('returns 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/notifications/read-all', {
        method: 'POST'
      })

      const response = await MarkAllAsRead(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authorization header required')
    })

    it('handles backend errors', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' })
      })

      const request = new NextRequest('http://localhost:3000/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await MarkAllAsRead(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})