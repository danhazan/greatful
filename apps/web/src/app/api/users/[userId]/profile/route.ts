import { NextRequest } from 'next/server'
import { handleUserProfileGetRequest } from '@/lib/user-profile-api'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Use shared handler with specific userId
  return handleUserProfileGetRequest(request, params.userId)
}