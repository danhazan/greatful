/**
 * Tests for notification message parser utilities
 */

import React from 'react'
import { parseNotificationMessage } from '@/utils/notificationMessageParser'
import { describe, it, expect } from '@jest/globals'

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
})