/**
 * Image upload utilities for handling file validation and upload
 */

/**
 * Maximum number of images allowed per post.
 *
 * IMPORTANT: This is for UX only (early validation, UI feedback).
 * Backend (MAX_POST_IMAGES env var) is the authoritative source.
 * Keep this in sync with the backend configuration.
 */
export const MAX_POST_IMAGES = parseInt(
  process.env.NEXT_PUBLIC_MAX_POST_IMAGES || '7'
)

export interface ImageUploadOptions {
  maxSizeBytes?: number
  allowedTypes?: string[]
  quality?: number
}

export interface ImageUploadResult {
  success: boolean
  imageUrl?: string
  error?: string
}

export interface MultipleImageValidationResult {
  valid: boolean
  error?: string
  validFiles: File[]
  rejectedCount: number
}

const DEFAULT_OPTIONS: Required<ImageUploadOptions> = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB - matches backend limit
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'], // Must match backend allowed types
  quality: 0.8
}

/**
 * Validates an image file against size and type constraints
 */
export function validateImageFile(
  file: File, 
  options: ImageUploadOptions = {}
): { valid: boolean; error?: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (!opts.allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `File type ${file.type} not allowed. Supported types: ${opts.allowedTypes.join(', ')}` 
    }
  }

  if (file.size > opts.maxSizeBytes) {
    const maxSizeMB = opts.maxSizeBytes / (1024 * 1024)
    return { 
      valid: false, 
      error: `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds limit of ${maxSizeMB}MB` 
    }
  }

  return { valid: true }
}

/**
 * Compresses an image file to reduce size while maintaining quality
 */
export function compressImage(
  file: File, 
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions (max 1920x1080)
      const maxWidth = 1920
      const maxHeight = 1080
      let { width, height } = img

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width *= ratio
        height *= ratio
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        file.type,
        quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Creates a preview URL for an image file
 */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * Uploads an image file to the server
 */
export async function uploadImage(
  file: File, 
  options: ImageUploadOptions = {}
): Promise<ImageUploadResult> {
  try {
    // Validate file
    const validation = validateImageFile(file, options)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Compress image if it's large
    let fileToUpload = file
    if (file.size > 1024 * 1024) { // 1MB
      try {
        fileToUpload = await compressImage(file, options.quality || 0.8)
      } catch (error) {
        console.warn('Image compression failed, using original file:', error)
      }
    }

    // Upload to server
    const formData = new FormData()
    formData.append('image', fileToUpload)

    const token = localStorage.getItem('access_token')
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      // Handle non-JSON error responses gracefully
      let errorMessage = 'Upload failed'
      try {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.detail || errorMessage
        } else {
          const text = await response.text()
          if (text.toLowerCase().includes('forbidden')) {
            errorMessage = 'Upload blocked - try a smaller image (under 5MB)'
          } else if (response.status === 413) {
            errorMessage = 'Image file is too large (max 5MB)'
          } else if (response.status === 403) {
            errorMessage = 'Upload blocked by security rules'
          } else {
            errorMessage = `Upload failed: ${response.status}`
          }
        }
      } catch {
        if (response.status === 413) {
          errorMessage = 'Image file is too large (max 5MB)'
        } else if (response.status === 403) {
          errorMessage = 'Upload blocked by security rules'
        }
      }
      return { success: false, error: errorMessage }
    }

    // Parse successful response
    try {
      const result = await response.json()
      return { success: true, imageUrl: result.imageUrl }
    } catch {
      return { success: false, error: 'Invalid response from server' }
    }

  } catch (error) {
    console.error('Image upload error:', error)
    return { 
      success: false, 
      error: 'Network error during upload' 
    }
  }
}

/**
 * Revokes a blob URL to free memory
 */
export function revokeImagePreview(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/**
 * Validates multiple image files for multi-image post upload.
 *
 * Checks:
 * - Total count doesn't exceed MAX_POST_IMAGES
 * - Each file passes individual validation
 *
 * @param files - Array of files to validate
 * @param existingCount - Number of images already attached to the post
 * @param options - Optional validation options
 */
export function validateMultipleImageFiles(
  files: File[],
  existingCount: number = 0,
  options: ImageUploadOptions = {}
): MultipleImageValidationResult {
  const remaining = MAX_POST_IMAGES - existingCount

  if (remaining <= 0) {
    return {
      valid: false,
      error: `Maximum ${MAX_POST_IMAGES} images allowed per post`,
      validFiles: [],
      rejectedCount: files.length
    }
  }

  if (files.length > remaining) {
    // Take only what we can accept
    const acceptableFiles = files.slice(0, remaining)
    const validFiles: File[] = []

    for (const file of acceptableFiles) {
      const result = validateImageFile(file, options)
      if (result.valid) {
        validFiles.push(file)
      }
    }

    return {
      valid: validFiles.length > 0,
      error: `You can only add ${remaining} more image${remaining !== 1 ? 's' : ''}. ${files.length - remaining} file(s) were not added.`,
      validFiles,
      rejectedCount: files.length - validFiles.length
    }
  }

  // Validate each file
  const validFiles: File[] = []
  const errors: string[] = []

  for (const file of files) {
    const result = validateImageFile(file, options)
    if (result.valid) {
      validFiles.push(file)
    } else {
      errors.push(`${file.name}: ${result.error}`)
    }
  }

  if (errors.length > 0 && validFiles.length === 0) {
    return {
      valid: false,
      error: errors.join('; '),
      validFiles: [],
      rejectedCount: files.length
    }
  }

  return {
    valid: true,
    error: errors.length > 0 ? `Some files were rejected: ${errors.join('; ')}` : undefined,
    validFiles,
    rejectedCount: files.length - validFiles.length
  }
}