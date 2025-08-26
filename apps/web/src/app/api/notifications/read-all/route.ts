import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, validateAuth, getAuthHeader, createFetchOptions, handleApiError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  // Validate authorization
  const authError = validateAuth(request)
  if (authError) return authError

  const authHeader = getAuthHeader(request)!

  try {
    // Forward the request to the FastAPI backend
    const response = await fetch(
      `${API_BASE_URL}/api/v1/notifications/read-all`,
      createFetchOptions('POST', authHeader)
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to mark all notifications as read' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    return handleApiError(error, 'mark all notifications as read')
  }
}