import { NextRequest, NextResponse } from 'next/server'
import { proxyApiRequest } from "@/lib/api-proxy";

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

    // Helper function to get profile image URL from author object (handles both field names)
    const getAuthorImageUrl = (author: any): string | null => {
      return author.image || author.profile_image_url || null
    }

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
        image: transformProfileImageUrl(getAuthorImageUrl(post.author))
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