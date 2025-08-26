import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const postId = params.id

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/reactions`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch reactions' },
        { status: response.status }
      )
    }

    const reactions = await response.json()

    // Transform the reactions to match the frontend format
    const transformedReactions = reactions.map((reaction: any) => ({
      id: reaction.id,
      userId: reaction.user_id.toString(),
      userName: reaction.user?.username || 'Unknown User',
      userImage: reaction.user?.profile_image_url,
      emojiCode: reaction.emoji_code,
      createdAt: reaction.created_at
    }))

    return NextResponse.json(transformedReactions)

  } catch (error) {
    console.error('Error fetching reactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const postId = params.id
    const body = await request.json()

    // Validate required fields
    if (!body.emoji_code) {
      return NextResponse.json(
        { error: 'Emoji code is required' },
        { status: 400 }
      )
    }

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emoji_code: body.emoji_code
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to add reaction' },
        { status: response.status }
      )
    }

    const reaction = await response.json()

    // Transform the response to match the frontend format
    const transformedReaction = {
      id: reaction.id,
      userId: reaction.user_id.toString(),
      userName: reaction.user?.username || 'Unknown User',
      userImage: reaction.user?.profile_image_url,
      emojiCode: reaction.emoji_code,
      createdAt: reaction.created_at
    }

    return NextResponse.json(transformedReaction, { status: 201 })

  } catch (error) {
    console.error('Error adding reaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const postId = params.id

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/reactions`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to remove reaction' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error removing reaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}