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

    // Check if this is FormData (file upload) or JSON
    const contentType = request.headers.get('content-type') || ''
    let body: any
    let isFormData = false

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData for file uploads
      const formData = await request.formData()
      body = {
        content: formData.get('content') as string,
        richContent: formData.get('richContent') as string,
        postStyle: formData.get('postStyle') as string,
        title: formData.get('title') as string,
        location: formData.get('location') as string,
        location_data: formData.get('location_data') as string,
        post_type_override: formData.get('post_type_override') as string,
        image: formData.get('image') as File
      }
      isFormData = true
    } else {
      // Handle JSON
      body = await request.json()
    }

    // Validate that either content or image is provided
    if (!body.content && !body.image_url && !body.image) {
      return NextResponse.json(
        { error: 'Either content or image must be provided' },
        { status: 400 }
      )
    }

    // Note: Character limit validation is now handled by the backend
    // based on automatically detected post type

    let response: Response

    if (isFormData) {
      // Forward FormData to backend for file upload
      const backendFormData = new FormData()
      backendFormData.append('content', body.content.trim())
      if (body.richContent) backendFormData.append('rich_content', body.richContent)
      if (body.postStyle) backendFormData.append('post_style', body.postStyle)
      if (body.title) backendFormData.append('title', body.title)
      if (body.location) backendFormData.append('location', body.location)
      if (body.location_data) backendFormData.append('location_data', body.location_data)
      if (body.post_type_override) backendFormData.append('post_type_override', body.post_type_override)
      if (body.image) backendFormData.append('image', body.image)

      response = await fetch(`${API_BASE_URL}/api/v1/posts/upload`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          // Don't set Content-Type for FormData, let fetch set it with boundary
        },
        body: backendFormData
      })
    } else {
      // Transform the request to match the backend API format for JSON
      const postData = {
        content: body.content.trim(),
        rich_content: body.rich_content || null,
        post_style: body.post_style || null,
        title: body.title || null,
        image_url: body.image_url || null,
        location: body.location || null,
        location_data: body.location_data || null,
        post_type_override: body.postTypeOverride || null,
        is_public: body.isPublic !== false // Default to true
      }



      response = await fetch(`${API_BASE_URL}/api/v1/posts`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData)
      })
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to create post' },
        { status: response.status }
      )
    }

    const createdPost = await response.json()

    // Helper function to get profile image URL from author object (handles both field names)
    const getAuthorImageUrl = (author: any): string | null => {
      return author.image || author.profile_image_url || null
    }

    // Helper function to transform profile image URL
    const transformProfileImageUrl = (url: string | null): string | null => {
      if (!url) return null
      if (url.startsWith('http')) return url // Already a full URL
      return `${API_BASE_URL}${url}` // Convert relative URL to full URL
    }

    // Transform the response to match the frontend format
    const transformedPost = {
      id: createdPost.id,
      content: createdPost.content,
      postStyle: createdPost.post_style,
      author: {
        id: createdPost.author.id.toString(),
        name: createdPost.author.username,
        image: transformProfileImageUrl(getAuthorImageUrl(createdPost.author))
      },
      createdAt: createdPost.created_at,
      updatedAt: createdPost.updated_at, // Add missing updatedAt field mapping
      postType: createdPost.post_type,
      imageUrl: createdPost.image_url,
      location: createdPost.location,
      location_data: createdPost.location_data,
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
    const refresh = searchParams.get('refresh') || 'false'
    const algorithm = searchParams.get('algorithm') || 'true'
    const considerReadStatus = searchParams.get('consider_read_status') || 'true'

    // Build query string
    const queryParams = new URLSearchParams({
      limit,
      offset,
      refresh,
      algorithm,
      consider_read_status: considerReadStatus
    })

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/feed?${queryParams}`, {
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

    // Helper function to transform profile image URL
    const transformProfileImageUrl = (url: string | null): string | null => {
      if (!url) return null
      if (url.startsWith('http')) return url // Already a full URL
      return `${API_BASE_URL}${url}` // Convert relative URL to full URL
    }

    // Helper function to get profile image URL from author object (handles both field names)
    const getAuthorImageUrl = (author: any): string | null => {
      return author.image || author.profile_image_url || null
    }

    // Transform the posts to match the frontend format
    const transformedPosts = posts.map((post: any) => ({
      id: post.id,
      content: post.content,
      postStyle: post.post_style,
      author: {
        id: post.author.id.toString(),
        name: post.author.name || post.author.username,
        username: post.author.username,
        display_name: post.author.display_name,
        image: transformProfileImageUrl(getAuthorImageUrl(post.author))
      },
      createdAt: post.created_at,
      updatedAt: post.updated_at, // Add missing updatedAt field mapping
      postType: post.post_type,
      imageUrl: post.image_url,
      location: post.location,
      location_data: post.location_data,
      heartsCount: post.hearts_count || 0,
      isHearted: post.is_hearted || false,
      reactionsCount: post.reactions_count || 0,
      currentUserReaction: post.current_user_reaction,
      isRead: post.is_read || false,
      isUnread: post.is_unread || false
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