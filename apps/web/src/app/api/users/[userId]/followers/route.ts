import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from '@/lib/caseTransform'
import { normalizeImageUrls } from '@/utils/proxyImageUrlNormalization'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
  }

  const backendUrl = process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'
  const response = await fetch(`${backendUrl}/api/v1/users/${params.userId}/followers`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  })

  const transformed = transformApiResponse(await response.json())
  if (!response.ok) {
    return NextResponse.json(transformed, { status: response.status })
  }

  return NextResponse.json(normalizeImageUrls(transformed))
}
