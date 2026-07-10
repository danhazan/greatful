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
    
    if (!body.email || !body.password || !body.username) {
      return createErrorResponse('Email, username, and password are required', 400)
    }

    const response = await makeBackendRequest('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: body.email,
        username: body.username,
        password: body.password,
        ...(body.resurrect_action ? { resurrect_action: body.resurrect_action } : {}),
      }),
    })

    // Non-ok responses (409 resurrection, 422 validation, etc.) — pass through as-is
    if (!response.ok) {
      return proxyBackendJsonResponse(response)
    }

    // Success path: extract tokens, set HttpOnly cookies
    const data = await response.json()
    const payload = data.data
    const refreshToken = payload?.refresh_token
    const signupToken = payload?.signup_token

    if (payload?.refresh_token) delete payload.refresh_token
    if (payload?.signup_token) delete payload.signup_token

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
        path: '/',
      })
    }

    if (signupToken) {
      nextResponse.cookies.set('signup_token', signupToken, {
        httpOnly: true,
        secure: secureFlag,
        sameSite: 'lax' as const,
        maxAge: 15 * 60,
        path: '/',
      })
    }

    return nextResponse
  } catch (error) {
    return handleApiError(error, 'signup')
  }
}
