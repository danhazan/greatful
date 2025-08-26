import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  createSuccessResponse,
  hasValidAuth
} from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)

    // Forward request to backend
    const response = await makeBackendRequest('/api/v1/notifications/read-all', {
      method: 'POST',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.detail || 'Failed to mark all notifications as read' },
        { status: response.status }
      )
    }

    return createSuccessResponse(undefined, 'All notifications marked as read')

  } catch (error) {
    return handleApiError(error, 'marking all notifications as read')
  }
}