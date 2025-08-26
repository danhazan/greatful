import { NextRequest, NextResponse } from "next/server"
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  proxyBackendResponse 
} from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    // Create auth headers
    const authHeaders = createAuthHeaders(request)
    if (!authHeaders['Authorization']) {
      return createErrorResponse('Authorization header required', 401)
    }

    const response = await makeBackendRequest('/api/v1/users/me/profile', {
      method: 'GET',
      authHeaders,
    })

    return proxyBackendResponse(response)
  } catch (error) {
    return handleApiError(error, 'getting profile')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Create auth headers
    const authHeaders = createAuthHeaders(request)
    if (!authHeaders['Authorization']) {
      return createErrorResponse('Authorization header required', 401)
    }

    const response = await makeBackendRequest('/api/v1/users/me/profile', {
      method: 'PUT',
      authHeaders,
      body: JSON.stringify(body),
    })

    return proxyBackendResponse(response)
  } catch (error) {
    return handleApiError(error, 'updating profile')
  }
}