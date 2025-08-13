/**
 * Image upload utilities for handling file validation and upload
 */

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

const DEFAULT_OPTIONS: Required<ImageUploadOptions> = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
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
      const errorData = await response.json()
      return { 
        success: false, 
        error: errorData.error || 'Upload failed' 
      }
    }

    const result = await response.json()
    return { 
      success: true, 
      imageUrl: result.imageUrl 
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