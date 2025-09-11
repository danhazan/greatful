/**
 * Integration tests for HTML stripping in both regular and batch notifications
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { mapBackendNotificationToFrontend } from '@/utils/notificationMapping'

describe('Notification HTML Stripping Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Regular Notifications', () => {
    it('should handle mention notifications without post content', () => {
      const backendNotification = {
        id: 'mention-1',
        type: 'mention',
        message: 'Bob3 mentioned you in a post',
        post_id: 'post-123',
        created_at: '2025-01-09T10:00:00Z',
        read: false,
        from_user: {
          id: 123,
          name: 'Bob3',
          username: 'bob3'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.message).toBe('Bob3 mentioned you in a post')
      expect(result.message).not.toContain(':')  // No colon since no post content
      expect(result.message).not.toContain('<span')
      expect(result.message).not.toContain('</span>')
      expect(result.message).not.toContain('class=')
    })

    it('should handle reaction notifications without post content', () => {
      const backendNotification = {
        id: 'reaction-1',
        type: 'emoji_reaction',
        message: 'Alice reacted to your post with 😍',
        post_id: 'post-456',
        created_at: '2025-01-09T10:00:00Z',
        read: false,
        from_user: {
          id: 456,
          name: 'Alice',
          username: 'alice'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.message).toBe('Alice reacted to your post with 😍')
      expect(result.message).not.toContain('<strong>')
      expect(result.message).not.toContain('</strong>')
      expect(result.message).not.toContain('<em>')
      expect(result.message).not.toContain('</em>')
    })

    it('should handle clean mention notifications without HTML artifacts', () => {
      const backendNotification = {
        id: 'bug-case-1',
        type: 'mention',
        message: 'Bob3 mentioned you in a post',
        post_id: 'post-bug',
        created_at: '2025-01-09T10:00:00Z',
        read: false,
        from_user: {
          id: 123,
          name: 'Bob3',
          username: 'bob3'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.message).toBe('Bob3 mentioned you in a post')
      expect(result.message).not.toContain('</spa')
      expect(result.message).not.toContain('......')
      expect(result.message).not.toContain(':')  // No colon since no post content
    })

    it('should handle clean mention notifications without style artifacts', () => {
      const backendNotification = {
        id: 'complex-html',
        type: 'mention',
        message: 'Bob3 mentioned you in a post',
        post_id: 'post-complex',
        created_at: '2025-01-09T10:00:00Z',
        read: false,
        from_user: {
          id: 123,
          name: 'Bob3',
          username: 'bob3'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.message).toBe('Bob3 mentioned you in a post')
      expect(result.message).not.toContain('<span')
      expect(result.message).not.toContain('style=')
      expect(result.message).not.toContain('text-decoration-line')
      expect(result.message).not.toContain(':')  // No colon since no post content
    })
  })

  describe('Batch Notifications', () => {
    it('should handle batch notification messages without post content', () => {
      const batchNotification = {
        id: 'batch-1',
        type: 'mention',
        message: '2 people mentioned you in posts',
        is_batch: true,
        batch_count: 2,
        created_at: '2025-01-09T10:00:00Z',
        read: false
      }

      const result = mapBackendNotificationToFrontend(batchNotification)

      expect(result.message).toBe('2 people mentioned you in posts')
      expect(result.message).not.toContain('<strong>')
      expect(result.message).not.toContain('</strong>')
      expect(result.message).not.toContain('<em>')
      expect(result.message).not.toContain('</em>')
      expect(result.message).not.toContain(':')  // No colon since no post content
      expect(result.isBatch).toBe(true)
    })

    it('should handle batch children notifications without post content', () => {
      const childNotifications = [
        {
          id: 'child-1',
          type: 'mention',
          message: 'Bob3 mentioned you in a post',
          parent_id: 'batch-1',
          created_at: '2025-01-09T10:00:00Z',
          read: false,
          from_user: {
            id: 123,
            name: 'Bob3',
            username: 'bob3'
          }
        },
        {
          id: 'child-2',
          type: 'mention',
          message: 'Alice mentioned you in a post',
          parent_id: 'batch-1',
          created_at: '2025-01-09T10:00:00Z',
          read: false,
          from_user: {
            id: 456,
            name: 'Alice',
            username: 'alice'
          }
        }
      ]

      const results = childNotifications.map(mapBackendNotificationToFrontend)

      expect(results[0].message).toBe('Bob3 mentioned you in a post')
      expect(results[0].message).not.toContain('<span')
      expect(results[0].message).not.toContain('class=')
      expect(results[0].message).not.toContain(':')  // No colon since no post content

      expect(results[1].message).toBe('Alice mentioned you in a post')
      expect(results[1].message).not.toContain('<strong>')
      expect(results[1].message).not.toContain('</strong>')
      expect(results[1].message).not.toContain(':')  // No colon since no post content
    })

    it('should handle batch notifications without post content', () => {
      const batchNotification = {
        id: 'mixed-batch',
        type: 'reaction',
        message: '3 people reacted to your post',
        is_batch: true,
        batch_count: 3,
        created_at: '2025-01-09T10:00:00Z',
        read: false
      }

      const result = mapBackendNotificationToFrontend(batchNotification)

      expect(result.message).toBe('3 people reacted to your post')
      expect(result.message).not.toContain('<em>')
      expect(result.message).not.toContain('</em>')
      expect(result.message).not.toContain('<span>')
      expect(result.message).not.toContain('</span>')
      expect(result.message).not.toContain(':')  // No colon since no post content
      expect(result.isBatch).toBe(true)
      expect(result.batchCount).toBe(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle clean notifications without HTML artifacts', () => {
      const backendNotification = {
        id: 'html-only',
        type: 'mention',
        message: 'TestUser mentioned you in a post',
        post_id: 'post-empty',
        created_at: '2025-01-09T10:00:00Z',
        read: false,
        from_user: {
          id: 999,
          name: 'TestUser',
          username: 'testuser'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.message).toBe('TestUser mentioned you in a post')
      expect(result.message).not.toContain('<span>')
      expect(result.message).not.toContain('<div>')
      expect(result.message).not.toContain(':')  // No colon since no post content
    })

    it('should handle clean notifications without malformed content', () => {
      const backendNotification = {
        id: 'malformed',
        type: 'mention',
        message: 'TestUser mentioned you in a post',
        post_id: 'post-malformed',
        created_at: '2025-01-09T10:00:00Z',
        read: false,
        from_user: {
          id: 888,
          name: 'TestUser',
          username: 'testuser'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      // Should be clean without any HTML
      expect(result.message).toBe('TestUser mentioned you in a post')
      expect(result.message).not.toContain('<span')
      expect(result.message).not.toContain('<div')
      expect(result.message).not.toContain(':')  // No colon since no post content
    })
  })
})