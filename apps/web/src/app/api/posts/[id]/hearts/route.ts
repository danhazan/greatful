import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from '@/lib/caseTransform'

const API_BASE_URL = process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${params.id}/hearts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to get hearts info' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const transformedData = transformApiResponse(data)
    return NextResponse.json(transformedData)
  } catch (error) {
    console.error('Error getting hearts info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}