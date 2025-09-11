import { NextRequest, NextResponse } from 'next/server'
import { handleApiProxy } from '@/lib/api-proxy'
import { normalizeUserData } from '@/utils/userDataMapping'

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  // URL encode the username to handle special characters
  const encodedUsername = encodeURIComponent(params.username)
  
  // Username lookup requires authentication
  const response = await handleApiProxy(request, `/api/v1/users/by-username/${encodedUsername}`, { requireAuth: true })
  
  // If the response is successful, normalize the user data
  if (response.ok) {
    try {
      const data = await response.json();
      // Check if data has a nested structure (e.g., { data: user })
      if (data.data) {
        const normalizedData = {
          ...data,
          data: normalizeUserData(data.data)
        };
        return NextResponse.json(normalizedData, { status: response.status });
      } else {
        // Direct user object
        const normalizedData = normalizeUserData(data);
        return NextResponse.json(normalizedData, { status: response.status });
      }
    } catch (error) {
      // If JSON parsing fails, return the original response
      return response;
    }
  }
  
  return response;
}