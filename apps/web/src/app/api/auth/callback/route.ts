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

    const { transformApiResponse } = await import('@/lib/caseTransform')
    const transformedData = transformApiResponse(data)
    const nextResponse = NextResponse.json(transformedData, { status: response.status })

    const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
    const secureFlag = isHttps || process.env.NODE_ENV === 'production'

    setAuthCookies(nextResponse, payload, secureFlag)
    
    return nextResponse
  } catch (error) {
    return handleApiError(error, 'oauth_callback')
  }
}
