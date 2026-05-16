import { NextRequest, NextResponse } from "next/server"
import { 
  handleApiError, 
  makeBackendRequest, 
  createErrorResponse,
  proxyBackendJsonResponse
} from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const refreshTokenCookie = request.cookies.get('refresh_token')

    if (!refreshTokenCookie || !refreshTokenCookie.value) {
      console.warn('[Auth-Refresh] Refresh failed: No refresh token cookie provided')
      return createErrorResponse('No refresh token provided', 401)
    }

    const response = await makeBackendRequest('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: refreshTokenCookie.value
      }),
    })

    if (!response.ok) {
      console.warn('[Auth-Refresh] Backend refresh failed with status:', response.status)
      return proxyBackendJsonResponse(response)
    }

    const data = await response.json()
    
    const newRefreshToken = data.refresh_token || data.refreshToken
    
    if (data.refresh_token) delete data.refresh_token
    if (data.refreshToken) delete data.refreshToken

    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedData = transformApiResponse(data)
    const nextResponse = NextResponse.json(transformedData, { status: response.status })
    
    if (newRefreshToken) {
      const maxAgeSeconds = 30 * 24 * 60 * 60; // 30 days
      const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
      const secureFlag = isHttps || process.env.NODE_ENV === 'production'
      
      const cookieOptions = {
        httpOnly: true,
        secure: secureFlag,
        sameSite: 'lax' as const,
        maxAge: maxAgeSeconds,
        expires: new Date(Date.now() + maxAgeSeconds * 1000),
        path: '/'
      };
      
      nextResponse.cookies.set('refresh_token', newRefreshToken, cookieOptions)
    } else {
      console.warn('[Auth-Refresh] Backend returned OK but NO new refresh token was provided for rotation')
    }
    
    return nextResponse
  } catch (error) {
    return handleApiError(error, 'refresh')
  }
}
