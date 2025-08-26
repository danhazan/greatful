import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const userId = params.userId

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '20'
    const offset = searchParams.get('offset') || '0'

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/posts?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch user posts' },
        { status: response.status }
      )
    }

    const posts = await response.json()

    // Transform the posts to match the frontend format
    const transformedPosts = posts.map((post: any) => ({
      id: post.id,
      content: post.content,
      author: {
        id: post.author?.id?.toString() || userId,
        name: post.author?.username || 'Unknown User',
        image: post.author?.profile_image_url
      },
      createdAt: post.created_at,
      postType: post.post_type,
      imageUrl: post.image_url,
      heartsCount: post.hearts_count || 0,
      isHearted: post.is_hearted || false,
      reactionsCount: post.reactions_count || 0,
      currentUserReaction: post.current_user_reaction
    }))

    return NextResponse.json(transformedPosts)

  } catch (error) {
    console.error('Error fetching user posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}