/**
 * Tests for the NotificationUserResolver - centralized username extraction.
 * Tests use camelCase (frontend contract) for data fields.
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
    it('should prioritize fromUser.username when available', () => {
      const notification = {
        fromUser: { username: 'from_user_name' },
        data: { reactorUsername: 'reactor_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('from_user_name')
    })

    it('should use reactorUsername when fromUser is not available', () => {
      const notification = {
        fromUser: null,
        data: { reactorUsername: 'reactor_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('reactor_name')
    })

    it('should use sharerUsername for share notifications', () => {
      const notification = {
        fromUser: null,
        data: { sharerUsername: 'sharer_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('sharer_name')
    })

    it('should use authorUsername for mention notifications', () => {
      const notification = {
        fromUser: null,
        data: { authorUsername: 'author_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('author_name')
    })

    it('should use likerUsername for like notifications', () => {
      const notification = {
        fromUser: null,
        data: { likerUsername: 'liker_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('liker_name')
    })

    it('should use followerUsername for follow notifications', () => {
      const notification = {
        fromUser: null,
        data: { followerUsername: 'follower_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('follower_name')
    })

    it('should use commenterUsername for comment notifications', () => {
      const notification = {
        fromUser: null,
        data: { commenterUsername: 'commenter_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('commenter_name')
    })

    it('should use username field', () => {
      const notification = {
        fromUser: null,
        data: { username: 'generic_username' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('generic_username')
    })

    it('should use username field', () => {
      const notification = {
        fromUser: null,
        data: { username: 'user_name_field' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('user_name_field')
    })

    it('should detect custom username fields ending with "username"', () => {
      const notification = {
        fromUser: null,
        data: { customFieldUsername: 'custom_name' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('custom_name')
    })

    it('should return Unknown User when no username is found', () => {
      const notification = {
        fromUser: null,
        data: { someOtherField: 'value' }
      }
      
      expect(extractNotificationUsername(notification)).toBe('Unknown User')
    })

    it('should return Unknown User when data is missing', () => {
      const notification = {}
      
      expect(extractNotificationUsername(notification)).toBe('Unknown User')
    })
  })

  describe('extractNotificationUserId', () => {
    it('should prioritize fromUser.id when available', () => {
      const notification = {
        fromUser: { id: '123' },
        data: { reactorUserId: '456' }
      }
      
      expect(extractNotificationUserId(notification)).toBe('123')
    })

    it('should use corresponding ID fields', () => {
      const notification = {
        fromUser: null,
        data: { reactorUserId: '789' }
      }
      
      expect(extractNotificationUserId(notification)).toBe('789')
    })

    it('should use userId field', () => {
      const notification = {
        fromUser: null,
        data: { userId: 'user_123' }
      }
      
      expect(extractNotificationUserId(notification)).toBe('user_123')
    })

    it('should handle string IDs', () => {
      const notification = {
        fromUser: null,
        data: { id: 'string_id_value' }
      }
      
      expect(extractNotificationUserId(notification)).toBe('string_id_value')
    })

    it('should fallback to username when no ID is available', () => {
      const notification = {
        fromUser: null,
        data: { username: 'fallback_user' }
      }
      
      expect(extractNotificationUserId(notification)).toBe('fallback_user')
    })

    it('should return unknown when no user info is available', () => {
      const notification = {}
      
      expect(extractNotificationUserId(notification)).toBe('unknown')
    })
  })

  describe('extractNotificationUserImage', () => {
    it('should extract profile image from fromUser', () => {
      const notification = {
        fromUser: { profileImageUrl: 'https://example.com/image.jpg' }
      }
      
      expect(extractNotificationUserImage(notification)).toBe('https://example.com/image.jpg')
    })

    it('should return undefined when no image is available', () => {
      const notification = {
        fromUser: {}
      }
      
      expect(extractNotificationUserImage(notification)).toBeUndefined()
    })

    it('should return undefined when fromUser has no profileImageUrl', () => {
      const notification = {
        fromUser: null
      }
      
      expect(extractNotificationUserImage(notification)).toBeUndefined()
    })
  })

  describe('resolveNotificationUser', () => {
    it('should create complete user object', () => {
      const notification = {
        fromUser: { id: '123', username: 'testuser', profileImageUrl: 'https://example.com/test.jpg' }
      }
      
      const result = resolveNotificationUser(notification)
      
      // When fromUser exists, it's returned as-is
      expect(result.id).toBe('123')
      expect(result.username).toBe('testuser')
      expect(result.profileImageUrl).toBe('https://example.com/test.jpg')
    })

    it('should work with data-only notifications', () => {
      const notification = {
        data: { reactorUsername: 'data_user', userId: '456' }
      }
      
      const result = resolveNotificationUser(notification)
      
      expect(result.username).toBe('data_user')
      expect(result.id).toBe('456')
    })
  })

  describe('validateNotificationUserData', () => {
    it('should validate notification with fromUser', () => {
      const notification = {
        fromUser: { username: 'valid_user' }
      }
      
      const result = validateNotificationUserData(notification)
      
      expect(result.isValid).toBe(true)
      expect(result.hasFromUser).toBe(true)
    })

    it('should validate notification with data username', () => {
      const notification = {
        data: { username: 'data_username' }
      }
      
      const result = validateNotificationUserData(notification)
      
      expect(result.isValid).toBe(true)
      expect(result.hasUsernameInData).toBe(true)
    })

    it('should identify invalid notification', () => {
      const notification = {
        data: { randomField: 'value' }
      }
      
      const result = validateNotificationUserData(notification)
      
      expect(result.isValid).toBe(false)
    })

    it('should identify missing data object', () => {
      const notification = {}
      
      const result = validateNotificationUserData(notification)
      
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('No username found in from_user or data fields')
    })
  })
})