/**
 * Tests for notification message parser utilities
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { parseNotificationMessage, formatNotificationWithEnhancedData } from '@/utils/notificationMessageParser'
import { describe, it, expect, jest } from '@jest/globals'

// Mock getEmojiFromCode
jest.mock('@/generated/reactions', () => ({
  getEmojiFromCode: (code: string) => {
    const map: Record<string, string> = {
      heart_eyes: '😍',
      pray: '🙏',
      clap: '👏',
    }
    return map[code] || '👍'
  },
}))

// Mock ClickableUsername to render display name as plain text
jest.mock('@/components/ClickableUsername', () => {
  return function MockClickableUsername({ displayName }: { displayName?: string | null }) {
    return <span>{displayName || 'Unknown'}</span>
  }
})

describe('notificationMessageParser', () => {
  describe('parseNotificationMessage', () => {
    it('should return message as-is for batch notifications', () => {
      const message = '3 people reacted to your post'
      const result = parseNotificationMessage(message, undefined, true)

      expect(result).toBe(message)
    })

    it('should return message as-is when no fromUser provided', () => {
      const message = 'Some notification message'
      const result = parseNotificationMessage(message)

      expect(result).toBe(message)
    })

    it('should return message as-is when username not found in message', () => {
      const message = 'reacted to your post'
      const fromUser = { id: '123', name: 'John', username: 'john_doe' }
      const result = parseNotificationMessage(message, fromUser)

      expect(result).toBe(message)
    })
  })

  describe('formatNotificationWithEnhancedData', () => {
    const baseNotification = {
      id: 'n1',
      type: 'reaction' as const,
      postId: 'post-1',
      createdAt: '2024-01-01T00:00:00Z',
      read: false,
      isBatch: false,
      batchCount: 1,
      parentId: null,
      fromUser: {
        id: '123',
        name: 'John',
        username: 'john_doe',
      },
    }

    function renderNotification(overrides: Record<string, any>) {
      const notification = { ...baseNotification, ...overrides }
      const result = formatNotificationWithEnhancedData(notification as any)
      if (typeof result === 'string') return result
      const { container } = render(<>{result}</>)
      return container.textContent
    }

    it('should append emoji for post reaction with emojiCode', () => {
      const text = renderNotification({
        message: 'reacted to your post',
        data: { emojiCode: 'heart_eyes' },
      })
      expect(text).toContain('John')
      expect(text).toContain('reacted to your post with 😍')
    })

    it('should append emoji for comment reaction', () => {
      const text = renderNotification({
        message: 'reacted to your comment',
        data: { emojiCode: 'pray' },
      })
      expect(text).toContain('reacted to your comment with 🙏')
    })

    it('should append emoji for image reaction', () => {
      const text = renderNotification({
        message: 'reacted to an image in your post',
        data: { emojiCode: 'clap' },
      })
      expect(text).toContain('reacted to an image in your post with 👏')
    })

    it('should not double-append emoji for old notification records', () => {
      const text = renderNotification({
        message: 'reacted to your post with 😍',
        data: { emojiCode: 'heart_eyes' },
      })
      expect(text).toContain('reacted to your post with 😍')
      expect(text).not.toContain('with 😍 with 😍')
    })

    it('should use fallback emoji for unknown/retired codes', () => {
      const text = renderNotification({
        message: 'reacted to your post',
        data: { emojiCode: 'retired_code_xyz' },
      })
      expect(text).toContain('reacted to your post with 👍')
    })

    it('should not crash when emojiCode is missing', () => {
      const text = renderNotification({
        message: 'reacted to your post',
        data: {},
      })
      expect(text).toContain('reacted to your post')
      expect(text).not.toContain('with')
    })

    it('should not crash when data is missing entirely', () => {
      const text = renderNotification({
        message: 'reacted to your post',
      })
      expect(text).toContain('reacted to your post')
      expect(text).not.toContain('with')
    })

    it('should return message as-is for batch notifications', () => {
      const text = renderNotification({
        isBatch: true,
        batchCount: 3,
        message: '3 people reacted to your post',
        data: { emojiCode: 'heart_eyes' },
      })
      expect(text).toBe('3 people reacted to your post')
    })

    it('should handle old-style message with display name prefix', () => {
      const text = renderNotification({
        message: 'John reacted to your post with 😍',
        data: { emojiCode: 'heart_eyes' },
      })
      expect(text).toContain('John')
      expect(text).toContain('reacted to your post with 😍')
    })

    it('should handle comment reaction old-style message', () => {
      const text = renderNotification({
        message: 'John reacted to your comment with 🙏',
        data: { emojiCode: 'pray' },
      })
      expect(text).toContain('reacted to your comment with 🙏')
      expect(text).not.toContain('with 🙏 with')
    })
  })
})
