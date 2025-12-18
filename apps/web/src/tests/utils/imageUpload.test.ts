import {
  validateImageFile,
  validateMultipleImageFiles,
  prepareImageForUpload,
  prepareMultipleImagesForUpload,
  MAX_POST_IMAGES
} from '@/utils/imageUpload'

// Mock canvas and image APIs for compression tests
const mockToBlob = jest.fn()
const mockDrawImage = jest.fn()
const mockGetContext = jest.fn(() => ({
  drawImage: mockDrawImage
}))

// Mock canvas element
const mockCanvasElement = {
  width: 0,
  height: 0,
  getContext: mockGetContext,
  toBlob: mockToBlob
}

// Store original createElement
const originalCreateElement = document.createElement.bind(document)

// Mock Image class
class MockImage {
  src: string = ''
  width: number = 4000
  height: number = 3000
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    // Simulate async image loading
    setTimeout(() => {
      if (this.onload) this.onload()
    }, 0)
  }
}

// Setup mocks before tests
beforeAll(() => {
  // Mock URL.createObjectURL and revokeObjectURL
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
  global.URL.revokeObjectURL = jest.fn()

  // Mock Image
  ;(global as any).Image = MockImage

  // Mock document.createElement
  jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvasElement as unknown as HTMLCanvasElement
    }
    return originalCreateElement(tagName)
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

describe('imageUpload utilities', () => {
  describe('validateImageFile', () => {
    it('accepts valid JPEG file', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB

      const result = validateImageFile(file)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('accepts valid PNG file', () => {
      const file = new File([''], 'test.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB

      const result = validateImageFile(file)
      expect(result.valid).toBe(true)
    })

    it('accepts valid WebP file', () => {
      const file = new File([''], 'test.webp', { type: 'image/webp' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB

      const result = validateImageFile(file)
      expect(result.valid).toBe(true)
    })

    it('rejects file exceeding size limit', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 }) // 10MB

      const result = validateImageFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds limit')
    })

    it('rejects unsupported file type', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB

      const result = validateImageFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('returns error when no file provided', () => {
      const result = validateImageFile(null as unknown as File)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('No file provided')
    })
  })

  describe('validateMultipleImageFiles', () => {
    const createMockFile = (name: string, sizeMB: number = 1, type: string = 'image/jpeg'): File => {
      const file = new File([''], name, { type })
      Object.defineProperty(file, 'size', { value: sizeMB * 1024 * 1024 })
      return file
    }

    it('accepts valid files within limit', () => {
      const files = [
        createMockFile('img1.jpg'),
        createMockFile('img2.jpg'),
        createMockFile('img3.jpg')
      ]

      const result = validateMultipleImageFiles(files, 0)
      expect(result.valid).toBe(true)
      expect(result.validFiles).toHaveLength(3)
      expect(result.rejectedCount).toBe(0)
    })

    it('respects MAX_POST_IMAGES limit', () => {
      // Create more files than MAX_POST_IMAGES
      const files = Array.from({ length: MAX_POST_IMAGES + 3 }, (_, i) =>
        createMockFile(`img${i}.jpg`)
      )

      const result = validateMultipleImageFiles(files, 0)
      expect(result.validFiles.length).toBeLessThanOrEqual(MAX_POST_IMAGES)
      expect(result.error).toContain('more image')
    })

    it('accounts for existing images', () => {
      const existingCount = MAX_POST_IMAGES - 2
      const files = [
        createMockFile('new1.jpg'),
        createMockFile('new2.jpg'),
        createMockFile('new3.jpg') // This one should be rejected
      ]

      const result = validateMultipleImageFiles(files, existingCount)
      expect(result.validFiles).toHaveLength(2)
      expect(result.error).toContain('more image')
    })

    it('returns error when at max capacity', () => {
      const files = [createMockFile('img1.jpg')]

      const result = validateMultipleImageFiles(files, MAX_POST_IMAGES)
      expect(result.valid).toBe(false)
      expect(result.validFiles).toHaveLength(0)
      expect(result.error).toContain('Maximum')
    })

    it('filters out invalid files while keeping valid ones', () => {
      const files = [
        createMockFile('valid.jpg'),
        createMockFile('toobig.jpg', 10), // 10MB - too big
        createMockFile('valid2.png', 1, 'image/png'),
        createMockFile('invalid.pdf', 1, 'application/pdf')
      ]

      const result = validateMultipleImageFiles(files, 0)
      expect(result.valid).toBe(true) // At least some files are valid
      expect(result.validFiles).toHaveLength(2)
      expect(result.rejectedCount).toBe(2)
    })

    it('returns all errors when all files are invalid', () => {
      const files = [
        createMockFile('bad1.pdf', 1, 'application/pdf'),
        createMockFile('bad2.txt', 1, 'text/plain')
      ]

      const result = validateMultipleImageFiles(files, 0)
      expect(result.valid).toBe(false)
      expect(result.validFiles).toHaveLength(0)
      expect(result.error).toBeDefined()
    })
  })

  describe('MAX_POST_IMAGES constant', () => {
    it('is defined and is a positive number', () => {
      expect(MAX_POST_IMAGES).toBeDefined()
      expect(typeof MAX_POST_IMAGES).toBe('number')
      expect(MAX_POST_IMAGES).toBeGreaterThan(0)
    })

    it('defaults to 7 when env var is not set', () => {
      // This tests the default value
      expect(MAX_POST_IMAGES).toBe(7)
    })
  })

  describe('prepareImageForUpload', () => {
    const createMockFile = (name: string, sizeBytes: number, type: string = 'image/jpeg'): File => {
      const file = new File([''], name, { type })
      Object.defineProperty(file, 'size', { value: sizeBytes })
      return file
    }

    beforeEach(() => {
      mockToBlob.mockReset()
      mockDrawImage.mockReset()
      mockGetContext.mockClear()
    })

    it('rejects unsupported file types like GIF', async () => {
      const gifFile = createMockFile('animation.gif', 1024 * 1024, 'image/gif')

      const result = await prepareImageForUpload(gifFile)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')
      expect(result.file).toBeUndefined()
    })

    it('rejects PDF files', async () => {
      const pdfFile = createMockFile('document.pdf', 1024 * 1024, 'application/pdf')

      const result = await prepareImageForUpload(pdfFile)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('passes through small files without compression', async () => {
      // File under 500KB threshold - should pass through unchanged
      const smallFile = createMockFile('small.jpg', 100 * 1024, 'image/jpeg') // 100KB

      const result = await prepareImageForUpload(smallFile)

      expect(result.success).toBe(true)
      expect(result.file).toBe(smallFile) // Same file reference
      expect(result.wasCompressed).toBe(false)
      expect(result.originalSize).toBe(100 * 1024)
      expect(result.finalSize).toBe(100 * 1024)
      // Canvas should not be used for small files
      expect(mockGetContext).not.toHaveBeenCalled()
    })

    it('attempts compression for files over threshold', async () => {
      // File over 500KB but under 5MB - should attempt compression
      const largeFile = createMockFile('large.jpg', 2 * 1024 * 1024, 'image/jpeg') // 2MB

      // Mock successful compression that produces smaller file
      const compressedBlob = new Blob(['compressed'], { type: 'image/jpeg' })
      Object.defineProperty(compressedBlob, 'size', { value: 500 * 1024 }) // 500KB result
      mockToBlob.mockImplementation((callback: BlobCallback) => {
        callback(compressedBlob)
      })

      const result = await prepareImageForUpload(largeFile)

      expect(result.success).toBe(true)
      expect(result.wasCompressed).toBe(true)
      expect(result.originalSize).toBe(2 * 1024 * 1024)
      expect(mockGetContext).toHaveBeenCalled()
    })

    it('attempts compression for files over 5MB limit', async () => {
      // File over 5MB - should attempt compression to get under limit
      const hugeFile = createMockFile('huge.jpg', 8 * 1024 * 1024, 'image/jpeg') // 8MB

      // Mock successful compression that brings it under limit
      const compressedBlob = new Blob(['compressed'], { type: 'image/jpeg' })
      Object.defineProperty(compressedBlob, 'size', { value: 3 * 1024 * 1024 }) // 3MB result
      mockToBlob.mockImplementation((callback: BlobCallback) => {
        callback(compressedBlob)
      })

      const result = await prepareImageForUpload(hugeFile)

      expect(result.success).toBe(true)
      expect(result.wasCompressed).toBe(true)
      expect(result.originalSize).toBe(8 * 1024 * 1024)
    })

    it('returns error when compression cannot get file under limit', async () => {
      // File that's too large even after compression
      const hugeFile = createMockFile('massive.jpg', 50 * 1024 * 1024, 'image/jpeg') // 50MB

      // Mock compression failure - blob is null, which will cause all iterations to fail
      // This simulates the case where we can't compress the file at all
      mockToBlob.mockImplementation((callback: BlobCallback) => {
        callback(null)
      })

      const result = await prepareImageForUpload(hugeFile)

      expect(result.success).toBe(false)
      expect(result.error).toContain('too large')
      expect(result.originalSize).toBe(50 * 1024 * 1024)
    })

    it('falls back to original file when compression fails but file is under limit', async () => {
      // File under 5MB limit but over compression threshold
      const largeFile = createMockFile('large.jpg', 2 * 1024 * 1024, 'image/jpeg') // 2MB

      // Mock compression failure (blob is null)
      mockToBlob.mockImplementation((callback: BlobCallback) => {
        callback(null)
      })

      const result = await prepareImageForUpload(largeFile)

      // Since original file is under 5MB limit, it should succeed with original
      expect(result.success).toBe(true)
      expect(result.file).toBe(largeFile)
      expect(result.wasCompressed).toBe(false)
    })

    it('fails when compression fails and file is over limit', async () => {
      // File over 5MB limit
      const hugeFile = createMockFile('huge.jpg', 8 * 1024 * 1024, 'image/jpeg') // 8MB

      // Mock compression failure (blob is null)
      mockToBlob.mockImplementation((callback: BlobCallback) => {
        callback(null)
      })

      const result = await prepareImageForUpload(hugeFile)

      // Should fail since we can't compress and original is over limit
      expect(result.success).toBe(false)
      expect(result.error).toContain('too large')
    })

    it('accepts PNG files', async () => {
      const pngFile = createMockFile('image.png', 100 * 1024, 'image/png')

      const result = await prepareImageForUpload(pngFile)

      expect(result.success).toBe(true)
      expect(result.file).toBe(pngFile)
    })

    it('accepts WebP files', async () => {
      const webpFile = createMockFile('image.webp', 100 * 1024, 'image/webp')

      const result = await prepareImageForUpload(webpFile)

      expect(result.success).toBe(true)
      expect(result.file).toBe(webpFile)
    })
  })

  describe('prepareMultipleImagesForUpload', () => {
    const createMockFile = (name: string, sizeKB: number = 100, type: string = 'image/jpeg'): File => {
      const file = new File([''], name, { type })
      Object.defineProperty(file, 'size', { value: sizeKB * 1024 })
      return file
    }

    beforeEach(() => {
      mockToBlob.mockReset()
    })

    it('processes multiple valid files', async () => {
      const files = [
        createMockFile('img1.jpg', 100),
        createMockFile('img2.jpg', 100),
        createMockFile('img3.png', 100)
      ]

      const result = await prepareMultipleImagesForUpload(files, 0)

      expect(result.success).toBe(true)
      expect(result.preparedFiles).toHaveLength(3)
      expect(result.rejectedCount).toBe(0)
    })

    it('respects MAX_POST_IMAGES limit', async () => {
      // Create more files than allowed
      const files = Array.from({ length: MAX_POST_IMAGES + 3 }, (_, i) =>
        createMockFile(`img${i}.jpg`, 100)
      )

      const result = await prepareMultipleImagesForUpload(files, 0)

      expect(result.success).toBe(true)
      expect(result.preparedFiles.length).toBeLessThanOrEqual(MAX_POST_IMAGES)
      expect(result.error).toContain('more image')
    })

    it('accounts for existing images', async () => {
      const existingCount = MAX_POST_IMAGES - 2
      const files = [
        createMockFile('new1.jpg', 100),
        createMockFile('new2.jpg', 100),
        createMockFile('new3.jpg', 100) // Should be rejected due to limit
      ]

      const result = await prepareMultipleImagesForUpload(files, existingCount)

      expect(result.preparedFiles).toHaveLength(2)
      expect(result.rejectedCount).toBe(1)
    })

    it('rejects unsupported file types while keeping valid ones', async () => {
      const files = [
        createMockFile('valid.jpg', 100),
        createMockFile('invalid.gif', 100, 'image/gif'),
        createMockFile('valid2.png', 100)
      ]

      const result = await prepareMultipleImagesForUpload(files, 0)

      expect(result.success).toBe(true)
      expect(result.preparedFiles).toHaveLength(2)
      expect(result.rejectedCount).toBe(1)
      expect(result.error).toContain('gif')
    })

    it('returns error when at max capacity', async () => {
      const files = [createMockFile('img.jpg', 100)]

      const result = await prepareMultipleImagesForUpload(files, MAX_POST_IMAGES)

      expect(result.success).toBe(false)
      expect(result.preparedFiles).toHaveLength(0)
      expect(result.error).toContain('Maximum')
    })

    it('returns error when all files are invalid', async () => {
      const files = [
        createMockFile('bad1.gif', 100, 'image/gif'),
        createMockFile('bad2.pdf', 100, 'application/pdf')
      ]

      const result = await prepareMultipleImagesForUpload(files, 0)

      expect(result.success).toBe(false)
      expect(result.preparedFiles).toHaveLength(0)
      expect(result.error).toBeDefined()
    })
  })
})
