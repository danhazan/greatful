import { describe, it, expect, beforeEach } from '@jest/globals'
import { buildPostMetadata, getPostPreviewImage } from '@/lib/post-metadata'
import { normalizePostPayload } from '@/lib/post-data'

describe('post metadata helpers', () => {
  beforeEach(() => {
    process.env['NEXT_PUBLIC_APP_URL'] = 'https://grateful.example.com'
    process.env['API_BASE_URL'] = 'https://api.example.com'
    process.env['NEXT_PUBLIC_API_URL'] = 'https://api.example.com'
  })

  it('uses the lowest-position image for the preview', () => {
    const previewImage = getPostPreviewImage({
      imageUrl: 'https://legacy.example.com/fallback.jpg',
      images: [
        { position: 3, mediumUrl: 'https://images.example.com/third.jpg' },
        { position: 1, mediumUrl: 'https://images.example.com/first.jpg', width: 1200, height: 630 },
        { position: 2, mediumUrl: 'https://images.example.com/second.jpg' },
      ],
    })

    expect(previewImage).toEqual({
      url: 'https://images.example.com/first.jpg',
      width: 1200,
      height: 630,
    })
  })

  it('falls back to array order when image positions are missing', () => {
    const previewImage = getPostPreviewImage({
      images: [
        { mediumUrl: 'https://images.example.com/first-in-array.jpg' },
        { position: 2, mediumUrl: 'https://images.example.com/second.jpg' },
      ],
    })

    expect(previewImage?.url).toBe('https://images.example.com/first-in-array.jpg')
  })

  it('normalizes relative image urls to absolute urls', () => {
    const normalizedPost = normalizePostPayload({
      id: 'post-123',
      content: 'hello',
      author: {
        id: 5,
        username: 'tester',
        image: '/avatars/tester.jpg',
      },
      image_url: '/uploads/legacy.jpg',
      images: [
        {
          id: 'img-1',
          position: 0,
          thumbnail_url: '/uploads/thumb.jpg',
          medium_url: '/uploads/medium.jpg',
          original_url: '/uploads/original.jpg',
        }
      ],
    })

    expect(normalizedPost.author.image).toBe('https://api.example.com/avatars/tester.jpg')
    expect(normalizedPost.imageUrl).toBe('https://api.example.com/uploads/legacy.jpg')
    expect(normalizedPost.images[0]).toMatchObject({
      thumbnailUrl: 'https://api.example.com/uploads/thumb.jpg',
      mediumUrl: 'https://api.example.com/uploads/medium.jpg',
      originalUrl: 'https://api.example.com/uploads/original.jpg',
    })
  })

  it('omits image metadata and uses summary twitter cards when no image exists', () => {
    const metadata = buildPostMetadata({
      id: 'post-123',
      content: 'A gratitude post with no image.',
      author: {
        username: 'tester',
        name: 'Test User',
      },
      createdAt: '2026-01-01T00:00:00Z',
    }, 'post-123')

    expect(metadata.openGraph?.images).toBeUndefined()
    expect(metadata.twitter?.images).toBeUndefined()
    expect(metadata.twitter?.card).toBe('summary')
  })

  it('includes large-image metadata and dimensions when an image exists', () => {
    const metadata = buildPostMetadata({
      id: 'post-123',
      content: 'A gratitude post with an image.',
      author: {
        username: 'tester',
        name: 'Test User',
      },
      createdAt: '2026-01-01T00:00:00Z',
      images: [
        {
          position: 1,
          mediumUrl: 'https://images.example.com/post.jpg',
          width: 1200,
          height: 630,
        }
      ],
    }, 'post-123')

    expect(metadata.openGraph?.url).toBe('https://grateful.example.com/post/post-123')
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: 'https://images.example.com/post.jpg',
        width: 1200,
        height: 630,
      })
    ])
    expect(metadata.twitter?.card).toBe('summary_large_image')
    expect(metadata.twitter?.images).toEqual(['https://images.example.com/post.jpg'])
  })

  it('returns generic metadata for unavailable posts', () => {
    const metadata = buildPostMetadata(null, 'missing-post')

    expect(metadata.title).toBe('Post Not Found - Grateful')
    expect(metadata.description).toBe('The requested gratitude post could not be found.')
    expect(metadata.openGraph?.images).toBeUndefined()
    expect(metadata.twitter?.card).toBe('summary')
  })
})
