import { describe, it, expect } from '@jest/globals'
import { normalizePostFromApi } from '@/utils/normalizePost'

describe('normalizePost', () => {
  it('should map commentsCount from API response', () => {
    const apiResponse = {
      id: '123',
      content: 'Test post',
      authorId: 1,
      createdAt: '2024-01-01T00:00:00Z',
      reactionsCount: 3,
      commentsCount: 10,
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
      createdAt: '2024-01-01T00:00:00Z',
      reactionsCount: 3,
      author: {
        id: 1,
        username: 'testuser',
        name: 'Test User'
      }
    }

    const normalized = normalizePostFromApi(apiResponse)

    expect(normalized).not.toBeNull()
    // normalizePost is a guard layer, not a default adder - missing fields stay undefined
    expect(normalized?.commentsCount).toBeUndefined()
  })

  it('should handle camelCase commentsCount from API', () => {
    const apiResponse = {
      id: '123',
      content: 'Test post',
      authorId: 1,
      createdAt: '2024-01-01T00:00:00Z',
      reactionsCount: 3,
      commentsCount: 7,
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
