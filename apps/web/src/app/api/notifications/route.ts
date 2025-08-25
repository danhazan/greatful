import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch notifications' },
        { status: response.status }
      )
    }

    const notifications = await response.json()

    // Transform the notifications to match the frontend format
    const transformedNotifications = notifications.map((notification: any) => ({
      id: notification.id,
      type: notification.type === 'emoji_reaction' ? 'reaction' : notification.type,
      message: notification.message,
      postId: notification.post_id || notification.data?.post_id || '',
      fromUser: {
        id: notification.from_user?.id || notification.data?.reactor_username || 'unknown',
        name: notification.from_user?.username || notification.data?.reactor_username || 'Unknown User',
        image: notification.from_user?.profile_image_url || undefined
      },
      createdAt: notification.created_at,
      read: notification.read
    }))

    return NextResponse.json(transformedNotifications)

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