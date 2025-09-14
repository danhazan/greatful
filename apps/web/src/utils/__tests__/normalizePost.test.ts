import { normalizePostFromApi, debugApiResponse, mergePostUpdate } from '../normalizePost'

describe('normalizePostFromApi', () => {
  it('should normalize snake_case API response to camelCase', () => {
    const apiResponse = {
      id: "123",
      content: "Test content",
      created_at: "2025-09-09T10:00:00Z",
      updated_at: "2025-09-09T11:00:00Z",
      post_type: "daily",
      image_url: "https://example.com/image.jpg",
      hearts_count: 5,
      is_hearted: true,
      reactions_count: 3,
      current_user_reaction: "heart_eyes",
      author: {
        id: 456,
        username: "testuser",
        display_name: "Test User",
        profile_image_url: "https://example.com/avatar.jpg"
      }
    }

    const normalized = normalizePostFromApi(apiResponse)

    expect(normalized).toEqual({
      id: "123",
      content: "Test content",
      createdAt: "2025-09-09T10:00:00Z",
      updatedAt: "2025-09-09T11:00:00Z",
      postType: "daily",
      imageUrl: "https://example.com/image.jpg",
      heartsCount: 5,
      isHearted: true,
      reactionsCount: 3,
      currentUserReaction: "heart_eyes",
      isRead: false,
      isUnread: false,
      postStyle: undefined,
      location: undefined,
      location_data: undefined,
      author: {
        id: "456",
        name: "Test User",
        username: "testuser",
        display_name: "Test User",
        image: "https://example.com/avatar.jpg"
      }
    })
  })

  it('should handle wrapped API responses', () => {
    const wrappedResponse = {
      data: {
        id: "123",
        content: "Test content",
        created_at: "2025-09-09T10:00:00Z",
        post_type: "spontaneous",
        author: {
          id: 456,
          username: "testuser"
        }
      }
    }

    const normalized = normalizePostFromApi(wrappedResponse)

    expect(normalized?.id).toBe("123")
    expect(normalized?.createdAt).toBe("2025-09-09T10:00:00Z")
    expect(normalized?.postType).toBe("spontaneous")
  })

  it('should handle mixed camelCase and snake_case fields', () => {
    const mixedResponse = {
      id: "123",
      content: "Test content",
      createdAt: "2025-09-09T10:00:00Z", // camelCase
      updated_at: "2025-09-09T11:00:00Z", // snake_case
      postType: "photo", // camelCase
      image_url: "https://example.com/image.jpg", // snake_case
      author: {
        id: 456,
        username: "testuser"
      }
    }

    const normalized = normalizePostFromApi(mixedResponse)

    expect(normalized?.createdAt).toBe("2025-09-09T10:00:00Z")
    expect(normalized?.updatedAt).toBe("2025-09-09T11:00:00Z")
    expect(normalized?.postType).toBe("photo")
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

    expect(normalized?.heartsCount).toBe(0)
    expect(normalized?.isHearted).toBe(false)
    expect(normalized?.reactionsCount).toBe(0)
    expect(normalized?.postType).toBe("spontaneous")
    expect(normalized?.isRead).toBe(false)
    expect(normalized?.isUnread).toBe(false)
    expect(normalized?.author.name).toBe("")
  })

  it('should handle author field variations', () => {
    const responseWithUserIdAuthor = {
      id: "123",
      content: "Test content",
      author: {
        user_id: 456,
        display_name: "Test User"
      }
    }

    const normalized = normalizePostFromApi(responseWithUserIdAuthor)

    expect(normalized?.author.id).toBe("456")
    expect(normalized?.author.name).toBe("Test User")
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
      postType: "daily" as const,
      heartsCount: 0,
      isHearted: false,
      reactionsCount: 0,
      author: {
        id: "456",
        name: "Test User",
        username: "testuser"
        // Note: no image field in the update
      }
    }

    const merged = mergePostUpdate(existingPost, normalizedUpdate)

    expect(merged.content).toBe("Updated content") // Updated field
    expect(merged.author.image).toBe("https://example.com/existing-avatar.jpg") // Preserved field
    expect(merged.author.name).toBe("Test User") // Updated field
  })

  it('should use new author image when provided in update', () => {
    const existingPost = {
      id: "123",
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
      postType: "daily" as const,
      heartsCount: 0,
      isHearted: false,
      reactionsCount: 0,
      author: {
        id: "456",
        name: "Test User",
        image: "https://example.com/new-avatar.jpg"
      }
    }

    const merged = mergePostUpdate(existingPost, normalizedUpdate)

    expect(merged.author.image).toBe("https://example.com/new-avatar.jpg") // Should use new image
  })

  it('should handle missing existing post gracefully', () => {
    const normalizedUpdate = {
      id: "123",
      content: "New content",
      createdAt: "2025-09-09T10:00:00Z",
      postType: "daily" as const,
      heartsCount: 0,
      isHearted: false,
      reactionsCount: 0,
      author: {
        id: "456",
        name: "Test User"
      }
    }

    const merged = mergePostUpdate(null, normalizedUpdate)

    expect(merged.content).toBe("New content")
    expect(merged.author.name).toBe("Test User")
  })
})