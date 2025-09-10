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
    it('should strip HTML from mention notifications', () => {
      const backendNotification = {
        id: 'mention-1',
        type: 'mention',
        message: 'Bob3 mentioned you in a post: hi <span class="mention" data-username="test">@test</span>',
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

      expect(result.message).toBe('Bob3 mentioned you in a post: hi @test')
      expect(result.message).not.toContain('<span')
      expect(result.message).not.toContain('</span>')
      expect(result.message).not.toContain('class=')
    })

    it('should strip HTML from reaction notifications', () => {
      const backendNotification = {
        id: 'reaction-1',
        type: 'emoji_reaction',
        message: 'Alice reacted to your post: <strong>Amazing</strong> work with <em>formatting</em>!',
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

      expect(result.message).toBe('Alice reacted to your post: Amazing work with formatting!')
      expect(result.message).not.toContain('<strong>')
      expect(result.message).not.toContain('</strong>')
      expect(result.message).not.toContain('<em>')
      expect(result.message).not.toContain('</em>')
    })

    it('should handle the specific bug case from the image', () => {
      const backendNotification = {
        id: 'bug-case-1',
        type: 'mention',
        message: 'Bob3 mentioned you in a post: hi </spa......',
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

      expect(result.message).toBe('Bob3 mentioned you in a post: hi')
      expect(result.message).not.toContain('</spa')
      expect(result.message).not.toContain('......')
    })

    it('should handle complex HTML with style attributes', () => {
      const backendNotification = {
        id: 'complex-html',
        type: 'mention',
        message: 'Bob3 mentioned you in a post: <span style="text-decoration-line: underline; fo......',
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

      expect(result.message).toBe('Bob3 mentioned you in a post:')
      expect(result.message).not.toContain('<span')
      expect(result.message).not.toContain('style=')
      expect(result.message).not.toContain('text-decoration-line')
    })
  })

  describe('Batch Notifications', () => {
    it('should strip HTML from batch notification messages', () => {
      const batchNotification = {
        id: 'batch-1',
        type: 'mention',
        message: 'You were mentioned in 2 posts: <strong>First</strong> post and <em>second</em> post',
        is_batch: true,
        batch_count: 2,
        created_at: '2025-01-09T10:00:00Z',
        read: false
      }

      const result = mapBackendNotificationToFrontend(batchNotification)

      expect(result.message).toBe('You were mentioned in 2 posts: First post and second post')
      expect(result.message).not.toContain('<strong>')
      expect(result.message).not.toContain('</strong>')
      expect(result.message).not.toContain('<em>')
      expect(result.message).not.toContain('</em>')
      expect(result.isBatch).toBe(true)
    })

    it('should strip HTML from batch children notifications', () => {
      const childNotifications = [
        {
          id: 'child-1',
          type: 'mention',
          message: 'Bob3 mentioned you in a post: <span class="mention">@user</span> hello',
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
          message: 'Alice mentioned you in a post: <strong>Great</strong> work!',
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

      expect(results[0].message).toBe('Bob3 mentioned you in a post: @user hello')
      expect(results[0].message).not.toContain('<span')
      expect(results[0].message).not.toContain('class=')

      expect(results[1].message).toBe('Alice mentioned you in a post: Great work!')
      expect(results[1].message).not.toContain('<strong>')
      expect(results[1].message).not.toContain('</strong>')
    })

    it('should handle batch notifications with mixed HTML content', () => {
      const batchNotification = {
        id: 'mixed-batch',
        type: 'reaction',
        message: '3 people reacted to your post: <em>Amazing</em> content with <span>mentions</span>',
        is_batch: true,
        batch_count: 3,
        created_at: '2025-01-09T10:00:00Z',
        read: false
      }

      const result = mapBackendNotificationToFrontend(batchNotification)

      expect(result.message).toBe('3 people reacted to your post: Amazing content with mentions')
      expect(result.message).not.toContain('<em>')
      expect(result.message).not.toContain('</em>')
      expect(result.message).not.toContain('<span>')
      expect(result.message).not.toContain('</span>')
      expect(result.isBatch).toBe(true)
      expect(result.batchCount).toBe(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle notifications with only HTML tags (no text content)', () => {
      const backendNotification = {
        id: 'html-only',
        type: 'mention',
        message: 'User mentioned you: <span></span><div></div>',
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

      expect(result.message).toBe('User mentioned you:')
      expect(result.message).not.toContain('<span>')
      expect(result.message).not.toContain('<div>')
    })

    it('should handle malformed HTML gracefully', () => {
      const backendNotification = {
        id: 'malformed',
        type: 'mention',
        message: 'User mentioned you: <span>malformed HTML<div unclosed',
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

      // Should strip malformed HTML and return clean text
      expect(result.message).toBe('User mentioned you: malformed HTML')
      expect(result.message).not.toContain('<span')
      expect(result.message).not.toContain('<div')
    })
  })
})