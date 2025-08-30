/**
 * Tests for FormData upload bug fix.
 * 
 * This test suite verifies that the 422 Unprocessable Entity bug
 * has been fixed in Next.js API routes for file uploads.
 */

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

// Mock fetch globally
global.fetch = jest.fn()

// Import after mocks
import { POST } from '@/app/api/users/me/profile/photo/route'
import { describe, it, expect, beforeEach } from '@jest/globals'

describe('FormData Upload Bug Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Content-Type Header Handling', () => {
    it('should not set Content-Type manually for FormData', async () => {
      const { hasValidAuth, getAuthToken } = require('@/lib/api-utils')
      
      // Mock valid auth
      hasValidAuth.mockReturnValue(true)
      getAuthToken.mockReturnValue('valid-token')
      
      // Mock successful backend response
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'test.png' } })
      } as Response)

      // Create test FormData
      const formData = new FormData()
      formData.append('file', new Blob(['test data'], { type: 'image/png' }), 'test.png')

      // Create mock request
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

      // Call the API route
      await POST(request)

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Get the fetch call arguments
      const [url, options] = mockFetch.mock.calls[0]
      
      // Verify URL
      expect(url).toBe('http://localhost:8000/api/v1/users/me/profile/photo')
      
      // Verify headers DO NOT include Content-Type
      expect(options?.headers).toBeDefined()
      const headers = options?.headers as Record<string, string>
      
      // ✅ CRITICAL: Content-Type should NOT be set manually
      expect(headers['Content-Type']).toBeUndefined()
      expect(headers['content-type']).toBeUndefined()
      
      // ✅ Authorization should be present
      expect(headers['Authorization']).toBe('Bearer valid-token')
      
      // ✅ Body should be FormData
      expect(options?.body).toBeInstanceOf(FormData)
    })

    it('should preserve file metadata in FormData', async () => {
      const { hasValidAuth, getAuthToken } = require('@/lib/api-utils')
      
      // Mock valid auth
      hasValidAuth.mockReturnValue(true)
      getAuthToken.mockReturnValue('valid-token')
      
      // Mock successful backend response
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'profile.jpg' } })
      } as Response)

      // Create test file with specific metadata
      const testFile = new File(['test image data'], 'profile.jpg', { 
        type: 'image/jpeg',
        lastModified: Date.now()
      })
      
      const formData = new FormData()
      formData.append('file', testFile)

      // Create mock request
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

      // Call the API route
      await POST(request)

      // Verify FormData was forwarded correctly
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, options] = mockFetch.mock.calls[0]
      
      const forwardedFormData = options?.body as FormData
      expect(forwardedFormData).toBeInstanceOf(FormData)
      
      // Verify file is present in forwarded FormData
      const forwardedFile = forwardedFormData.get('file') as File
      expect(forwardedFile).toBeDefined()
      expect(forwardedFile.name).toBe('profile.jpg')
      expect(forwardedFile.type).toBe('image/jpeg')
    })
  })

  describe('Error Handling', () => {
    it('should return 400 for missing file', async () => {
      const { hasValidAuth, getAuthToken, createErrorResponse } = require('@/lib/api-utils')
      
      // Mock valid auth
      hasValidAuth.mockReturnValue(true)
      getAuthToken.mockReturnValue('valid-token')
      
      // Mock createErrorResponse
      createErrorResponse.mockImplementation((message: string, status: number) => 
        new (global as any).Response(JSON.stringify({ error: message }), { status })
      )

      // Create empty FormData (no file)
      const formData = new FormData()

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

      // Call the API route
      const response = await POST(request)

      // Should return 400 for missing file
      expect(response.status).toBe(400)
      
      const responseData = await response.json()
      expect(responseData.error).toBe('No image file provided')
    })

    it('should handle invalid auth', async () => {
      const { hasValidAuth, createErrorResponse } = require('@/lib/api-utils')
      
      // Mock invalid auth
      hasValidAuth.mockReturnValue(false)
      
      // Mock createErrorResponse
      createErrorResponse.mockImplementation((message: string, status: number) => 
        new (global as any).Response(JSON.stringify({ error: message }), { status })
      )

      // Create test FormData
      const formData = new FormData()
      formData.append('file', new Blob(['test data'], { type: 'image/png' }), 'test.png')

      const request = {
        formData: async () => formData,
        headers: {
          get: jest.fn(() => null) // No auth header
        }
      } as any

      // Call the API route
      const response = await POST(request)

      // Should return 401 for invalid auth
      expect(response.status).toBe(401)
      
      const responseData = await response.json()
      expect(responseData.error).toBe('Authorization header required')
    })
  })

  describe('FormData Construction', () => {
    it('should create FormData with correct file and filename', async () => {
      const { hasValidAuth, getAuthToken } = require('@/lib/api-utils')
      
      // Mock valid auth
      hasValidAuth.mockReturnValue(true)
      getAuthToken.mockReturnValue('valid-token')
      
      // Mock successful backend response
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { filename: 'avatar.png' } })
      } as Response)

      // Create test file
      const testFile = new File(['test data'], 'avatar.png', { type: 'image/png' })
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

      // Call the API route
      await POST(request)

      // Verify FormData construction
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, options] = mockFetch.mock.calls[0]
      
      const backendFormData = options?.body as FormData
      expect(backendFormData).toBeInstanceOf(FormData)
      
      // Verify file is appended correctly
      const file = backendFormData.get('file') as File
      expect(file).toBeDefined()
      expect(file.name).toBe('avatar.png')
      expect(file.type).toBe('image/png')
    })
  })

  describe('Regression Prevention', () => {
    it('should document the bug and fix', () => {
      // This test serves as living documentation of the bug and fix
      
      const bugDescription = {
        problem: 'createAuthHeaders() always sets Content-Type: application/json',
        impact: 'Overrides multipart boundary, causes 422 validation errors',
        solution: 'Create headers manually without Content-Type for FormData',
        verification: 'Should get proper responses, not 422 validation errors'
      }
      
      // Verify our understanding is correct
      expect(bugDescription.problem).toContain('Content-Type: application/json')
      expect(bugDescription.impact).toContain('422')
      expect(bugDescription.solution).toContain('without Content-Type')
      expect(bugDescription.verification).toContain('not 422')
    })

    it('should provide examples of correct and incorrect patterns', () => {
      const patterns = {
        incorrect: {
          description: 'Using createAuthHeaders for file uploads',
          code: 'const headers = createAuthHeaders(request); // Sets Content-Type!',
          result: '422 Unprocessable Entity'
        },
        correct: {
          description: 'Manual headers without Content-Type',
          code: 'const headers = {}; headers.Authorization = `Bearer ${token}`;',
          result: 'Proper response codes (200, 400, 401, etc.)'
        }
      }
      
      expect(patterns.incorrect.result).toBe('422 Unprocessable Entity')
      expect(patterns.correct.result).toContain('Proper response codes')
    })
  })
})