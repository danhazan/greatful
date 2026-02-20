/**
 * Tests for image URL transformation utilities
 */

import { getImageUrl } from '@/utils/imageUtils'

// Mock environment variable
const originalEnv = process.env['NEXT_PUBLIC_API_URL']
beforeEach(() => {
  process.env['NEXT_PUBLIC_API_URL'] = 'http://localhost:8000'
})

afterEach(() => {
  process.env['NEXT_PUBLIC_API_URL'] = originalEnv
})

describe('getImageUrl', () => {
  it('should return null for null input', () => {
    expect(getImageUrl(null)).toBeNull()
  })

  it('should return null for undefined input', () => {
    expect(getImageUrl(undefined)).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(getImageUrl('')).toBeNull()
  })

  it('should return absolute HTTP URLs unchanged', () => {
    const absoluteUrl = 'http://example.com/image.jpg'
    expect(getImageUrl(absoluteUrl)).toBe(absoluteUrl)
  })

  it('should return absolute HTTPS URLs unchanged', () => {
    const absoluteUrl = 'https://example.com/image.jpg'
    expect(getImageUrl(absoluteUrl)).toBe(absoluteUrl)
  })

  it('should transform relative URLs to absolute URLs', () => {
    const relativeUrl = '/uploads/profile_photos/profile_123_medium.jpg'
    const expected = 'http://localhost:8000/uploads/profile_photos/profile_123_medium.jpg'
    expect(getImageUrl(relativeUrl)).toBe(expected)
  })

  it('should handle profile photo URLs correctly', () => {
    const profileUrl = '/uploads/profile_photos/profile_ca8ac06a-9d2c-468d-8d7a-581cd32630ba_medium.jpg'
    const expected = 'http://localhost:8000/uploads/profile_photos/profile_ca8ac06a-9d2c-468d-8d7a-581cd32630ba_medium.jpg'
    expect(getImageUrl(profileUrl)).toBe(expected)
  })

  it('should handle post image URLs correctly', () => {
    const postUrl = '/uploads/posts/aca5d26b-95e3-462b-b9dc-4749482c1827.jpg'
    const expected = 'http://localhost:8000/uploads/posts/aca5d26b-95e3-462b-b9dc-4749482c1827.jpg'
    expect(getImageUrl(postUrl)).toBe(expected)
  })

  it('should use fallback URL when NEXT_PUBLIC_API_URL is not set', () => {
    delete process.env['NEXT_PUBLIC_API_URL']
    const relativeUrl = '/uploads/test.jpg'
    const expected = 'http://localhost:8000/uploads/test.jpg'
    expect(getImageUrl(relativeUrl)).toBe(expected)
  })

  it('should use custom API URL when NEXT_PUBLIC_API_URL is set', () => {
    process.env['NEXT_PUBLIC_API_URL'] = 'https://api.example.com'
    const relativeUrl = '/uploads/test.jpg'
    const expected = 'https://api.example.com/uploads/test.jpg'
    expect(getImageUrl(relativeUrl)).toBe(expected)
  })
})