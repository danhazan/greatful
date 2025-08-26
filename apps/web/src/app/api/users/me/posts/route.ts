import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  makeBackendRequest, 
  createErrorResponse 
} from '@/lib/api-utils'
import { transformUserPosts, type BackendUserPost } from '@/lib/transformers'

export async function GET(request: NextRequest) {
  try {
    // Create auth headers
    const authHeaders = createAuthHeaders(request)
    if (!authHeaders['Authorization']) {
      return createErrorResponse('Authorization header required', 401)
    }

    // Forward the request to the FastAPI backend
    const response = await makeBackendRequest('/api/v1/users/me/posts', {
      method: 'GET',
      authHeaders,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch posts' },
        { status: response.status }
      )
    }

    const posts = await response.json()

    // Get user profile to include author information
    const profileResponse = await makeBackendRequest('/api/v1/users/me/profile', {
      method: 'GET',
      authHeaders,
    })

    let userProfile = null
    if (profileResponse.ok) {
      userProfile = await profileResponse.json()
    }

    // Transform the posts to match the frontend format
    const transformedPosts = transformUserPosts(posts as BackendUserPost[], userProfile)

    return NextResponse.json(transformedPosts)

  } catch (error) {
    return handleApiError(error, 'fetching user posts')
  }
}