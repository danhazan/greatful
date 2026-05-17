import { NextRequest, NextResponse } from "next/server"
import { 
  handleApiError, 
  makeBackendRequest, 
  createErrorResponse,
  proxyBackendJsonResponse
} from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.email || !body.password) {
      return createErrorResponse('Email and password are required', 400)
    }

    const response = await makeBackendRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: body.email,
        password: body.password
      }),
    })
    if (!response.ok) {
      return proxyBackendJsonResponse(response)
    }

    const data = await response.json()
    
    // The backend uses success_response() which wraps the payload in a 'data' object
    const payload = data.data || data
    
    // Check for refresh_token either in raw backend format or if already transformed
    const refreshToken = payload.refresh_token || payload.refreshToken
    
    // Remove refresh_token from the payload sent to the client
    if (payload.refresh_token) delete payload.refresh_token
    if (payload.refreshToken) delete payload.refreshToken

    // Create the response from transformed data
    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedData = transformApiResponse(data)
    const nextResponse = NextResponse.json(transformedData, { status: response.status })
    
    if (refreshToken) {
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
      
      nextResponse.cookies.set('refresh_token', refreshToken, cookieOptions)
    } else {
      console.warn('[Auth-Login] No refresh token returned from backend')
    }
    
    return nextResponse
  } catch (error) {
    return handleApiError(error, 'login')
  }
}
