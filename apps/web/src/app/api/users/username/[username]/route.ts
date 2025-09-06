import { NextRequest } from 'next/server'
import { handleApiProxy } from '@/lib/api-proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  // URL encode the username to handle special characters
  const encodedUsername = encodeURIComponent(params.username)
  
  // Use generic proxy handler
  return handleApiProxy(request, `/api/v1/users/username/${encodedUsername}`)
}