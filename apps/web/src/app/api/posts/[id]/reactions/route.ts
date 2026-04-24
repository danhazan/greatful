import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  validateRequiredParams,
  hasValidAuth
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

    // Get query parameters for polymorphic support
    const searchParams = request.nextUrl.searchParams
    const objectType = searchParams.get('object_type') || 'post'
    const objectId = searchParams.get('object_id')
    
    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)

    // Build backend URL with query params
    let backendUrl = `/api/v1/posts/${id}/reactions?object_type=${objectType}`
    if (objectId) {
      backendUrl += `&object_id=${objectId}`
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(backendUrl, {
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

    const reactionsResponse = await response.json()
    const reactions = reactionsResponse.data || reactionsResponse

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

    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)

    const body = await request.json()

    const emojiCode = body.emojiCode ?? body.emoji_code
    const objectType = body.objectType ?? body.object_type ?? 'post'
    const objectId = body.objectId ?? body.object_id ?? null

    // Validate required fields
    if (!emojiCode) {
      return createErrorResponse('Emoji code is required', 400)
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/reactions`, {
      method: 'POST',
      authHeaders,
      body: JSON.stringify({
        emoji_code: emojiCode,
        object_type: objectType,
        object_id: objectId
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to add reaction' },
        { status: response.status }
      )
    }

    const reactionResponse = await response.json()
    const reaction = reactionResponse.data || reactionResponse

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

    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)

    const searchParams = new URL(request.url).searchParams
    const objectType = searchParams.get('objectType') || searchParams.get('object_type') || 'post'
    const objectId = searchParams.get('objectId') || searchParams.get('object_id') || ''

    let queryParams = ''
    if (objectType !== 'post' || objectId) {
      const params = new URLSearchParams()
      params.append('object_type', objectType)
      if (objectId) params.append('object_id', objectId)
      queryParams = `?${params.toString()}`
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/posts/${id}/reactions${queryParams}`, {
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
