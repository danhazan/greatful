import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from '@/lib/caseTransform'

const API_BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] || 'http://localhost:8000'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const authHeader = request.headers.get('authorization')

        const response = await fetch(`${API_BASE_URL}/api/v1/follows/batch-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            body: JSON.stringify(body)
        })

        const data = await response.json()
        return NextResponse.json(transformApiResponse(data), { status: response.status })
    } catch (error) {
        console.error('Error in batch-status proxy:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch batch follow status' },
            { status: 500 }
        )
    }
}
