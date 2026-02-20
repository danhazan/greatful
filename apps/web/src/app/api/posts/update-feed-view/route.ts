import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from '@/lib/caseTransform'

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    // Forward the request to the FastAPI backend
    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/v1/posts/update-feed-view`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    // Transform snake_case to camelCase
    const transformedData = transformApiResponse(data)
    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error updating feed view:', error)
    return NextResponse.json(
      { error: 'Failed to update feed view' },
      { status: 500 }
    )
  }
}