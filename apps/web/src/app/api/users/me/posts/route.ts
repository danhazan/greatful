import { NextRequest } from 'next/server'
import { handleUserPostsRequest } from '@/lib/user-posts-api'

export async function GET(request: NextRequest) {
  // Use shared handler with no userId (defaults to 'me' endpoint)
  return handleUserPostsRequest(request)
}