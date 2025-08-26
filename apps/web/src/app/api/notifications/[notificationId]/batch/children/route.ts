import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

    const { notificationId } = params

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

    // Transform the children to match the frontend format
    const transformedChildren = children.map((notification: any) => ({
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
      read: notification.read,
      // Batching fields
      isBatch: notification.is_batch || false,
      batchCount: notification.batch_count || 1,
      parentId: notification.parent_id || null
    }))

    return NextResponse.json(transformedChildren)

  } catch (error) {
    console.error('Error fetching batch children:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}