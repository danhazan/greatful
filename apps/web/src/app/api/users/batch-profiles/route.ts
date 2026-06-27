import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from '@/lib/caseTransform'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_ids } = body

    if (!user_ids || !Array.isArray(user_ids)) {
      return NextResponse.json(
        { error: 'Invalid request: user_ids array required' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/v1/users/batch-profiles`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_ids })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Backend batch-profiles error:', response.status, errorData)
      return NextResponse.json({ data: [] })
    }

    const data = await response.json()
    const transformedData = transformApiResponse(data)
    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in batch-profiles:', error)
    return NextResponse.json({ data: [] })
  }
}
