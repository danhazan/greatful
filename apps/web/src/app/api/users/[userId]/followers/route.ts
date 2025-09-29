import { NextRequest } from 'next/server'
import { handleApiProxy } from '@/lib/api-proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Followers list requires authentication
  return handleApiProxy(request, `/api/v1/users/${params.userId}/followers`, { requireAuth: true })
}