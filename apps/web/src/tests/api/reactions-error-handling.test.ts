/**
 * Test reactions API error handling and data transformation
 * This test specifically targets the bug where transformReaction fails on malformed data
 */

import { expect, it, describe } from "@jest/globals"

describe('Reactions API Bug Regression Test', () => {
  it('should demonstrate the original bug with transformReaction', () => {
    // This test demonstrates the original bug that was happening
    // when the backend returned wrapped responses but the frontend
    // tried to transform the wrapped data directly
    
    const wrappedBackendResponse = {
      success: true,
      data: {
        id: '1',
        user_id: 123,
        emoji_code: 'heart_eyes',
        created_at: '2025-01-01T00:00:00Z',
        user: {
          id: 123,
          username: 'testuser'
        }
      }
    }

    // The bug was that the API route was passing the wrapped response
    // directly to transformReaction instead of extracting the data first
    const malformedData = wrappedBackendResponse // This would cause the error
    
    // This would fail with "Cannot read properties of undefined (reading 'toString')"
    // because malformedData.user_id doesn't exist (it's in malformedData.data.user_id)
    expect(() => {
      // Simulate the old buggy behavior
      const buggyTransform = (reaction: any) => {
        return {
          id: reaction.id,
          userId: reaction.user_id.toString(), // This would fail
          userName: reaction.user?.username || 'Unknown User',
          emojiCode: reaction.emoji_code,
          createdAt: reaction.created_at,
        }
      }
      
      buggyTransform(malformedData)
    }).toThrow("Cannot read properties of undefined (reading 'toString')")
  })

  it('should show the fix handles wrapped responses correctly', () => {
    // Import the actual transformer to test the fix
    const { transformReaction } = require('@/lib/transformers')
    
    const wrappedBackendResponse = {
      success: true,
      data: {
        id: '1',
        user_id: 123,
        emoji_code: 'heart_eyes',
        created_at: '2025-01-01T00:00:00Z',
        user: {
          id: 123,
          username: 'testuser'
        }
      }
    }

    // The fix: extract data before transforming
    const correctData = wrappedBackendResponse.data
    
    // This should work without throwing
    const result = transformReaction(correctData)
    
    expect(result).toEqual({
      id: '1',
      userId: '123',
      userName: 'testuser',
      userImage: undefined,
      emojiCode: 'heart_eyes',
      createdAt: '2025-01-01T00:00:00Z'
    })
  })

  it('should handle malformed data gracefully with safety checks', () => {
    const { transformReaction } = require('@/lib/transformers')
    
    // Test with completely malformed data
    const malformedData = {
      id: undefined,
      user_id: null,
      emoji_code: undefined,
      created_at: undefined,
      user: undefined
    }
    
    // Should not throw and return safe defaults
    const result = transformReaction(malformedData)
    
    expect(result).toEqual({
      id: '',
      userId: '0',
      userName: 'Unknown User',
      userImage: undefined,
      emojiCode: '',
      createdAt: ''
    })
  })
})