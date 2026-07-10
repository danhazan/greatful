import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, getAuthToken, createErrorResponse } from '@/lib/api-utils'

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request)
    if (!token) {
      return createErrorResponse('Authorization header required', 401)
    }

    const formData = await request.formData()

    const backendFormData = new FormData()
    for (const [key, value] of formData.entries()) {
      backendFormData.append(key, value)
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/users/me/onboarding`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: backendFormData,
    })

    const data = await response.json()
    const nextResponse = NextResponse.json(data, { status: response.status })

    // Clear signup token on successful completion
    if (response.ok) {
      nextResponse.cookies.set('signup_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
    }

    return nextResponse
  } catch (error) {
    return handleApiError(error, 'onboarding_submit')
  }
}
