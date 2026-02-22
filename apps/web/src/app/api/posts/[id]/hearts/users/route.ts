import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  validateRequiredParams,
  proxyBackendJsonResponse,
  hasValidAuth
} from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate required parameters
    const validationError = validateRequiredParams(params, ['id'])
    if (validationError) {
      return createErrorResponse(validationError, 400)
    }

    const { id } = params

    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)

    // Forward request to backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/hearts/users`, {
      method: 'GET',
      authHeaders,
    })

    return proxyBackendJsonResponse(response)

  } catch (error) {
    return handleApiError(error, 'getting hearts users')
  }
}
