import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    // Check if OAuth is configured by looking for environment variables
    const googleClientId = process.env.GOOGLE_CLIENT_ID
    const facebookAppId = process.env.FACEBOOK_APP_ID
    
    // In development mode, always enable OAuth for better developer experience
    const isDemoMode = process.env.NODE_ENV === 'development'
    
    // If in production and no OAuth environment variables are set, return disabled response
    if (!isDemoMode && !googleClientId && !facebookAppId) {
      return NextResponse.json({
        data: {
          providers: {
            google: false,
            facebook: false
          },
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
          environment: process.env.NODE_ENV || 'development',
          initialized: false
        }
      })
    }

    // Try to call the backend OAuth endpoint if OAuth is configured
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/oauth/providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        // If backend OAuth is not configured, return default response
        if (response.status === 404 || response.status === 501) {
          return NextResponse.json({
            data: {
              providers: {
                google: isDemoMode || !!googleClientId,
                facebook: isDemoMode || !!facebookAppId
              },
              redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
              environment: process.env.NODE_ENV || 'development',
              initialized: isDemoMode || !!(googleClientId || facebookAppId)
            }
          })
        }
        
        return NextResponse.json(
          { error: data.detail || 'Failed to get OAuth providers' },
          { status: response.status }
        )
      }

      return NextResponse.json(data)
    } catch (backendError) {
      // If backend is not available or OAuth endpoint doesn't exist, return default response
      console.log('Backend OAuth not available, using frontend-only configuration')
      return NextResponse.json({
        data: {
          providers: {
            google: isDemoMode || !!googleClientId,
            facebook: isDemoMode || !!facebookAppId
          },
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
          environment: process.env.NODE_ENV || 'development',
          initialized: isDemoMode || !!(googleClientId || facebookAppId)
        }
      })
    }
  } catch (error) {
    console.error('Error in OAuth providers endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}