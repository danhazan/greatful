import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    // Always try to call the backend OAuth endpoint first
    // The backend will determine OAuth availability based on its configuration
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/oauth/providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        // Backend OAuth is configured and working
        return NextResponse.json(data)
      }

      // If backend OAuth is not configured (404/501), show OAuth buttons anyway
      // Let the actual OAuth flow handle the error gracefully
      if (response.status === 404 || response.status === 501) {
        console.log('Backend OAuth not configured, but showing OAuth buttons for better UX')
        
        return NextResponse.json({
          data: {
            providers: {
              google: true,  // Always show Google button
              facebook: false  // Facebook not implemented yet
            },
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
            environment: process.env.NODE_ENV || 'development',
            initialized: true  // Always show as initialized
          }
        })
      }
      
      // Other backend errors - still show OAuth buttons
      console.log('Backend OAuth error, but showing OAuth buttons for better UX')
      return NextResponse.json({
        data: {
          providers: {
            google: true,
            facebook: false
          },
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
          environment: process.env.NODE_ENV || 'development',
          initialized: true
        }
      })
    } catch (backendError) {
      // Backend is not available - still show OAuth buttons
      console.log('Backend not available, but showing OAuth buttons for better UX')
      
      return NextResponse.json({
        data: {
          providers: {
            google: true,
            facebook: false
          },
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
          environment: process.env.NODE_ENV || 'development',
          initialized: true
        }
      })
    }
  } catch (error) {
    console.error('Error in OAuth providers endpoint:', error)
    
    // Even on error, show OAuth buttons - let the OAuth flow handle errors
    return NextResponse.json({
      data: {
        providers: {
          google: true,
          facebook: false
        },
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        environment: process.env.NODE_ENV || 'development',
        initialized: true
      }
    })
  }
}