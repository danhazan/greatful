import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  validateRequiredParams,
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

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/image-reactions`, {
      method: 'GET',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch image reactions' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const reactionMappings = data.data || data

    return NextResponse.json(reactionMappings)

  } catch (error) {
    return handleApiError(error, 'fetching image reactions')
  }
}
