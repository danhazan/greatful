import { NextRequest, NextResponse } from 'next/server'
import { getBackendErrorMessage, proxyBackendJsonResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Forward the request to the backend API
    const backendResponse = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!backendResponse.ok) {
      const data = await backendResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: getBackendErrorMessage(data, 'Forgot password request failed') },
        { status: backendResponse.status }
      )
    }

    return proxyBackendJsonResponse(backendResponse)
  } catch (error) {
    console.error('Forgot password API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
