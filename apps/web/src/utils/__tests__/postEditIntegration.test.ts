/**
 * Integration test for post edit functionality
 * Tests the complete flow: API response -> normalization -> UI update
 */

import { normalizePostFromApi } from '../normalizePost'

describe('Post Edit Integration', () => {
  it('should handle typical backend PUT response and show correct date', () => {
    // Simulate typical backend response from PUT /api/posts/:id
    const backendResponse = {
      id: "123",
      author_id: 456,
      content: "Updated content",
      post_type: "daily",
      created_at: "2025-09-09T10:00:00Z",
      updated_at: "2025-09-09T11:30:00Z", // Post was edited
      hearts_count: 5,
      is_hearted: false,
      reactions_count: 2,
      current_user_reaction: null,
      author: {
        id: 456,
        username: "testuser",
        display_name: "Test User",
        email: "test@example.com"
      }
    }

    const normalized = normalizePostFromApi(backendResponse)

    // Verify normalization worked correctly
    expect(normalized).not.toBeNull()
    expect(normalized!.createdAt).toBe("2025-09-09T10:00:00Z")
    expect(normalized!.updatedAt).toBe("2025-09-09T11:30:00Z")
    
    // Simulate the getDisplayDate logic from PostCard
    const dateToShow = normalized!.updatedAt || normalized!.createdAt
    const wasEdited = normalized!.updatedAt && normalized!.updatedAt !== normalized!.createdAt
    
    expect(dateToShow).toBe("2025-09-09T11:30:00Z") // Should show updated date
    expect(wasEdited).toBe(true) // Should indicate it was edited
    
    // Simulate formatDate logic (simplified)
    const mockFormatDate = (dateString: string) => {
      if (!dateString) return "Unknown date"
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Invalid date"
      return "1h ago" // Mock relative time
    }
    
    const displayText = mockFormatDate(dateToShow)
    const finalDisplay = wasEdited ? `${displayText} (edited)` : displayText
    
    expect(finalDisplay).toBe("1h ago (edited)")
  })

  it('should handle wrapped API response', () => {
    // Some API endpoints might wrap the response
    const wrappedResponse = {
      data: {
        id: "123",
        content: "Updated content",
        created_at: "2025-09-09T10:00:00Z",
        updated_at: "2025-09-09T11:30:00Z",
        post_type: "spontaneous",
        author: {
          id: 456,
          username: "testuser"
        }
      }
    }

    const normalized = normalizePostFromApi(wrappedResponse)
    
    expect(normalized).not.toBeNull()
    expect(normalized!.updatedAt).toBe("2025-09-09T11:30:00Z")
  })

  it('should handle post that was never edited', () => {
    const neverEditedResponse = {
      id: "123",
      content: "Original content",
      created_at: "2025-09-09T10:00:00Z",
      updated_at: null, // Never edited
      post_type: "photo",
      author: {
        id: 456,
        username: "testuser"
      }
    }

    const normalized = normalizePostFromApi(neverEditedResponse)
    
    expect(normalized).not.toBeNull()
    expect(normalized!.createdAt).toBe("2025-09-09T10:00:00Z")
    expect(normalized!.updatedAt).toBeUndefined()
    
    // Simulate getDisplayDate logic
    const dateToShow = normalized!.updatedAt || normalized!.createdAt
    const wasEdited = normalized!.updatedAt && normalized!.updatedAt !== normalized!.createdAt
    
    expect(dateToShow).toBe("2025-09-09T10:00:00Z") // Should show created date
    expect(wasEdited).toBeFalsy() // Should not indicate edited (undefined is falsy)
  })

  it('should handle missing date fields gracefully', () => {
    const malformedResponse = {
      id: "123",
      content: "Content",
      post_type: "daily",
      // Missing created_at and updated_at
      author: {
        id: 456,
        username: "testuser"
      }
    }

    const normalized = normalizePostFromApi(malformedResponse)
    
    expect(normalized).not.toBeNull()
    expect(normalized!.createdAt).toBeTruthy() // Should have a default
    expect(typeof normalized!.createdAt).toBe('string')
    
    // Should not crash when trying to display date
    const dateToShow = normalized!.updatedAt || normalized!.createdAt
    expect(dateToShow).toBeTruthy()
  })

  it('should preserve profile image when merging post updates', () => {
    // Simulate existing post with profile image
    const existingPost = {
      id: "123",
      content: "Original content",
      createdAt: "2025-09-09T10:00:00Z",
      author: {
        id: "456",
        name: "Test User",
        username: "testuser",
        image: "https://example.com/profile.jpg" // Existing profile image
      }
    }

    // Simulate backend PUT response without profile image
    const backendResponse = {
      id: "123",
      content: "Updated content",
      created_at: "2025-09-09T10:00:00Z",
      updated_at: "2025-09-09T11:30:00Z",
      post_type: "daily",
      author: {
        id: 456,
        username: "testuser",
        display_name: "Test User",
        email: "test@example.com"
        // Note: no profile_image_url in backend response
      }
    }

    const normalized = normalizePostFromApi(backendResponse)
    expect(normalized).not.toBeNull()

    // Simulate the merge that happens in PostCard
    const { mergePostUpdate } = require('../normalizePost')
    const merged = mergePostUpdate(existingPost, normalized!)

    // Content should be updated
    expect(merged.content).toBe("Updated content")
    expect(merged.updatedAt).toBe("2025-09-09T11:30:00Z")
    
    // Profile image should be preserved from existing post
    expect(merged.author.image).toBe("https://example.com/profile.jpg")
    expect(merged.author.name).toBe("Test User")
  })
})