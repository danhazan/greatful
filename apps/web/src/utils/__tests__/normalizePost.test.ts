import { describe, it, expect } from '@jest/globals'
import { normalizePostFromApi, debugApiResponse, mergePostUpdate } from '../normalizePost'

describe('normalizePostFromApi', () => {
  it('should normalize camelCase API response', () => {
    const apiResponse = {
      id: "123",
      content: "Test content",
      createdAt: "2025-09-09T10:00:00Z",
      updatedAt: "2025-09-09T11:00:00Z",
      imageUrl: "https://example.com/image.jpg",
      reactionsCount: 3,
      currentUserReaction: "heart_eyes",
      author: {
        id: 456,
        username: "testuser",
        displayName: "Test User",
        profileImageUrl: "https://example.com/avatar.jpg"
      }
    }

    const normalized = normalizePostFromApi(apiResponse)

    expect(normalized).toMatchObject({
      id: "123",
      content: "Test content",
      createdAt: "2025-09-09T10:00:00Z",
      updatedAt: "2025-09-09T11:00:00Z",
      imageUrl: "https://example.com/image.jpg",
      reactionsCount: 3,
      currentUserReaction: "heart_eyes",
      author: {
        id: "456",
        username: "testuser",
        displayName: "Test User",
        profileImageUrl: "https://example.com/avatar.jpg"
      }
    })
  })

  it('should handle wrapped API responses', () => {
    const wrappedResponse = {
      data: {
        id: "123",
        content: "Test content",
        createdAt: "2025-09-09T10:00:00Z",
        author: {
          id: 456,
          username: "testuser"
        }
      }
    }

    const normalized = normalizePostFromApi(wrappedResponse)

    expect(normalized?.id).toBe("123")
    expect(normalized?.createdAt).toBe("2025-09-09T10:00:00Z")
  })

  it('should handle all camelCase fields', () => {
    const camelCaseResponse = {
      id: "123",
      content: "Test content",
      createdAt: "2025-09-09T10:00:00Z",
      updatedAt: "2025-09-09T11:00:00Z",
      imageUrl: "https://example.com/image.jpg",
      author: {
        id: 456,
        username: "testuser"
      }
    }

    const normalized = normalizePostFromApi(camelCaseResponse)

    expect(normalized?.createdAt).toBe("2025-09-09T10:00:00Z")
    expect(normalized?.updatedAt).toBe("2025-09-09T11:00:00Z")
    expect(normalized?.imageUrl).toBe("https://example.com/image.jpg")
  })

  it('should return null for invalid input', () => {
    expect(normalizePostFromApi(null)).toBeNull()
    expect(normalizePostFromApi(undefined)).toBeNull()
    expect(normalizePostFromApi({})).toBeNull()
    expect(normalizePostFromApi({ data: {} })).toBeNull()
  })

  it('should provide default values for missing fields', () => {
    const minimalResponse = {
      id: "123",
      content: "Test content",
      author: {
        id: 456
      }
    }

    const normalized = normalizePostFromApi(minimalResponse)

    expect(normalized).not.toBeNull()
    expect(normalized?.id).toBe("123")
    expect(normalized?.content).toBe("Test content")
    expect(normalized?.author.id).toBe("456")
  })

  it('should handle author field variations', () => {
    const responseWithAuthor = {
      id: "123",
      content: "Test content",
      author: {
        id: 456,
        displayName: "Test User"
      }
    }

    const normalized = normalizePostFromApi(responseWithAuthor)

    expect(normalized?.author.id).toBe("456")
    expect(normalized?.author.displayName).toBe("Test User")
  })
})

describe('debugApiResponse', () => {
  it('should not throw errors', () => {
    const mockResponse = {
      id: "123",
      created_at: "2025-09-09T10:00:00Z",
      data: {
        updated_at: "2025-09-09T11:00:00Z"
      }
    }

    expect(() => debugApiResponse(mockResponse, "Test")).not.toThrow()
  })
})

describe('mergePostUpdate', () => {
  it('should preserve existing author image when API response lacks it', () => {
    const existingPost = {
      id: "123",
      content: "Original content",
      createdAt: "2025-09-09T10:00:00Z",
      reactionsCount: 0,
      author: {
        id: "456",
        name: "Test User",
        username: "testuser",
        image: "https://example.com/existing-avatar.jpg"
      }
    }

    const normalizedUpdate = {
      id: "123",
      content: "Updated content",
      createdAt: "2025-09-09T10:00:00Z",
      updatedAt: "2025-09-09T11:00:00Z",
      reactionsCount: 0,
      commentsCount: 0,
      author: {
        id: "456",
        name: "Test User",
        username: "testuser"
        // Note: no image field in the update
      }
    }

    const merged = mergePostUpdate(existingPost as any, normalizedUpdate as any)

    expect(merged.content).toBe("Updated content") // Updated field
    expect(merged.author.image).toBe("https://example.com/existing-avatar.jpg") // Preserved field
    expect(merged.author.name).toBe("Test User") // Updated field
  })

  it('should use new author image when provided in update', () => {
    const existingPost = {
      id: "123",
      content: "Old content",
      createdAt: "2025-09-09T10:00:00Z",
      reactionsCount: 0,
      author: {
        id: "456",
        name: "Test User",
        image: "https://example.com/old-avatar.jpg"
      }
    }

    const normalizedUpdate = {
      id: "123",
      content: "Updated content",
      createdAt: "2025-09-09T10:00:00Z",
      reactionsCount: 0,
      commentsCount: 0,
      author: {
        id: "456",
        name: "Test User",
        image: "https://example.com/new-avatar.jpg"
      }
    }

    const merged = mergePostUpdate(existingPost as any, normalizedUpdate as any)

    expect(merged.author.image).toBe("https://example.com/new-avatar.jpg") // Should use new image
  })

  it('should handle minimal existing post gracefully', () => {
    const existingPost = {
      id: "123",
      content: "Old content",
      createdAt: "2025-09-09T10:00:00Z",
      reactionsCount: 0,
      author: {
        id: "456",
        name: "Old Name"
      }
    }

    const normalizedUpdate = {
      id: "123",
      content: "New content",
      createdAt: "2025-09-09T10:00:00Z",
      reactionsCount: 0,
      commentsCount: 0,
      author: {
        id: "456",
        name: "Test User"
      }
    }

    const merged = mergePostUpdate(existingPost as any, normalizedUpdate as any)

    expect(merged.content).toBe("New content")
    expect(merged.author.name).toBe("Test User")
  })
})