import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  createErrorResponse,
  hasValidAuth
} from '@/lib/api-utils'
import { fetchUserPosts } from '@/lib/user-posts-api'

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
    const userId = params.userId

    // Fetch and transform posts using shared utility
    const transformedPosts = await fetchUserPosts({
      userId,
      request,
      authHeaders,
    })

    return NextResponse.json(transformedPosts)

  } catch (error) {
    return handleApiError(error, 'fetching user posts')
  }
}