import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate the analytics event
    if (!body.type || !body.postId || !body.userId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, postId, userId' },
        { status: 400 }
      )
    }

    // Validate event type
    const validTypes = ['reaction_add', 'reaction_remove', 'reaction_change', 'heart', 'share', 'view']
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      )
    }

    // Transform the request to match the backend API format
    const analyticsData = {
      event_type: body.type,
      post_id: body.postId,
      user_id: body.userId,
      metadata: body.metadata || {},
      timestamp: body.timestamp || new Date().toISOString()
    }

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/analytics/events`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analyticsData)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to record analytics event' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error recording analytics event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}