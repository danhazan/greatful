import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  validateRequiredParams,
  proxyBackendResponse 
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

    // Create auth headers
    const authHeaders = createAuthHeaders(request)
    if (!authHeaders['Authorization']) {
      return createErrorResponse('Authorization header required', 401)
    }

    // Forward request to backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/hearts/users`, {
      method: 'GET',
      authHeaders,
    })

    return proxyBackendResponse(response)

  } catch (error) {
    return handleApiError(error, 'getting hearts users')
  }
}