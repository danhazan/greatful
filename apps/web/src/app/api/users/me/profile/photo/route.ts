import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  getAuthToken,
  createErrorResponse,
  createSuccessResponse,
  hasValidAuth
} from '@/lib/api-utils'
import { transformApiResponse } from '@/lib/caseTransform'

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return createErrorResponse('No image file provided', 400)
    }

    // Create FormData for backend
    const backendFormData = new FormData()
    backendFormData.append('file', file, file.name)

    // Debug: Log file upload details
    console.log('Uploading file:', file.name, file.type, file.size)

    // ✅ CRITICAL: Create headers WITHOUT Content-Type for FormData
    // Setting Content-Type manually breaks multipart boundary detection
    const token = getAuthToken(request)
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // ✅ Let fetch set Content-Type automatically for FormData
    const response = await fetch(`${API_BASE_URL}/api/v1/users/me/profile/photo`, {
      method: 'POST',
      headers,
      body: backendFormData
    })

    const result = transformApiResponse(await response.json())

    if (!response.ok) {
      return createErrorResponse(
        result.detail || 'Upload failed',
        response.status
      )
    }

    // Backend returns data in success_response format: { success: true, data: {...} }
    return createSuccessResponse(result.data || result, 'Profile photo uploaded successfully')

  } catch (error) {
    return handleApiError(error, 'uploading profile photo')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const token = getAuthToken(request)

    const response = await fetch(`${API_BASE_URL}/api/v1/users/me/profile/photo`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const result = transformApiResponse(await response.json())

    if (!response.ok) {
      return createErrorResponse(
        result.detail || 'Delete failed',
        response.status
      )
    }

    // Backend returns data in success_response format: { success: true, data: {...} }
    return createSuccessResponse(result.data || result, 'Profile photo deleted successfully')

  } catch (error) {
    return handleApiError(error, 'deleting profile photo')
  }
}
