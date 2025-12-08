import { NextResponse } from "next/server";
import { transformApiResponse } from './caseTransform';

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

    // Automatically transform snake_case to camelCase
    const transformedPosts = transformApiResponse(posts)
    
    // Post-process: ensure author.id is string and fix profile image URLs
    if (Array.isArray(transformedPosts)) {
      transformedPosts.forEach((post: any) => {
        if (post.author) {
          post.author.id = String(post.author.id)
          if (post.author.image || post.author.profileImageUrl) {
            const imageUrl = post.author.image || post.author.profileImageUrl
            post.author.image = transformProfileImageUrl(imageUrl)
          }
        }
        // Transform post image URL if present
        if (post.imageUrl && !post.imageUrl.startsWith('http')) {
          post.imageUrl = `${API_BASE_URL}${post.imageUrl}`
        }
      })
    }

    return NextResponse.json(transformedPosts)

  } catch (error) {
    console.error('Error fetching user posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}