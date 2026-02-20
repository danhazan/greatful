import { NextRequest, NextResponse } from 'next/server'
import { proxyApiRequest } from '@/lib/api-proxy'
import { transformApiResponse, transformApiRequest } from '@/lib/caseTransform'

export async function GET(request: NextRequest) {
    const response = await proxyApiRequest(request, '/api/v1/users/me/preferences', {
        requireAuth: true,
        forwardCookies: true,
        passthroughOn401: true
    })

    if (response.ok) {
        try {
            const data = await response.json()
            return NextResponse.json(transformApiResponse(data))
        } catch (error) {
            console.error('Error transforming preferences GET response:', error)
            return response
        }
    }

    return response
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const transformedBody = transformApiRequest(body)

        // Create a new request with the transformed body
        const newRequest = new NextRequest(request, {
            body: JSON.stringify(transformedBody)
        })

        const response = await proxyApiRequest(newRequest, '/api/v1/users/me/preferences', {
            requireAuth: true,
            forwardCookies: true,
            passthroughOn401: true
        })

        if (response.ok) {
            try {
                const data = await response.json()
                return NextResponse.json(transformApiResponse(data))
            } catch (error) {
                console.error('Error transforming preferences PUT response:', error)
                return response
            }
        }

        return response
    } catch (error) {
        console.error('Error in preferences PUT handler:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
