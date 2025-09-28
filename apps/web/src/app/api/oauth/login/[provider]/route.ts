import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params
    const { searchParams } = new URL(request.url)
    const redirectUri = searchParams.get('redirect_uri')

    // Validate provider
    if (!['google', 'facebook'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid OAuth provider' },
        { status: 400 }
      )
    }

    // Check if OAuth is configured
    const googleClientId = process.env.GOOGLE_CLIENT_ID
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
    const facebookAppId = process.env.FACEBOOK_APP_ID

    // Generate state parameter with provider info for CSRF protection
    const randomState = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const state = `${provider}:${randomState}`
    const callbackUri = redirectUri || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`

    // Handle Google OAuth
    if (provider === 'google') {
      if (!googleClientId || !googleClientSecret) {
        return NextResponse.json(
          { error: 'Google OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.' },
          { status: 501 }
        )
      }
      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      googleAuthUrl.searchParams.set('client_id', googleClientId)
      googleAuthUrl.searchParams.set('redirect_uri', callbackUri)
      googleAuthUrl.searchParams.set('response_type', 'code')
      googleAuthUrl.searchParams.set('scope', 'openid email profile')
      googleAuthUrl.searchParams.set('state', state)
      googleAuthUrl.searchParams.set('access_type', 'offline')
      googleAuthUrl.searchParams.set('prompt', 'consent')
      
      return NextResponse.redirect(googleAuthUrl.toString())
    }

    // Handle Facebook OAuth
    if (provider === 'facebook') {
      if (!facebookAppId) {
        return NextResponse.json(
          { error: 'Facebook OAuth not configured. Please add FACEBOOK_APP_ID to your environment variables.' },
          { status: 501 }
        )
      }
      
      // Facebook OAuth implementation would go here
      return NextResponse.json(
        { error: 'Facebook OAuth not yet implemented' },
        { status: 501 }
      )
    }
    
    // If we get here, OAuth is not configured for the requested provider
    return NextResponse.json(
      { error: `${provider} OAuth not configured` },
      { status: 501 }
    )
  } catch (error) {
    console.error(`Error initiating OAuth login for ${provider}:`, error)
    return NextResponse.json(
      { error: 'OAuth service not available' },
      { status: 503 }
    )
  }
}