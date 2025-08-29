/**
 * Tests for the NotificationUserResolver - centralized username extraction.
 */

import {
  extractNotificationUsername,
  extractNotificationUserId,
  extractNotificationUserImage,
  resolveNotificationUser,
  validateNotificationUserData
} from '@/utils/notificationUserResolver'

describe('NotificationUserResolver', () => {
  describe('extractNotificationUsername', () => {
    it('should prioritize from_user.username when available', () => {
      const notification = {
        from_user: { username: 'from_user_name' },
        data: { reactor_username: 'reactor_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('from_user_name')
    })

    it('should use reactor_username when from_user is not available', () => {
      const notification = {
        from_user: null,
        data: { reactor_username: 'reactor_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('reactor_name')
    })

    it('should use sharer_username for share notifications', () => {
      const notification = {
        from_user: null,
        data: { sharer_username: 'sharer_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('sharer_name')
    })

    it('should use author_username for mention notifications', () => {
      const notification = {
        from_user: null,
        data: { author_username: 'author_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('author_name')
    })

    it('should use liker_username for like notifications', () => {
      const notification = {
        from_user: null,
        data: { liker_username: 'liker_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('liker_name')
    })

    it('should use follower_username for follow notifications', () => {
      const notification = {
        from_user: null,
        data: { follower_username: 'follower_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('follower_name')
    })

    it('should use commenter_username for comment notifications', () => {
      const notification = {
        from_user: null,
        data: { commenter_username: 'commenter_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('commenter_name')
    })

    it('should use generic username fields', () => {
      const notification = {
        from_user: null,
        data: { sender_username: 'sender_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('sender_name')
    })

    it('should use username field', () => {
      const notification = {
        from_user: null,
        data: { username: 'generic_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('generic_name')
    })

    it('should use user_name field', () => {
      const notification = {
        from_user: null,
        data: { user_name: 'user_name_field' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('user_name_field')
    })

    it('should detect custom username fields ending with "username"', () => {
      const notification = {
        from_user: null,
        data: { custom_field_username: 'custom_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('custom_name')
    })

    it('should return Unknown User when no username is found', () => {
      const notification = {
        from_user: null,
        data: { some_other_field: 'value' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('Unknown User')
    })

    it('should return Unknown User when data is missing', () => {
      const notification = {
        from_user: null
      }
      
      expect(extractNotificationUsername(notification)).toBe('Unknown User')
    })

    it('should prioritize type-specific fields over generic fields', () => {
      const notification = {
        from_user: null,
        data: {
          reactor_username: 'reactor_name',
          username: 'generic_name'
        }
      }
      
      expect(extractNotificationUsername(notification)).toBe('reactor_name')
    })

    it('should handle empty string usernames', () => {
      const notification = {
        from_user: null,
        data: { reactor_username: '' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('Unknown User')
    })

    it('should handle non-string username values', () => {
      const notification = {
        from_user: null,
        data: { reactor_username: 123 }
      }
      
      expect(extractNotificationUsername(notification)).toBe('Unknown User')
    })
  })

  describe('extractNotificationUserId', () => {
    it('should prioritize from_user.id when available', () => {
      const notification = {
        from_user: { id: 123 },
        data: { reactor_username: 'reactor_name' }
      }
      
      expect(extractNotificationUserId(notification)).toBe('123')
    })

    it('should use corresponding ID fields', () => {
      const notification = {
        from_user: null,
        data: { reactor_id: 456 }
      }
      
      expect(extractNotificationUserId(notification)).toBe('456')
    })

    it('should use user_id field', () => {
      const notification = {
        from_user: null,
        data: { user_id: 789 }
      }
      
      expect(extractNotificationUserId(notification)).toBe('789')
    })

    it('should fallback to username when no ID is available', () => {
      const notification = {
        from_user: null,
        data: { reactor_username: 'reactor_name' }
      }
      
      expect(extractNotificationUserId(notification)).toBe('reactor_name')
    })

    it('should return unknown when no user info is available', () => {
      const notification = {
        from_user: null,
        data: {}
      }
      
      expect(extractNotificationUserId(notification)).toBe('unknown')
    })

    it('should handle string IDs', () => {
      const notification = {
        from_user: { id: 'string-id-123' },
        data: {}
      }
      
      expect(extractNotificationUserId(notification)).toBe('string-id-123')
    })
  })

  describe('extractNotificationUserImage', () => {
    it('should extract profile image from from_user', () => {
      const notification = {
        from_user: { profile_image_url: 'https://example.com/image.jpg' },
        data: {}
      }
      
      expect(extractNotificationUserImage(notification)).toBe('https://example.com/image.jpg')
    })

    it('should return undefined when no image is available', () => {
      const notification = {
        from_user: null,
        data: {}
      }
      
      expect(extractNotificationUserImage(notification)).toBeUndefined()
    })

    it('should return undefined when from_user has no profile_image_url', () => {
      const notification = {
        from_user: { username: 'test_user' },
        data: {}
      }
      
      expect(extractNotificationUserImage(notification)).toBeUndefined()
    })
  })

  describe('resolveNotificationUser', () => {
    it('should create complete user object', () => {
      const notification = {
        from_user: {
          id: 123,
          username: 'test_user',
          profile_image_url: 'https://example.com/image.jpg'
        },
        data: {}
      }
      
      const result = resolveNotificationUser(notification)
      
      expect(result).toEqual({
        id: '123',
        name: 'test_user',
        image: 'https://example.com/image.jpg'
      })
    })

    it('should work with data-only notifications', () => {
      const notification = {
        from_user: null,
        data: { reactor_username: 'reactor_user' }
      }
      
      const result = resolveNotificationUser(notification)
      
      expect(result).toEqual({
        id: 'reactor_user',
        name: 'reactor_user',
        image: undefined
      })
    })
  })

  describe('validateNotificationUserData', () => {
    it('should validate notification with from_user', () => {
      const notification = {
        from_user: { username: 'test_user' },
        data: {}
      }
      
      const result = validateNotificationUserData(notification)
      
      expect(result.isValid).toBe(true)
      expect(result.hasFromUser).toBe(true)
      expect(result.hasUsernameInData).toBe(true)
      expect(result.detectedUsername).toBe('test_user')
      expect(result.issues).toHaveLength(0)
    })

    it('should validate notification with data username', () => {
      const notification = {
        from_user: null,
        data: { reactor_username: 'reactor_user' }
      }
      
      const result = validateNotificationUserData(notification)
      
      expect(result.isValid).toBe(true)
      expect(result.hasFromUser).toBe(false)
      expect(result.hasUsernameInData).toBe(true)
      expect(result.detectedUsername).toBe('reactor_user')
      expect(result.issues).toHaveLength(0)
    })

    it('should identify invalid notification', () => {
      const notification = {
        from_user: null,
        data: {}
      }
      
      const result = validateNotificationUserData(notification)
      
      expect(result.isValid).toBe(false)
      expect(result.hasFromUser).toBe(false)
      expect(result.hasUsernameInData).toBe(false)
      expect(result.detectedUsername).toBe('Unknown User')
      expect(result.issues).toContain('No username found in from_user or data fields')
      expect(result.issues).toContain('Username resolved to "Unknown User" - check notification data structure')
    })

    it('should identify missing data object', () => {
      const notification = {
        from_user: null
      }
      
      const result = validateNotificationUserData(notification)
      
      expect(result.issues).toContain('No data object found in notification')
    })
  })
})