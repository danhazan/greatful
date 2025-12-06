import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Helper function to read headers from different request types
function readHeader(request: any, key: string): string | undefined {
  try {
    if (request?.headers?.get) {
      return request.headers.get(key) ?? request.headers.get(key.toLowerCase()) ?? undefined;
    }
    if (request?.headers && typeof request.headers === "object") {
      return request.headers[key] ?? request.headers[key.toLowerCase()];
    }
  } catch (e) {
    // ignore
  }
  return undefined;
}

// Helper function to transform profile image URL
const transformProfileImageUrl = (url: string | null): string | null => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url}`
}

// Helper function to get profile image URL from author object
const getAuthorImageUrl = (author: any): string | null => {
  return author.image || author.profile_image_url || null
}

export async function handleUserPostsRequest(request: any, userId?: string) {
  try {
    const authHeader = readHeader(request, 'authorization')
    const requireAuth = typeof userId === "undefined" || userId === null
    
    if (requireAuth && !authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const path = userId ? `/api/v1/users/${userId}/posts` : `/api/v1/users/me/posts`;
    
    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        ...(authHeader ? { 'Authorization': authHeader } : {}),
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

    const responseData = await response.json()
    
    // Handle wrapped response format
    const posts = responseData.data || responseData
    
    // Check if posts is an array
    if (!Array.isArray(posts)) {
      console.error('Expected posts to be an array, got:', typeof posts, posts)
      return NextResponse.json(
        { error: 'Invalid response format from backend' },
        { status: 500 }
      )
    }

    // Helper function to transform post image URL (same as profile images)
    const transformPostImageUrl = (url: string | null): string | null => {
      if (!url) return null
      if (url.startsWith('http')) return url // Already a full URL
      return `${API_BASE_URL}${url}` // Convert relative URL to full URL
    }

    // Transform the posts to match the frontend format (snake_case to camelCase)
    const transformedPosts = posts.map((post: any) => {
      // Debug logging to see what we're getting from backend
      console.log('Transforming post:', {
        id: post.id,
        image_url: post.image_url,
        comments_count: post.comments_count,
        hearts_count: post.hearts_count,
        reactions_count: post.reactions_count
      })
      
      return {
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
        updatedAt: post.updated_at,
        postType: post.post_type,
        imageUrl: transformPostImageUrl(post.image_url),
        location: post.location,
        location_data: post.location_data,
        heartsCount: post.hearts_count || 0,
        isHearted: post.is_hearted || false,
        reactionsCount: post.reactions_count || 0,
        commentsCount: post.comments_count || 0,
        currentUserReaction: post.current_user_reaction,
        isRead: post.is_read || false,
        isUnread: post.is_unread || false
      }
    })

    return NextResponse.json(transformedPosts)

  } catch (error) {
    console.error('Error fetching user posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}