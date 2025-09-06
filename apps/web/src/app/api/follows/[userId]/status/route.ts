import { NextRequest } from 'next/server'
import { handleApiProxy } from '@/lib/api-proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Follow status requires authentication
  return handleApiProxy(request, `/api/v1/follows/${params.userId}/status`, { requireAuth: true })
}