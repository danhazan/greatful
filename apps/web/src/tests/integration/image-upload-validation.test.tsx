/**
 * Integration tests for image upload functionality with various file types and sizes
 * This test verifies that the profile photo upload system handles different scenarios correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// Mock fetch globally
global.fetch = jest.fn()

// Mock Response class for Jest
global.Response = class MockResponse {
  status: number
  statusText: string
  ok: boolean
  body: any
  
  constructor(body?: any, init?: ResponseInit) {
    this.status = init?.status || 200
    this.statusText = init?.statusText || 'OK'
    this.ok = this.status >= 200 && this.status < 300
    this.body = body
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
  }
  
  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
  }
} as any

// Mock the API utils
jest.mock('@/lib/api-utils', () => ({
  hasValidAuth: jest.fn(),
  getAuthToken: jest.fn(),
  createErrorResponse: jest.fn((message: string, status: number) => 
    new (global as any).Response(JSON.stringify({ error: message }), { status })
  ),
  createSuccessResponse: jest.fn((data: any, message: string) => 
    new (global as any).Response(JSON.stringify({ data, success: true, message }), { status: 200 })
  ),
  handleApiError: jest.fn((error: any, context: string) => 
    new (global as any).Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 })
  )
}))

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data: any, init?: ResponseInit) => 
      new (global as any).Response(JSON.stringify(data), {
        ...init,
        headers: { 'content-type': 'application/json', ...init?.headers }
      })
    )
  }
}))

// Import after mocks
import { POST } from '@/app/api/users/me/profile/photo/route'

describe('Image Upload Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    const { hasValidAuth, getAuthToken } = require('@/lib/api-utils')
    hasValidAuth.mockReturnValue(true)
    getAuthToken.mockReturnValue('valid-token')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('File Type Validation', () => {
    it('should accept JPEG images', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'profile.jpg' } })
      } as Response)

      const jpegFile = new File(['jpeg data'], 'profile.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', jpegFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should accept PNG images', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'avatar.png' } })
      } as Response)

      const pngFile = new File(['png data'], 'avatar.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', pngFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should accept WebP images', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'profile.webp' } })
      } as Response)

      const webpFile = new File(['webp data'], 'profile.webp', { type: 'image/webp' })
      const formData = new FormData()
      formData.append('file', webpFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should accept GIF images', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'animated.gif' } })
      } as Response)

      const gifFile = new File(['gif data'], 'animated.gif', { type: 'image/gif' })
      const formData = new FormData()
      formData.append('file', gifFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('File Size Validation', () => {
    it('should handle small files (< 1KB)', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'small.jpg' } })
      } as Response)

      // Create small file (100 bytes)
      const smallData = new Array(100).fill('x').join('')
      const smallFile = new File([smallData], 'small.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', smallFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle medium files (1KB - 1MB)', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'medium.jpg' } })
      } as Response)

      // Create medium file (50KB)
      const mediumData = new Array(50 * 1024).fill('x').join('')
      const mediumFile = new File([mediumData], 'medium.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mediumFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle large files (> 1MB)', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'large.jpg' } })
      } as Response)

      // Create large file (2MB)
      const largeData = new Array(2 * 1024 * 1024).fill('x').join('')
      const largeFile = new File([largeData], 'large.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', largeFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('File Metadata Preservation', () => {
    it('should preserve file name and type information', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'test-image.png' } })
      } as Response)

      const testFile = new File(['test data'], 'test-image.png', { 
        type: 'image/png',
        lastModified: Date.now()
      })
      const formData = new FormData()
      formData.append('file', testFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      await POST(request)

      // Verify that the FormData was passed correctly to the backend
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, options] = mockFetch.mock.calls[0]
      
      const forwardedFormData = options?.body as FormData
      expect(forwardedFormData).toBeInstanceOf(FormData)
      
      const forwardedFile = forwardedFormData.get('file') as File
      expect(forwardedFile).toBeDefined()
      expect(forwardedFile.name).toBe('test-image.png')
      expect(forwardedFile.type).toBe('image/png')
    })

    it('should handle files with special characters in names', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'special-chars-äöü-123.jpg' } })
      } as Response)

      const specialFile = new File(['data'], 'special-chars-äöü-123.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', specialFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling for Invalid Files', () => {
    it('should handle backend validation errors gracefully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: 'File too large' })
      } as Response)

      const largeFile = new File(['large data'], 'huge.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', largeFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      
      // The API route should handle backend errors and return appropriate status
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle network errors gracefully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValue(new Error('Network error'))

      const testFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', testFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      const response = await POST(request)
      
      // The API route should handle network errors
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Content-Type Header Validation', () => {
    it('should not manually set Content-Type for FormData uploads', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'test.jpg' } })
      } as Response)

      const testFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', testFile)

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'authorization') return 'Bearer valid-token'
            if (name === 'content-type') return 'multipart/form-data'
            return null
          })
        }
      } as any

      await POST(request)

      // Verify that Content-Type is not manually set (to avoid 422 errors)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, options] = mockFetch.mock.calls[0]
      
      const headers = options?.headers as Record<string, string>
      expect(headers['Content-Type']).toBeUndefined()
      expect(headers['content-type']).toBeUndefined()
      
      // But Authorization should be present
      expect(headers['Authorization']).toBe('Bearer valid-token')
    })
  })
})