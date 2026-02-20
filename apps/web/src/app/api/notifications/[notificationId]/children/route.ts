import { NextRequest, NextResponse } from 'next/server'
import { mapBackendNotificationToFrontend } from '@/utils/notificationMapping'

const API_BASE_URL = process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const notificationId = params.notificationId

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/${notificationId}/children`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch batch children' },
        { status: response.status }
      )
    }

    const children = await response.json()

    // Transform the children using the same unified mapper as regular notifications
    const transformedChildren = children.map(mapBackendNotificationToFrontend)

    return NextResponse.json(transformedChildren)

  } catch (error) {
    console.error('Error fetching batch children:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}