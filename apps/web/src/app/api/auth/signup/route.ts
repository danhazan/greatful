import { NextRequest, NextResponse } from "next/server"
import { 
  handleApiError, 
  makeBackendRequest, 
  createErrorResponse,
  proxyBackendResponse 
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
        password: body.password
      }),
    })

    return proxyBackendResponse(response)
  } catch (error) {
    return handleApiError(error, 'signup')
  }
}