import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, validateAuth, getAuthHeader, createFetchOptions, handleApiError } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  // Validate authorization
  const authError = validateAuth(request)
  if (authError) return authError

  const authHeader = getAuthHeader(request)!
  const notificationId = params.notificationId

  try {
    // Forward the request to the FastAPI backend
    const response = await fetch(
      `${API_BASE_URL}/api/v1/notifications/${notificationId}/read`,
      createFetchOptions('POST', authHeader)
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to mark notification as read' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    return handleApiError(error, 'mark notification as read')
  }
}