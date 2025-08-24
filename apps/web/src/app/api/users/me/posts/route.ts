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

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/users/me/posts`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch posts' },
        { status: response.status }
      )
    }

    const posts = await response.json()

    // Get user profile to include author information
    const profileResponse = await fetch(`${API_BASE_URL}/api/v1/users/me/profile`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    let userProfile = null
    if (profileResponse.ok) {
      userProfile = await profileResponse.json()
    }

    // Transform the posts to match the frontend format
    const transformedPosts = posts.map((post: any) => ({
      id: post.id,
      content: post.content,
      author: {
        id: userProfile?.id?.toString() || '1',
        name: userProfile?.username || 'Unknown User',
        image: userProfile?.profile_image_url
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