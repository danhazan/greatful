/**
 * Tests for notification link utility functions
 */

import { 
  generateNotificationLink, 
  handleNotificationClick, 
  getUserProfileLink, 
  getPostLink 
} from '@/utils/notificationLinks'

describe('notificationLinks utilities', () => {
  describe('generateNotificationLink', () => {
    it('should generate post link for reaction notifications', () => {
      const notification = {
        type: 'reaction',
        postId: 'post-123',
        fromUser: { id: '1', name: 'user1' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'post',
        url: '/post/post-123',
        shouldCloseDropdown: true
      })
    })

    it('should generate post link for emoji_reaction notifications', () => {
      const notification = {
        type: 'emoji_reaction',
        postId: 'post-456',
        fromUser: { id: '1', name: 'user1' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'post',
        url: '/post/post-456',
        shouldCloseDropdown: true
      })
    })

    it('should generate post link for mention notifications', () => {
      const notification = {
        type: 'mention',
        postId: 'post-789',
        fromUser: { id: '1', name: 'user1' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'post',
        url: '/post/post-789',
        shouldCloseDropdown: true
      })
    })

    it('should generate post link for share notifications', () => {
      const notification = {
        type: 'post_shared',
        postId: 'post-abc',
        fromUser: { id: '1', name: 'user1' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'post',
        url: '/post/post-abc',
        shouldCloseDropdown: true
      })
    })

    it('should generate post link for comment_on_post notifications', () => {
      const notification = {
        type: 'comment_on_post',
        postId: 'post-comment-123',
        fromUser: { id: '1', name: 'commenter' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'post',
        url: '/post/post-comment-123',
        shouldCloseDropdown: true
      })
    })

    it('should generate post link for comment_reply notifications', () => {
      const notification = {
        type: 'comment_reply',
        postId: 'post-reply-456',
        fromUser: { id: '1', name: 'replier' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'post',
        url: '/post/post-reply-456',
        shouldCloseDropdown: true
      })
    })

    it('should generate user profile link for follow notifications using follower_id', () => {
      const notification = {
        type: 'new_follower',
        postId: undefined,
        data: { follower_id: 123 },
        fromUser: { id: '1', name: 'follower_user' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'user',
        url: '/profile/123',
        shouldCloseDropdown: true
      })
    })

    it('should generate user profile link for follow notifications (follow type)', () => {
      const notification = {
        type: 'follow',
        postId: undefined,
        data: { follower_id: 456 },
        fromUser: { id: '1', name: 'another_user' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'user',
        url: '/profile/456',
        shouldCloseDropdown: true
      })
    })

    it('should fallback to fromUser.id for follow notifications without follower_id', () => {
      const notification = {
        type: 'follow',
        postId: undefined,
        fromUser: { id: '789', name: 'follower_user' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toEqual({
        type: 'user',
        url: '/profile/789',
        shouldCloseDropdown: true
      })
    })

    it('should return null for batch notifications', () => {
      const notification = {
        type: 'reaction',
        postId: 'post-123',
        fromUser: { id: '1', name: 'user1' },
        isBatch: true
      }

      const result = generateNotificationLink(notification)

      expect(result).toBeNull()
    })

    it('should return null for unknown notification types', () => {
      const notification = {
        type: 'unknown_type',
        postId: 'post-123',
        fromUser: { id: '1', name: 'user1' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toBeNull()
    })

    it('should return null for post notifications without postId', () => {
      const notification = {
        type: 'reaction',
        postId: undefined,
        fromUser: { id: '1', name: 'user1' },
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toBeNull()
    })

    it('should return null for follow notifications without fromUser', () => {
      const notification = {
        type: 'new_follower',
        postId: undefined,
        fromUser: undefined,
        isBatch: false
      }

      const result = generateNotificationLink(notification)

      expect(result).toBeNull()
    })
  })

  describe('handleNotificationClick', () => {
    let mockCallbacks: {
      markAsRead: jest.Mock
      toggleBatchExpansion: jest.Mock
      navigate: jest.Mock
      closeDropdown: jest.Mock
    }

    beforeEach(() => {
      mockCallbacks = {
        markAsRead: jest.fn(),
        toggleBatchExpansion: jest.fn(),
        navigate: jest.fn(),
        closeDropdown: jest.fn()
      }
    })

    it('should mark unread notification as read', () => {
      const notification = {
        id: '1',
        type: 'reaction',
        postId: 'post-123',
        fromUser: { id: '2', name: 'user2' },
        isBatch: false,
        read: false
      }

      handleNotificationClick(notification, mockCallbacks)

      expect(mockCallbacks.markAsRead).toHaveBeenCalledWith('1')
    })

    it('should not mark read notification as read again', () => {
      const notification = {
        id: '1',
        type: 'reaction',
        postId: 'post-123',
        fromUser: { id: '2', name: 'user2' },
        isBatch: false,
        read: true
      }

      handleNotificationClick(notification, mockCallbacks)

      expect(mockCallbacks.markAsRead).not.toHaveBeenCalled()
    })

    it('should navigate and close dropdown for post notifications', () => {
      const notification = {
        id: '1',
        type: 'reaction',
        postId: 'post-123',
        fromUser: { id: '2', name: 'user2' },
        isBatch: false,
        read: true
      }

      handleNotificationClick(notification, mockCallbacks)

      expect(mockCallbacks.navigate).toHaveBeenCalledWith('/post/post-123')
      expect(mockCallbacks.closeDropdown).toHaveBeenCalled()
    })

    it('should navigate and close dropdown for user notifications', () => {
      const notification = {
        id: '1',
        type: 'new_follower',
        postId: undefined,
        fromUser: { id: '2', name: 'follower_user' },
        isBatch: false,
        read: true
      }

      handleNotificationClick(notification, mockCallbacks)

      expect(mockCallbacks.navigate).toHaveBeenCalledWith('/profile/2')
      expect(mockCallbacks.closeDropdown).toHaveBeenCalled()
    })

    it('should only toggle batch expansion for batch notifications', () => {
      const notification = {
        id: '1',
        type: 'reaction',
        postId: 'post-123',
        fromUser: { id: '2', name: 'user2' },
        isBatch: true,
        read: false
      }

      handleNotificationClick(notification, mockCallbacks)

      expect(mockCallbacks.markAsRead).toHaveBeenCalledWith('1')
      expect(mockCallbacks.toggleBatchExpansion).toHaveBeenCalledWith('1')
      expect(mockCallbacks.navigate).not.toHaveBeenCalled()
      expect(mockCallbacks.closeDropdown).not.toHaveBeenCalled()
    })

    it('should not navigate for unknown notification types', () => {
      const notification = {
        id: '1',
        type: 'unknown_type',
        postId: 'post-123',
        fromUser: { id: '2', name: 'user2' },
        isBatch: false,
        read: true
      }

      handleNotificationClick(notification, mockCallbacks)

      expect(mockCallbacks.navigate).not.toHaveBeenCalled()
      expect(mockCallbacks.closeDropdown).not.toHaveBeenCalled()
    })
  })

  describe('getUserProfileLink', () => {
    it('should generate correct user profile link', () => {
      expect(getUserProfileLink('testuser')).toBe('/profile/testuser')
      expect(getUserProfileLink('another_user')).toBe('/profile/another_user')
    })
  })

  describe('getPostLink', () => {
    it('should generate correct post link', () => {
      expect(getPostLink('post-123')).toBe('/post/post-123')
      expect(getPostLink('abc-def-ghi')).toBe('/post/abc-def-ghi')
    })
  })
})