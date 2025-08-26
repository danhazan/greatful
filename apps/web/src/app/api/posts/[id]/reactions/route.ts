import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  validateRequiredParams 
} from '@/lib/api-utils'
import { transformReactions, transformReaction, type BackendReaction } from '@/lib/transformers'

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

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/reactions`, {
      method: 'GET',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch reactions' },
        { status: response.status }
      )
    }

    const reactions = await response.json()

    // Transform the reactions to match the frontend format
    const transformedReactions = transformReactions(reactions as BackendReaction[])

    return NextResponse.json(transformedReactions)

  } catch (error) {
    return handleApiError(error, 'fetching reactions')
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

    // Create auth headers
    const authHeaders = createAuthHeaders(request)
    if (!authHeaders['Authorization']) {
      return createErrorResponse('Authorization header required', 401)
    }

    const body = await request.json()

    // Validate required fields
    if (!body.emoji_code) {
      return createErrorResponse('Emoji code is required', 400)
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/reactions`, {
      method: 'POST',
      authHeaders,
      body: JSON.stringify({
        emoji_code: body.emoji_code
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to add reaction' },
        { status: response.status }
      )
    }

    const reaction = await response.json()

    // Transform the response to match the frontend format
    const transformedReaction = transformReaction(reaction as BackendReaction)

    return NextResponse.json(transformedReaction, { status: 201 })

  } catch (error) {
    return handleApiError(error, 'adding reaction')
  }
}

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

    // Create auth headers
    const authHeaders = createAuthHeaders(request)
    if (!authHeaders['Authorization']) {
      return createErrorResponse('Authorization header required', 401)
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/reactions`, {
      method: 'DELETE',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to remove reaction' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    return handleApiError(error, 'removing reaction')
  }
}