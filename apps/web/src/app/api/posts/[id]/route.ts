import { NextRequest, NextResponse } from 'next/server'
import { proxyApiRequest } from "@/lib/api-proxy";
import { transformApiResponse } from '@/lib/caseTransform'

const API_BASE_URL = process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id;
    
    // Use the robust proxy for the backend call
    // public endpoint - optional auth
    const response = await proxyApiRequest(request, `/api/v1/posts/${postId}`, { 
      requireAuth: false, 
      forwardCookies: true, 
      passthroughOn401: true 
    });

    // If the proxy returned an error response, return it as-is
    if (!response.ok) {
      return response;
    }

    const responseText = await response.text();
    const post = JSON.parse(responseText);

    // Helper function to transform profile image URL
    const transformProfileImageUrl = (url: string | null): string | null => {
      if (!url) return null
      if (url.startsWith('http')) return url // Already a full URL
      return `${API_BASE_URL}${url}` // Convert relative URL to full URL
    }

    // Automatically transform snake_case to camelCase
    const transformedPost = transformApiResponse(post)

    // Post-process: ensure author.id is string and fix profile image URLs
    if (transformedPost.author) {
      transformedPost.author.id = String(transformedPost.author.id)
      if (transformedPost.author.image || transformedPost.author.profileImageUrl) {
        const imageUrl = transformedPost.author.image || transformedPost.author.profileImageUrl
        transformedPost.author.image = transformProfileImageUrl(imageUrl)
      }
    }

    // Transform legacy single image URL if present
    if (transformedPost.imageUrl && !transformedPost.imageUrl.startsWith('http')) {
      transformedPost.imageUrl = `${API_BASE_URL}${transformedPost.imageUrl}`
    }

    // Transform multi-image URLs if present
    if (Array.isArray(transformedPost.images)) {
      transformedPost.images.forEach((img: any) => {
        if (img.thumbnailUrl && !img.thumbnailUrl.startsWith('http')) {
          img.thumbnailUrl = `${API_BASE_URL}${img.thumbnailUrl}`
        }
        if (img.mediumUrl && !img.mediumUrl.startsWith('http')) {
          img.mediumUrl = `${API_BASE_URL}${img.mediumUrl}`
        }
        if (img.originalUrl && !img.originalUrl.startsWith('http')) {
          img.originalUrl = `${API_BASE_URL}${img.originalUrl}`
        }
      })
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward request to FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    // Helper function to transform profile image URL
    const transformProfileImageUrl = (url: string | null): string | null => {
      if (!url) return null
      if (url.startsWith('http')) return url // Already a full URL
      return `${API_BASE_URL}${url}` // Convert relative URL to full URL
    }

    // Automatically transform snake_case to camelCase
    const transformedPost = transformApiResponse(data)

    // Post-process: ensure author.id is string and fix profile image URLs
    if (transformedPost.author) {
      transformedPost.author.id = String(transformedPost.author.id)
      if (transformedPost.author.image || transformedPost.author.profileImageUrl) {
        const imageUrl = transformedPost.author.image || transformedPost.author.profileImageUrl
        transformedPost.author.image = transformProfileImageUrl(imageUrl)
      }
    }

    // Transform legacy single image URL if present
    if (transformedPost.imageUrl && !transformedPost.imageUrl.startsWith('http')) {
      transformedPost.imageUrl = `${API_BASE_URL}${transformedPost.imageUrl}`
    }

    // Transform multi-image URLs if present
    if (Array.isArray(transformedPost.images)) {
      transformedPost.images.forEach((img: any) => {
        if (img.thumbnailUrl && !img.thumbnailUrl.startsWith('http')) {
          img.thumbnailUrl = `${API_BASE_URL}${img.thumbnailUrl}`
        }
        if (img.mediumUrl && !img.mediumUrl.startsWith('http')) {
          img.mediumUrl = `${API_BASE_URL}${img.mediumUrl}`
        }
        if (img.originalUrl && !img.originalUrl.startsWith('http')) {
          img.originalUrl = `${API_BASE_URL}${img.originalUrl}`
        }
      })
    }

    return NextResponse.json(transformedPost)
  } catch (error) {
    console.error('Error editing post:', error)
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
    const { id } = params
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward request to FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error deleting post:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}