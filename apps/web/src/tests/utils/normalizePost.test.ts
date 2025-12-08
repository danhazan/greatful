import { describe, it, expect } from '@jest/globals'
import { normalizePostFromApi } from '@/utils/normalizePost'

describe('normalizePost', () => {
  it('should map commentsCount from API response', () => {
    const apiResponse = {
      id: '123',
      content: 'Test post',
      authorId: 1,
      postType: 'spontaneous',
      createdAt: '2024-01-01T00:00:00Z',
      heartsCount: 5,
      reactionsCount: 3,
      commentsCount: 10,
      isHearted: false,
      author: {
        id: 1,
        username: 'testuser',
        name: 'Test User'
      }
    }

    const normalized = normalizePostFromApi(apiResponse)

    expect(normalized).not.toBeNull()
    expect(normalized?.commentsCount).toBe(10)
  })

  it('should default commentsCount to 0 if missing', () => {
    const apiResponse = {
      id: '123',
      content: 'Test post',
      authorId: 1,
      postType: 'spontaneous',
      createdAt: '2024-01-01T00:00:00Z',
      heartsCount: 5,
      reactionsCount: 3,
      isHearted: false,
      author: {
        id: 1,
        username: 'testuser',
        name: 'Test User'
      }
    }

    const normalized = normalizePostFromApi(apiResponse)

    expect(normalized).not.toBeNull()
    expect(normalized?.commentsCount).toBe(0)
  })

  it('should handle camelCase commentsCount from API', () => {
    const apiResponse = {
      id: '123',
      content: 'Test post',
      author_id: 1,
      post_type: 'spontaneous',
      created_at: '2024-01-01T00:00:00Z',
      hearts_count: 5,
      reactions_count: 3,
      commentsCount: 7,
      is_hearted: false,
      author: {
        id: 1,
        username: 'testuser',
        name: 'Test User'
      }
    }

    const normalized = normalizePostFromApi(apiResponse)

    expect(normalized).not.toBeNull()
    expect(normalized?.commentsCount).toBe(7)
  })
})
