/**
 * Test reaction transformer functions for error handling
 */

import { transformReaction, transformReactions, type BackendReaction } from '@/lib/transformers'

describe('Reaction Transformers', () => {
  describe('transformReaction', () => {
    it('should transform valid reaction data correctly', () => {
      const backendReaction: BackendReaction = {
        id: '1',
        user_id: 123,
        emoji_code: 'heart_eyes',
        created_at: '2025-01-01T00:00:00Z',
        user: {
          id: 123,
          username: 'testuser',
          profile_image_url: 'https://example.com/avatar.jpg'
        }
      }

      const result = transformReaction(backendReaction)

      expect(result).toEqual({
        id: '1',
        userId: '123',
        userName: 'testuser',
        userImage: 'https://example.com/avatar.jpg',
        emojiCode: 'heart_eyes',
        createdAt: '2025-01-01T00:00:00Z'
      })
    })

    it('should handle missing user_id gracefully', () => {
      const backendReaction: BackendReaction = {
        id: '1',
        user_id: undefined as any, // Simulate missing user_id
        emoji_code: 'heart_eyes',
        created_at: '2025-01-01T00:00:00Z',
        user: {
          id: 123,
          username: 'testuser'
        }
      }

      const result = transformReaction(backendReaction)

      expect(result.userId).toBe('0')
      expect(result.userName).toBe('testuser')
    })

    it('should handle missing user object gracefully', () => {
      const backendReaction: BackendReaction = {
        id: '1',
        user_id: 123,
        emoji_code: 'heart_eyes',
        created_at: '2025-01-01T00:00:00Z',
        user: undefined // Simulate missing user object
      }

      const result = transformReaction(backendReaction)

      expect(result.userId).toBe('123')
      expect(result.userName).toBe('Unknown User')
      expect(result.userImage).toBeUndefined()
    })

    it('should handle null user_id gracefully', () => {
      const backendReaction: BackendReaction = {
        id: '1',
        user_id: null as any, // Simulate null user_id
        emoji_code: 'heart_eyes',
        created_at: '2025-01-01T00:00:00Z',
        user: {
          id: 123,
          username: 'testuser'
        }
      }

      const result = transformReaction(backendReaction)

      expect(result.userId).toBe('0')
      expect(result.userName).toBe('testuser')
    })

    it('should handle missing emoji_code gracefully', () => {
      const backendReaction: BackendReaction = {
        id: '1',
        user_id: 123,
        emoji_code: undefined as any, // Simulate missing emoji_code
        created_at: '2025-01-01T00:00:00Z',
        user: {
          id: 123,
          username: 'testuser'
        }
      }

      const result = transformReaction(backendReaction)

      expect(result.emojiCode).toBe('')
      expect(result.userId).toBe('123')
    })

    it('should handle missing created_at gracefully', () => {
      const backendReaction: BackendReaction = {
        id: '1',
        user_id: 123,
        emoji_code: 'heart_eyes',
        created_at: undefined as any, // Simulate missing created_at
        user: {
          id: 123,
          username: 'testuser'
        }
      }

      const result = transformReaction(backendReaction)

      expect(result.createdAt).toBe('')
      expect(result.userId).toBe('123')
    })

    it('should handle completely malformed data', () => {
      const backendReaction: BackendReaction = {
        id: undefined as any,
        user_id: undefined as any,
        emoji_code: undefined as any,
        created_at: undefined as any,
        user: undefined
      }

      const result = transformReaction(backendReaction)

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

  describe('transformReactions', () => {
    it('should transform array of reactions correctly', () => {
      const backendReactions: BackendReaction[] = [
        {
          id: '1',
          user_id: 123,
          emoji_code: 'heart_eyes',
          created_at: '2025-01-01T00:00:00Z',
          user: {
            id: 123,
            username: 'user1'
          }
        },
        {
          id: '2',
          user_id: 456,
          emoji_code: 'pray',
          created_at: '2025-01-01T01:00:00Z',
          user: {
            id: 456,
            username: 'user2'
          }
        }
      ]

      const result = transformReactions(backendReactions)

      expect(result).toHaveLength(2)
      expect(result[0].userId).toBe('123')
      expect(result[1].userId).toBe('456')
    })

    it('should handle non-array input gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      const result = transformReactions(null as any)

      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('transformReactions: reactions is not an array:', null)
      
      consoleSpy.mockRestore()
    })

    it('should handle undefined input gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      const result = transformReactions(undefined as any)

      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('transformReactions: reactions is not an array:', undefined)
      
      consoleSpy.mockRestore()
    })

    it('should handle empty array correctly', () => {
      const result = transformReactions([])

      expect(result).toEqual([])
    })

    it('should handle array with malformed items', () => {
      const backendReactions: BackendReaction[] = [
        {
          id: '1',
          user_id: 123,
          emoji_code: 'heart_eyes',
          created_at: '2025-01-01T00:00:00Z',
          user: {
            id: 123,
            username: 'user1'
          }
        },
        {
          id: '2',
          user_id: undefined as any, // Malformed item
          emoji_code: 'pray',
          created_at: '2025-01-01T01:00:00Z',
          user: undefined
        }
      ]

      const result = transformReactions(backendReactions)

      expect(result).toHaveLength(2)
      expect(result[0].userId).toBe('123')
      expect(result[1].userId).toBe('0') // Should handle malformed data gracefully
      expect(result[1].userName).toBe('Unknown User')
    })
  })
})