import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  hasValidAuth
} from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)

    const body = await request.json()

    // Validate the analytics event
    if (!body.type || !body.postId || !body.userId) {
      return createErrorResponse('Missing required fields: type, postId, userId', 400)
    }

    // Validate event type
    const validTypes = ['reaction_add', 'reaction_remove', 'reaction_change', 'heart', 'share', 'view']
    if (!validTypes.includes(body.type)) {
      return createErrorResponse('Invalid event type', 400)
    }

    // Transform the request to match the backend API format
    const analyticsData = {
      event_type: body.type,
      post_id: body.postId,
      user_id: body.userId,
      metadata: body.metadata || {},
      timestamp: body.timestamp || new Date().toISOString()
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest('/api/v1/analytics/events', {
      method: 'POST',
      authHeaders,
      body: JSON.stringify(analyticsData)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to record analytics event' },
        { status: response.status }
      )
    }

    const result = await response.json()
    // Transform snake_case to camelCase
    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedResult = transformApiResponse(result)
    return NextResponse.json(transformedResult)

  } catch (error) {
    return handleApiError(error, 'recording analytics event')
  }
}