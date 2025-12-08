import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse,
  hasValidAuth
} from '@/lib/api-utils'
import { transformApiResponse } from '@/lib/caseTransform'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)
    const { userId } = params

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest(`/api/v1/follows/${userId}/status`, {
      method: 'GET',
      authHeaders
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to get follow status' },
        { status: response.status }
      )
    }

    const result = await response.json()
    // Transform snake_case to camelCase
    const transformedResult = transformApiResponse(result)
    return NextResponse.json(transformedResult)

  } catch (error) {
    return handleApiError(error, 'getting follow status')
  }
}