import { describe, it, expect } from '@jest/globals'
import { normalizePostFromApi } from '@/utils/normalizePost'

describe('normalizePost', () => {
  it('should map comments_count from API response', () => {
    const apiResponse = {
      id: '123',
      content: 'Test post',
      author_id: 1,
      post_type: 'spontaneous',
      created_at: '2024-01-01T00:00:00Z',
      hearts_count: 5,
      reactions_count: 3,
      comments_count: 10,
      is_hearted: false,
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

  it('should default comments_count to 0 if missing', () => {
    const apiResponse = {
      id: '123',
      content: 'Test post',
      author_id: 1,
      post_type: 'spontaneous',
      created_at: '2024-01-01T00:00:00Z',
      hearts_count: 5,
      reactions_count: 3,
      is_hearted: false,
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
