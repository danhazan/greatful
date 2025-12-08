import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from '@/lib/caseTransform'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { usernames } = body

    if (!usernames || !Array.isArray(usernames)) {
      return NextResponse.json(
        { error: 'Invalid request: usernames array required' },
        { status: 400 }
      )
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/v1/users/validate-batch`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usernames })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Backend validation error:', response.status, errorData)
      
      // Return empty valid usernames array on error to prevent UI issues
      return NextResponse.json({
        data: {
          validUsernames: []
        }
      })
    }

    const data = await response.json()
    // Transform snake_case to camelCase
    const transformedData = transformApiResponse(data)
    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in batch validation:', error)
    
    // Return empty valid usernames array on error to prevent UI issues
    return NextResponse.json({
      data: {
        validUsernames: []
      }
    })
  }
}