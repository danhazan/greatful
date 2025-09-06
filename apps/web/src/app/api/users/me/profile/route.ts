import { NextRequest } from "next/server"
import { handleUserProfileGetRequest, handleUserProfilePutRequest } from '@/lib/user-profile-api'

export async function GET(request: NextRequest) {
  // Use shared handler with no userId (defaults to 'me' endpoint)
  return handleUserProfileGetRequest(request)
}

export async function PUT(request: NextRequest) {
  // Use shared handler for profile updates
  return handleUserProfilePutRequest(request)
}