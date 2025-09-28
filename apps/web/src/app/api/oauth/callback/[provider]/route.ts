import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params
    const body = await request.json()

    console.log(`OAuth callback proxy: ${provider}`, { 
      code_length: body.code?.length || 0, 
      state: body.state 
    })

    // Forward the request to the backend OAuth callback endpoint
    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/oauth/callback/${provider}`
    
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any relevant headers
        'User-Agent': request.headers.get('user-agent') || '',
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
      },
      body: JSON.stringify({
        code: body.code,
        state: body.state
      }),
    })

    const responseData = await backendResponse.text()
    console.log(`Backend response status: ${backendResponse.status}`)
    console.log(`Backend response data:`, responseData)

    // Return the backend response with the same status and headers
    return new NextResponse(responseData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'application/json',
        // Forward any Set-Cookie headers if present
        ...(backendResponse.headers.get('set-cookie') && {
          'Set-Cookie': backendResponse.headers.get('set-cookie')!
        })
      }
    })

  } catch (error) {
    console.error(`Error in OAuth callback proxy for ${provider}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OAuth proxy failed' },
      { status: 500 }
    )
  }
}