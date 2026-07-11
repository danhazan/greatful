import { NextRequest, NextResponse } from "next/server"
import {
  handleApiError,
  makeBackendRequest,
  createErrorResponse,
  proxyBackendJsonResponse,
} from '@/lib/api-utils'
import { setAuthCookies } from '@/lib/auth-cookies'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.resurrection_token || !body.resurrect_action) {
      return createErrorResponse('resurrection_token and resurrect_action are required', 400)
    }

    const response = await makeBackendRequest('/api/v1/auth/oauth/resurrect', {
      method: 'POST',
      body: JSON.stringify({
        resurrection_token: body.resurrection_token,
        username: body.username,
        resurrect_action: body.resurrect_action,
        email: body.email,
        oauth_user_info: body.oauth_user_info,
      }),
    })

    if (!response.ok) {
      return proxyBackendJsonResponse(response)
    }

    const data = await response.json()
    const payload = data.data

    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedData = transformApiResponse(data)
    const nextResponse = NextResponse.json(transformedData, { status: response.status })

    const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
    const secureFlag = isHttps || process.env.NODE_ENV === 'production'

    setAuthCookies(nextResponse, payload, secureFlag)

    return nextResponse
  } catch (error) {
    return handleApiError(error, 'oauth_resurrect')
  }
}
