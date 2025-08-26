import { NextRequest, NextResponse } from 'next/server'
import { 
  handleApiError, 
  createAuthHeaders, 
  createErrorResponse,
  createSuccessResponse,
  hasValidAuth
} from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    if (!hasValidAuth(request)) {
      return createErrorResponse('Authorization header required', 401)
    }
    
    const authHeaders = createAuthHeaders(request)

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return createErrorResponse('No image file provided', 400)
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return createErrorResponse('File must be an image', 400)
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return createErrorResponse('Image must be smaller than 5MB', 400)
    }

    // For MVP: Convert image to data URL for storage
    // In production, you would upload to AWS S3, Cloudinary, etc.
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Convert to base64 data URL
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    return createSuccessResponse({
      imageUrl: dataUrl
    }, 'Image processed successfully')

  } catch (error) {
    return handleApiError(error, 'uploading image')
  }
}