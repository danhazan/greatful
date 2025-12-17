import { NextRequest, NextResponse } from 'next/server'
import {
  handleApiError,
  createAuthHeaders,
  makeBackendRequest,
  createErrorResponse,
  validateRequiredParams,
  hasValidAuth
} from '@/lib/api-utils'

// PUT /api/comments/{id} - Edit a comment
export async function PUT(
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
    const response = await makeBackendRequest(`/api/v1/comments/${id}`, {
      method: 'PUT',
      authHeaders,
      body: JSON.stringify({
        content: body.content
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to update comment' },
        { status: response.status }
      )
    }

    const commentResponse = await response.json()
    const comment = commentResponse.data || commentResponse

    // Transform snake_case to camelCase
    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedComment = transformApiResponse(comment)

    return NextResponse.json(transformedComment)

  } catch (error) {
    return handleApiError(error, 'updating comment')
  }
}

// DELETE /api/comments/{id} - Delete a comment
export async function DELETE(
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
    const response = await makeBackendRequest(`/api/v1/comments/${id}`, {
      method: 'DELETE',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to delete comment' },
        { status: response.status }
      )
    }

    const deleteResponse = await response.json()
    const result = deleteResponse.data || deleteResponse

    return NextResponse.json(result)

  } catch (error) {
    return handleApiError(error, 'deleting comment')
  }
}
