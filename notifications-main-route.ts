import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '20'
    const offset = searchParams.get('offset') || '0'
    const unreadOnly = searchParams.get('unread_only') || 'false'

    // Forward the request to the FastAPI backend
    const response = await fetch(
      `${API_BASE_URL}/api/v1/notifications?limit=${limit}&offset=${offset}&unread_only=${unreadOnly}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch notifications' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Transform snake_case to camelCase for frontend
    const transformedData = data.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      message: notification.message,
      postId: notification.data?.post_id || '',
      fromUser: {
        id: notification.data?.reactor_username || notification.data?.follower_username || 'unknown',
        name: notification.data?.reactor_username || notification.data?.follower_username || 'Unknown User',
        image: undefined // Backend doesn't provide image in notification data
      },
      createdAt: notification.created_at,
      read: notification.read
    }))

    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to mark all notifications as read' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}