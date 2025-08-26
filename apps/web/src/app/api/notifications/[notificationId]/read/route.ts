import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  validateRequiredParams,
  createSuccessResponse 
} from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    // Validate required parameters
    const validationError = validateRequiredParams(params, ['notificationId'])
    if (validationError) {
      return createErrorResponse(validationError, 400)
    }

    const { notificationId } = params

    // Create auth headers
    const authHeaders = createAuthHeaders(request)
    if (!authHeaders['Authorization']) {
      return createErrorResponse('Authorization header required', 401)
    }

    // Forward request to backend
    const response = await makeBackendRequest(`/api/v1/notifications/${notificationId}/read`, {
      method: 'POST',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.detail || 'Failed to mark notification as read' },
        { status: response.status }
      )
    }

    return createSuccessResponse(undefined, 'Notification marked as read')

  } catch (error) {
    return handleApiError(error, 'marking notification as read')
  }
}