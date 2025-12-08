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
    const response = await makeBackendRequest(`/api/v1/comments/${id}/replies`, {
      method: 'GET',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch replies' },
        { status: response.status }
      )
    }

    const repliesResponse = await response.json()
    const replies = repliesResponse.data || repliesResponse

    // Transform snake_case to camelCase
    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedReplies = transformApiResponse(replies)

    return NextResponse.json(transformedReplies)

  } catch (error) {
    return handleApiError(error, 'fetching replies')
  }
}

export async function POST(
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

    const body = await request.json()

    // Validate required fields
    if (!body.content) {
      return createErrorResponse('Reply content is required', 400)
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/comments/${id}/replies`, {
      method: 'POST',
      authHeaders,
      body: JSON.stringify({
        content: body.content
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to add reply' },
        { status: response.status }
      )
    }

    const replyResponse = await response.json()
    const reply = replyResponse.data || replyResponse

    // Transform snake_case to camelCase
    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedReply = transformApiResponse(reply)

    return NextResponse.json(transformedReply, { status: 201 })

  } catch (error) {
    return handleApiError(error, 'adding reply')
  }
}
