import { NextRequest, NextResponse } from "next/server"
import { transformApiResponse } from '@/lib/caseTransform'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the backend API
    const backendResponse = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/users/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    })

    const responseData = transformApiResponse(await backendResponse.json())

    if (!backendResponse.ok) {
      return NextResponse.json(responseData, { status: backendResponse.status })
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Password update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
