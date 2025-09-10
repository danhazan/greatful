/**
 * Tests for HTML stripping in notification mapping
 */

import { describe, it, expect } from '@jest/globals'
import { mapBackendNotificationToFrontend } from '@/utils/notificationMapping'

describe('notificationMapping HTML stripping', () => {
  it('should strip HTML tags from notification messages', () => {
    const backendNotification = {
      id: 'test-123',
      type: 'mention',
      message: 'Bob3 mentioned you in a post: hi </spa......',
      post_id: 'post-456',
      created_at: '2025-01-09T10:00:00Z',
      read: false,
      from_user: {
        id: 123,
        name: 'Bob3',
        username: 'bob3',
        image: '/profile/bob3.jpg'
      }
    }

    const result = mapBackendNotificationToFrontend(backendNotification)

    expect(result.message).toBe('Bob3 mentioned you in a post: hi')
    expect(result.message).not.toContain('</')
    expect(result.message).not.toContain('</spa')
  })

  it('should strip complex HTML content from notification messages', () => {
    const backendNotification = {
      id: 'test-456',
      type: 'mention',
      message: 'Alice mentioned you in a post: Thanks <span class="mention" data-username="bob">@bob</span> for the <strong>amazing</strong> work!',
      post_id: 'post-789',
      created_at: '2025-01-09T10:00:00Z',
      read: false,
      from_user: {
        id: 456,
        name: 'Alice',
        username: 'alice',
        image: '/profile/alice.jpg'
      }
    }

    const result = mapBackendNotificationToFrontend(backendNotification)

    expect(result.message).toBe('Alice mentioned you in a post: Thanks @bob for the amazing work!')
    expect(result.message).not.toContain('<span')
    expect(result.message).not.toContain('<strong>')
    expect(result.message).not.toContain('</span>')
    expect(result.message).not.toContain('</strong>')
    expect(result.message).toContain('@bob')
    expect(result.message).toContain('amazing work')
  })

  it('should handle HTML entities in notification messages', () => {
    const backendNotification = {
      id: 'test-789',
      type: 'mention',
      message: 'Charlie mentioned you in a post: Check this &lt;code&gt; example &amp; &quot;quotes&quot;',
      post_id: 'post-123',
      created_at: '2025-01-09T10:00:00Z',
      read: false,
      from_user: {
        id: 789,
        name: 'Charlie',
        username: 'charlie'
      }
    }

    const result = mapBackendNotificationToFrontend(backendNotification)

    expect(result.message).toBe('Charlie mentioned you in a post: Check this <code> example & "quotes"')
    expect(result.message).not.toContain('&lt;')
    expect(result.message).not.toContain('&gt;')
    expect(result.message).not.toContain('&amp;')
    expect(result.message).not.toContain('&quot;')
    expect(result.message).toContain('<code>')
    expect(result.message).toContain('&')
    expect(result.message).toContain('"')
  })

  it('should handle empty or null messages gracefully', () => {
    const backendNotification1 = {
      id: 'test-empty',
      type: 'mention',
      message: '',
      post_id: 'post-empty',
      created_at: '2025-01-09T10:00:00Z',
      read: false
    }

    const backendNotification2 = {
      id: 'test-null',
      type: 'mention',
      message: null,
      post_id: 'post-null',
      created_at: '2025-01-09T10:00:00Z',
      read: false
    }

    const result1 = mapBackendNotificationToFrontend(backendNotification1)
    const result2 = mapBackendNotificationToFrontend(backendNotification2)

    expect(result1.message).toBe('')
    expect(result2.message).toBe('')
  })

  it('should preserve plain text messages without HTML', () => {
    const backendNotification = {
      id: 'test-plain',
      type: 'reaction',
      message: 'Dave reacted to your post',
      post_id: 'post-plain',
      created_at: '2025-01-09T10:00:00Z',
      read: false,
      from_user: {
        id: 999,
        name: 'Dave',
        username: 'dave'
      }
    }

    const result = mapBackendNotificationToFrontend(backendNotification)

    expect(result.message).toBe('Dave reacted to your post')
  })

  it('should handle the specific bug case from the image', () => {
    // This test case matches the exact issue shown in the image
    const backendNotification = {
      id: 'bug-case',
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

    // Should strip the HTML fragment and show clean text
    expect(result.message).toBe('Bob3 mentioned you in a post: hi')
    expect(result.message).not.toContain('</spa')
    expect(result.message).not.toContain('......')
  })
})