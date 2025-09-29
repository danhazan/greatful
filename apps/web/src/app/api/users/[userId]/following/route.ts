import { NextRequest } from 'next/server'
import { handleApiProxy } from '@/lib/api-proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Following list requires authentication
  return handleApiProxy(request, `/api/v1/users/${params.userId}/following`, { requireAuth: true })
}