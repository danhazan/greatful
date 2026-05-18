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
    const { provider, code, state } = body
    
    if (!provider || !code) {
      return createErrorResponse('Provider and code are required', 400)
    }

    const response = await makeBackendRequest(`/api/v1/oauth/callback/${provider}`, {
      method: 'POST',
      body: JSON.stringify({
        code,
        state
      }),
    })

    if (!response.ok) {
      return proxyBackendJsonResponse(response)
    }

    const data = await response.json()
    
    // OAuth callback returns { user, tokens: { access_token, refresh_token }, is_new_user }
    const payload = data.data || data
    const tokens = payload.tokens || payload
    
    const refreshToken = tokens.refresh_token || tokens.refreshToken
    
    // Remove refresh_token from the payload sent to the client
    if (tokens.refresh_token) delete tokens.refresh_token
    if (tokens.refreshToken) delete tokens.refreshToken

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
      console.warn(`[OAuth-Callback] No refresh token returned from backend for provider: ${provider}`)
    }
    
    return nextResponse
  } catch (error) {
    return handleApiError(error, 'oauth_callback')
  }
}
