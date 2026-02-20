import { NextRequest, NextResponse } from 'next/server'
import { normalizeUserDataArray } from '@/utils/userDataMapping'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the FastAPI backend
    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/v1/users/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    // Normalize user data in search results
    const normalizedData = Array.isArray(data) ? normalizeUserDataArray(data) : data

    return NextResponse.json(normalizedData)
  } catch (error) {
    console.error('User search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}