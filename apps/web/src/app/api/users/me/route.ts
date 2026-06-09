import { NextRequest, NextResponse } from 'next/server'
import {
  handleApiError,
  makeBackendRequest,
  createErrorResponse,
  proxyBackendJsonResponse
} from '@/lib/api-utils'

export async function PATCH(_request: NextRequest) {
  if (process.env['NODE_ENV'] === 'development') {
    console.warn('[api/users/me] Deprecated profile update route hit. Use /api/users/me/profile with PUT instead.')
  }

  return NextResponse.json(
    {
      error: 'Invalid route for profile updates. Use /api/users/me/profile with PUT.'
    },
    { status: 400 }
  )
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Authorization header required', 401)
    }

    const body = await request.json()

    const response = await makeBackendRequest('/api/v1/users/me', {
      method: 'DELETE',
      body: JSON.stringify(body),
      headers: {
        'Authorization': authHeader,
      },
    })

    return proxyBackendJsonResponse(response)
  } catch (error) {
    return handleApiError(error, 'delete_account')
  }
}
