import { NextRequest, NextResponse } from "next/server"
import {
  handleApiError,
  makeBackendRequest,
  createErrorResponse,
  proxyBackendJsonResponse
} from '@/lib/api-utils'
import { setAuthCookies } from '@/lib/auth-cookies'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bootstrap_token } = body

    if (!bootstrap_token || typeof bootstrap_token !== 'string') {
      return createErrorResponse('bootstrap_token is required', 400)
    }

    const response = await makeBackendRequest('/api/v1/oauth/web-session/bootstrap/consume', {
      method: 'POST',
      body: JSON.stringify({ bootstrap_token }),
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
    return handleApiError(error, 'social_session')
  }
}