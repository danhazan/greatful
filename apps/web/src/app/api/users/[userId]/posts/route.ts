import { NextRequest } from 'next/server'
import { handleUserPostsRequest } from '@/lib/user-posts-api'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Use shared handler with specific userId (supports optional auth for public posts)
  return handleUserPostsRequest(request, params.userId)
}