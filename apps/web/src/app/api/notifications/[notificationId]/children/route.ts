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

    // Transform the children to match the frontend format
    const transformedChildren = children.map((child: any) => ({
      id: child.id,
      type: child.type === 'emoji_reaction' ? 'reaction' : child.type,
      message: child.message,
      post_id: child.post_id || child.data?.post_id || '',
      from_user: {
        id: child.from_user?.id || child.data?.reactor_username || 'unknown',
        username: child.from_user?.username || child.data?.reactor_username || 'Unknown User',
        profile_image_url: child.from_user?.profile_image_url || undefined
      },
      created_at: child.created_at,
      last_updated_at: child.last_updated_at,
      read: child.read,
      // Batching fields
      is_batch: child.is_batch || false,
      batch_count: child.batch_count || 1,
      parent_id: child.parent_id || null
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