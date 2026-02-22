import { NextResponse } from "next/server";
import { proxyApiRequest } from './api-proxy';

const API_BASE_URL = process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

// Helper function to transform profile image URL
const transformProfileImageUrl = (url: string | null): string | null => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url}`
}


export async function handleUserPostsRequest(request: any, userId?: string) {
  try {
    const requireAuth = typeof userId === "undefined" || userId === null

    const path = userId ? `/api/v1/users/${userId}/posts` : `/api/v1/users/me/posts`;

    const response = await proxyApiRequest(request, path, {
      requireAuth,
      forwardCookies: true,
      passthroughOn401: true
    })

    if (!response.ok) {
      return response
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

    const transformedPosts = posts

    // Post-process: ensure author.id is string and fix profile image URLs
    if (Array.isArray(transformedPosts)) {
      transformedPosts.forEach((post: any) => {
        if (post.author) {
          post.author.id = String(post.author.id)
          if (post.author.profileImageUrl || post.author.image) {
            const imageUrl = post.author.profileImageUrl || post.author.image
            post.author.profileImageUrl = transformProfileImageUrl(imageUrl)
            post.author.image = post.author.profileImageUrl
          }
        }
        // Transform legacy single image URL if present
        if (post.imageUrl && !post.imageUrl.startsWith('http')) {
          post.imageUrl = `${API_BASE_URL}${post.imageUrl}`
        }
        // Transform multi-image URLs if present
        if (Array.isArray(post.images)) {
          post.images.forEach((img: any) => {
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
