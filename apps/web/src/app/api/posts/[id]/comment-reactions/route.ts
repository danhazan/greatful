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
    const validationError = validateRequiredParams(params, ['id'])
    if (validationError) {
      return createErrorResponse(validationError, 400)
    }

    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }

    const response = await makeBackendRequest(`/api/v1/posts/${params.id}/comment-reactions`, {
      method: 'GET',
      authHeaders: createAuthHeaders(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch comment reactions' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data.data || data)
  } catch (error) {
    return handleApiError(error, 'fetching comment reactions')
  }
}
