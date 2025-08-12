import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1$/, '') || 'http://localhost:8000'
    
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password
      }),
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}