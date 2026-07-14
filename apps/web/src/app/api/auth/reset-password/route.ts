import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJsonResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const backendResponse = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!backendResponse.ok) {
      return proxyBackendJsonResponse(backendResponse)
    }

    return proxyBackendJsonResponse(backendResponse)
  } catch (error) {
    console.error('Reset password API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
