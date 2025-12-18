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

// Compression settings
const COMPRESSION_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1920, // Square aspect ratio support
  initialQuality: 0.85,
  minQuality: 0.5,
  qualityStep: 0.1,
  // Compress if file exceeds this threshold (most phone photos do)
  compressionThreshold: 500 * 1024, // 500KB
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
 * Validates file type only (for use before compression)
 */
function validateImageType(
  file: File,
  allowedTypes: string[] = DEFAULT_OPTIONS.allowedTypes
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type || 'unknown'} not supported. Use JPEG, PNG, or WebP.`
    }
  }

  return { valid: true }
}

export interface PrepareImageResult {
  success: boolean
  file?: File
  error?: string
  wasCompressed?: boolean
  originalSize?: number
  finalSize?: number
}

/**
 * Prepares an image for upload by validating type and compressing if needed.
 *
 * This function handles the common case where phone photos exceed the upload
 * limit but can be safely compressed without visible quality loss.
 *
 * Flow:
 * 1. Validate file type (reject unsupported formats like GIF)
 * 2. If file is small enough, return as-is
 * 3. Compress to max dimensions with high quality
 * 4. If still too large, reduce quality iteratively
 * 5. Return compressed file or error if we can't get it small enough
 */
export async function prepareImageForUpload(
  file: File,
  options: ImageUploadOptions = {}
): Promise<PrepareImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = file.size

  // Step 1: Validate file type
  const typeValidation = validateImageType(file, opts.allowedTypes)
  if (!typeValidation.valid) {
    return { success: false, error: typeValidation.error }
  }

  // Step 2: If file is already small enough and below compression threshold, use as-is
  if (file.size <= opts.maxSizeBytes && file.size <= COMPRESSION_CONFIG.compressionThreshold) {
    return {
      success: true,
      file,
      wasCompressed: false,
      originalSize,
      finalSize: file.size
    }
  }

  // Step 3: Attempt compression with iterative quality reduction
  let quality = COMPRESSION_CONFIG.initialQuality
  let compressedFile: File | null = null

  while (quality >= COMPRESSION_CONFIG.minQuality) {
    try {
      compressedFile = await compressImageWithQuality(file, quality)

      // Success: file is under the limit
      if (compressedFile.size <= opts.maxSizeBytes) {
        return {
          success: true,
          file: compressedFile,
          wasCompressed: true,
          originalSize,
          finalSize: compressedFile.size
        }
      }

      // Still too large, try lower quality
      quality -= COMPRESSION_CONFIG.qualityStep
    } catch (error) {
      // Compression failed, try lower quality or give up
      quality -= COMPRESSION_CONFIG.qualityStep
    }
  }

  // Step 4: If we have any compressed result, even if over limit, check if it helps
  if (compressedFile && compressedFile.size <= opts.maxSizeBytes) {
    return {
      success: true,
      file: compressedFile,
      wasCompressed: true,
      originalSize,
      finalSize: compressedFile.size
    }
  }

  // Step 5: If original was under limit but compression was attempted, use original
  if (file.size <= opts.maxSizeBytes) {
    return {
      success: true,
      file,
      wasCompressed: false,
      originalSize,
      finalSize: file.size
    }
  }

  // Step 6: Couldn't get the file small enough
  const finalSize = compressedFile?.size || file.size
  const sizeMB = (finalSize / (1024 * 1024)).toFixed(1)
  return {
    success: false,
    error: `Image is too large (${sizeMB}MB after compression). Please use a smaller image.`,
    originalSize,
    finalSize
  }
}

/**
 * Compresses an image to target dimensions and quality.
 * Internal helper for prepareImageForUpload.
 */
function compressImageWithQuality(
  file: File,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Clean up the object URL
      URL.revokeObjectURL(img.src)

      // Calculate new dimensions preserving aspect ratio
      const { maxWidth, maxHeight } = COMPRESSION_CONFIG
      let { width, height } = img

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height

      // Draw image to canvas
      ctx?.drawImage(img, 0, 0, width, height)

      // Convert to blob with specified quality
      // Always output as JPEG for consistent compression (except PNG with transparency)
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Preserve original extension for PNGs, use jpg for converted files
            const extension = outputType === 'image/png' ? '.png' : '.jpg'
            const baseName = file.name.replace(/\.[^.]+$/, '')
            const fileName = `${baseName}${extension}`

            const compressedFile = new File([blob], fileName, {
              type: outputType,
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        outputType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = URL.createObjectURL(file)
  })
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

export interface PrepareMultipleImagesResult {
  success: boolean
  error?: string
  preparedFiles: File[]
  rejectedCount: number
}

/**
 * Prepares multiple images for upload with compression.
 *
 * This async version:
 * 1. Checks count limit
 * 2. Validates and compresses each file
 * 3. Returns prepared files ready for upload
 *
 * @param files - Array of files to prepare
 * @param existingCount - Number of images already attached
 * @param options - Optional validation options
 */
export async function prepareMultipleImagesForUpload(
  files: File[],
  existingCount: number = 0,
  options: ImageUploadOptions = {}
): Promise<PrepareMultipleImagesResult> {
  const remaining = MAX_POST_IMAGES - existingCount

  if (remaining <= 0) {
    return {
      success: false,
      error: `Maximum ${MAX_POST_IMAGES} images allowed per post`,
      preparedFiles: [],
      rejectedCount: files.length
    }
  }

  // Take only what we can accept based on count limit
  const filesToProcess = files.slice(0, remaining)
  const countRejected = files.length - filesToProcess.length

  // Prepare each file (validates type and compresses)
  const preparedFiles: File[] = []
  const errors: string[] = []

  for (const file of filesToProcess) {
    const result = await prepareImageForUpload(file, options)
    if (result.success && result.file) {
      preparedFiles.push(result.file)
    } else {
      errors.push(`${file.name}: ${result.error || 'Failed to process'}`)
    }
  }

  const totalRejected = countRejected + errors.length

  // Build error message
  let errorMessage: string | undefined
  if (countRejected > 0 && errors.length > 0) {
    errorMessage = `${countRejected} file(s) exceeded limit. ${errors.join('; ')}`
  } else if (countRejected > 0) {
    errorMessage = `You can only add ${remaining} more image${remaining !== 1 ? 's' : ''}. ${countRejected} file(s) were not added.`
  } else if (errors.length > 0) {
    errorMessage = errors.length === 1 ? errors[0] : `Some files couldn't be processed: ${errors.join('; ')}`
  }

  if (preparedFiles.length === 0) {
    return {
      success: false,
      error: errorMessage || 'No valid images to upload',
      preparedFiles: [],
      rejectedCount: totalRejected
    }
  }

  return {
    success: true,
    error: errorMessage,
    preparedFiles,
    rejectedCount: totalRejected
  }
}