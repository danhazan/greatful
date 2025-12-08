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
    const response = await makeBackendRequest(`/api/v1/posts/${id}/comments`, {
      method: 'GET',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch comments' },
        { status: response.status }
      )
    }

    const commentsResponse = await response.json()
    const comments = commentsResponse.data || commentsResponse

    // Transform snake_case to camelCase
    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedComments = transformApiResponse(comments)
    return NextResponse.json(transformedComments)

  } catch (error) {
    return handleApiError(error, 'fetching comments')
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
      return createErrorResponse('Comment content is required', 400)
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/comments`, {
      method: 'POST',
      authHeaders,
      body: JSON.stringify({
        content: body.content,
        parent_comment_id: body.parent_comment_id || null
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to add comment' },
        { status: response.status }
      )
    }

    const commentResponse = await response.json()
    const comment = commentResponse.data || commentResponse

    // Transform snake_case to camelCase
    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedComment = transformApiResponse(comment)
    return NextResponse.json(transformedComment, { status: 201 })

  } catch (error) {
    return handleApiError(error, 'adding comment')
  }
}
