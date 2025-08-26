import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

    // Validate required fields
    if (!body.content || !body.postType) {
      return NextResponse.json(
        { error: 'Content and post type are required' },
        { status: 400 }
      )
    }

    // Validate post type
    const validPostTypes = ['daily', 'photo', 'spontaneous']
    if (!validPostTypes.includes(body.postType)) {
      return NextResponse.json(
        { error: 'Invalid post type. Must be daily, photo, or spontaneous' },
        { status: 400 }
      )
    }

    // Validate character limits based on post type
    const maxLengths = {
      daily: 500,
      photo: 300,
      spontaneous: 200
    }
    
    const maxLength = maxLengths[body.postType as keyof typeof maxLengths]
    if (body.content.length > maxLength) {
      return NextResponse.json(
        { error: `Content too long. Maximum ${maxLength} characters for ${body.postType} posts` },
        { status: 400 }
      )
    }

    // Transform the request to match the backend API format
    const postData = {
      content: body.content.trim(),
      post_type: body.postType,
      title: body.title || null,
      image_url: body.imageUrl || null,
      location: body.location || null,
      is_public: body.isPublic !== false // Default to true
    }

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to create post' },
        { status: response.status }
      )
    }

    const createdPost = await response.json()

    // Transform the response to match the frontend format
    const transformedPost = {
      id: createdPost.id,
      content: createdPost.content,
      author: {
        id: createdPost.author.id.toString(),
        name: createdPost.author.username,
        image: createdPost.author.profile_image_url
      },
      createdAt: createdPost.created_at,
      postType: createdPost.post_type,
      imageUrl: createdPost.image_url,
      heartsCount: createdPost.hearts_count || 0,
      isHearted: false,
      reactionsCount: createdPost.reactions_count || 0,
      currentUserReaction: createdPost.current_user_reaction
    }

    return NextResponse.json(transformedPost, { status: 201 })

  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/feed?limit=${limit}&offset=${offset}`, {
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

    // Transform the posts to match the frontend format
    const transformedPosts = posts.map((post: any) => ({
      id: post.id,
      content: post.content,
      author: {
        id: post.author.id.toString(),
        name: post.author.name || post.author.username,
        image: post.author.profile_image_url
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
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}