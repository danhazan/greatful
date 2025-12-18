import {
  validateImageFile,
  validateMultipleImageFiles,
  MAX_POST_IMAGES
} from '@/utils/imageUpload'

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
})
