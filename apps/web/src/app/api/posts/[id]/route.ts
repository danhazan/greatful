import { NextRequest, NextResponse } from 'next/server'
import { fetchNormalizedPost } from '@/lib/post-data'
import { transformApiResponse } from '@/lib/caseTransform'

const API_BASE_URL = process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await fetchNormalizedPost(params.id, {
      authorization: request.headers.get('authorization'),
      cookie: request.headers.get('cookie'),
    })

    if (!result.post) {
      return NextResponse.json(
        { error: result.status === 500 ? 'Internal server error' : 'Failed to fetch post' },
        { status: result.status }
      )
    }

    return NextResponse.json(result.post)

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

    const hasField = (field: string) => Object.prototype.hasOwnProperty.call(body, field)
    const hasAnyField = (...fields: string[]) => fields.some((field) => hasField(field))

    const normalizeLocationData = (value: any) => {
      if (!value || typeof value !== 'object') return value
      if ('display_name' in value) return value

      const address = value.address && typeof value.address === 'object'
        ? {
          ...value.address,
          country_code: value.address.countryCode ?? value.address.country_code,
        }
        : value.address

      return {
        display_name: value.displayName ?? value.display_name,
        lat: value.lat,
        lon: value.lon,
        place_id: value.placeId ?? value.place_id,
        address,
        importance: value.importance,
        type: value.type,
      }
    }

    const backendPayload: Record<string, any> = {}

    if (hasField('content')) {
      backendPayload['content'] = body.content
    }

    if (hasAnyField('richContent', 'rich_content')) {
      backendPayload['rich_content'] = hasField('richContent') ? body.richContent : body.rich_content
    }

    if (hasAnyField('postStyle', 'post_style')) {
      const postStyle = hasField('postStyle') ? body.postStyle : body.post_style
      if (postStyle !== null && postStyle !== undefined) {
        backendPayload['post_style'] = postStyle
      }
    }

    if (hasAnyField('location', 'location_data', 'locationData')) {
      if (hasField('location')) {
        backendPayload['location'] = body.location
      }
      if (hasAnyField('locationData', 'location_data')) {
        const rawLocationData = hasField('locationData') ? body.locationData : body.location_data
        backendPayload['location_data'] = normalizeLocationData(rawLocationData)
      }
    }

    if (hasAnyField('privacyLevel', 'privacy_level')) {
      backendPayload['privacy_level'] = hasField('privacyLevel') ? body.privacyLevel : body.privacy_level
    }

    if (hasAnyField('privacyRules', 'rules')) {
      backendPayload['rules'] = hasField('privacyRules') ? body.privacyRules : body.rules
    }

    if (hasAnyField('specificUsers', 'specific_users')) {
      backendPayload['specific_users'] = hasField('specificUsers') ? body.specificUsers : body.specific_users
    }
    
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
      body: JSON.stringify(backendPayload),
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
