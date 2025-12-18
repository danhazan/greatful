import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from '@/lib/caseTransform'

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
      // Get all images (multi-image support)
      const imageFiles = formData.getAll('images') as File[]
      body = {
        content: formData.get('content') as string,
        richContent: formData.get('richContent') as string,
        postStyle: formData.get('postStyle') as string,
        title: formData.get('title') as string,
        location: formData.get('location') as string,
        location_data: formData.get('location_data') as string,
        post_type_override: formData.get('post_type_override') as string,
        image: formData.get('image') as File,  // Legacy single image
        images: imageFiles.length > 0 ? imageFiles : undefined  // Multi-image
      }
      isFormData = true
    } else {
      // Handle JSON
      body = await request.json()
    }

    // Validate that either content or image is provided
    const hasImages = body.images && body.images.length > 0
    if (!body.content && !body.image_url && !body.image && !hasImages) {
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
      // Multi-image support: forward all images to backend
      if (body.images && body.images.length > 0) {
        body.images.forEach((file: File) => {
          backendFormData.append('images', file)
        })
      } else if (body.image) {
        // Legacy single image support (deprecated)
        backendFormData.append('image', body.image)
      }

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

    // Helper function to transform relative image URLs to full URLs
    const transformImageUrl = (url: string | null): string | null => {
      if (!url) return null
      if (url.startsWith('http')) return url // Already a full URL
      if (url.startsWith('blob:')) return url // Blob URL, keep as-is
      return `${API_BASE_URL}${url}` // Convert relative URL to full URL
    }

    // Automatically transform snake_case to camelCase
    const transformedPost = transformApiResponse(createdPost)

    // Post-process: ensure author.id is string and fix profile image URLs
    if (transformedPost.author) {
      transformedPost.author.id = String(transformedPost.author.id)
      if (transformedPost.author.image || transformedPost.author.profileImageUrl) {
        const imageUrl = transformedPost.author.image || transformedPost.author.profileImageUrl
        transformedPost.author.image = transformImageUrl(imageUrl)
      }
    }

    // Transform post images URLs (multi-image support)
    if (transformedPost.images && Array.isArray(transformedPost.images)) {
      transformedPost.images = transformedPost.images.map((img: any) => ({
        ...img,
        thumbnailUrl: transformImageUrl(img.thumbnailUrl),
        mediumUrl: transformImageUrl(img.mediumUrl),
        originalUrl: transformImageUrl(img.originalUrl)
      }))
    }

    // Transform legacy single image URL
    if (transformedPost.imageUrl) {
      transformedPost.imageUrl = transformImageUrl(transformedPost.imageUrl)
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

    // Helper function to transform relative image URLs to full URLs
    const transformImageUrl = (url: string | null): string | null => {
      if (!url) return null
      if (url.startsWith('http')) return url // Already a full URL
      if (url.startsWith('blob:')) return url // Blob URL, keep as-is
      return `${API_BASE_URL}${url}` // Convert relative URL to full URL
    }

    // Automatically transform snake_case to camelCase
    const transformedPosts = transformApiResponse(posts)

    // Post-process: ensure author.id is string and fix image URLs
    if (Array.isArray(transformedPosts)) {
      transformedPosts.forEach((post: any) => {
        if (post.author) {
          post.author.id = String(post.author.id)
          if (post.author.image || post.author.profileImageUrl) {
            const imageUrl = post.author.image || post.author.profileImageUrl
            post.author.image = transformImageUrl(imageUrl)
          }
        }

        // Transform post images URLs (multi-image support)
        if (post.images && Array.isArray(post.images)) {
          post.images = post.images.map((img: any) => ({
            ...img,
            thumbnailUrl: transformImageUrl(img.thumbnailUrl),
            mediumUrl: transformImageUrl(img.mediumUrl),
            originalUrl: transformImageUrl(img.originalUrl)
          }))
        }

        // Transform legacy single image URL
        if (post.imageUrl) {
          post.imageUrl = transformImageUrl(post.imageUrl)
        }
      })
    }

    return NextResponse.json(transformedPosts)

  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}