import { NextRequest, NextResponse } from "next/server"
import { 
  handleApiError, 
  makeBackendRequest, 
  createSuccessResponse
} from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (authHeader) {
      // Best effort backend logout, ignore failures (e.g. if token already expired)
      try {
        await makeBackendRequest('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': authHeader
          }
        })
      } catch (e) {
        console.warn('Backend logout failed, continuing with local cleanup', e)
      }
    }

    const nextResponse = createSuccessResponse(null, 'Logged out successfully')
    
    // Clear the refresh_token cookie
    nextResponse.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    })
    
    return nextResponse
  } catch (error) {
    return handleApiError(error, 'logout')
  }
}
