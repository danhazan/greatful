import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(_request: NextRequest) {
  if (process.env['NODE_ENV'] === 'development') {
    console.warn('[api/users/me] Deprecated profile update route hit. Use /api/users/me/profile with PUT instead.')
  }

  return NextResponse.json(
    {
      error: 'Invalid route for profile updates. Use /api/users/me/profile with PUT.'
    },
    { status: 400 }
  )
}
