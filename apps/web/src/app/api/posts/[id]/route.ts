import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Get authorization header if present
    const authHeader = request.headers.get('authorization')
    
    // Build headers for backend request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Add authorization header if present (for authenticated users)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${id}`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch post' },
        { status: response.status }
      )
    }

    const post = await response.json()

    // Transform the post to match the frontend format
    const transformedPost = {
      id: post.id,
      content: post.content,
      title: post.title,
      author: {
        id: post.author.id.toString(),
        name: post.author.display_name || post.author.name || post.author.username,
        username: post.author.username,
        display_name: post.author.display_name,
        image: post.author.profile_image_url
      },
      createdAt: post.created_at,
      postType: post.post_type,
      imageUrl: post.image_url,
      location: post.location,
      heartsCount: post.hearts_count || 0,
      isHearted: post.is_hearted || false,
      reactionsCount: post.reactions_count || 0,
      currentUserReaction: post.current_user_reaction
    }

    return NextResponse.json(transformedPost)

  } catch (error) {
    console.error('Error fetching post:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}