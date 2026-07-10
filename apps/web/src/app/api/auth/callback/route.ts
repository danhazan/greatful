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
    
    const payload = data.data
    const refreshToken = payload.refresh_token
    const signupToken = payload.signup_token
    
    if (payload.refresh_token) delete payload.refresh_token
    if (payload.signup_token) delete payload.signup_token

    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedData = transformApiResponse(data)
    const nextResponse = NextResponse.json(transformedData, { status: response.status })

    const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
    const secureFlag = isHttps || process.env.NODE_ENV === 'production'
    
    if (refreshToken) {
      nextResponse.cookies.set('refresh_token', refreshToken, {
        httpOnly: true,
        secure: secureFlag,
        sameSite: 'lax' as const,
        maxAge: 30 * 24 * 60 * 60,
        path: '/'
      })
    } else {
      console.warn(`[OAuth-Callback] No refresh token returned from backend for provider: ${provider}`)
    }

    if (signupToken) {
      nextResponse.cookies.set('signup_token', signupToken, {
        httpOnly: true,
        secure: secureFlag,
        sameSite: 'lax' as const,
        maxAge: 15 * 60,
        path: '/'
      })
    }
    
    return nextResponse
  } catch (error) {
    return handleApiError(error, 'oauth_callback')
  }
}
