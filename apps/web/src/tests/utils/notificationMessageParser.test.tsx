/**
 * Tests for notification message parser utilities
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { parseNotificationMessage, formatNotificationWithClickableUser } from '@/utils/notificationMessageParser'
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { describe } from '@jest/globals'
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
import { describe } from '@jest/globals'
import { beforeEach } from '@jest/globals'
import { describe } from '@jest/globals'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('notificationMessageParser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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

    it('should make username clickable when found in message', () => {
      const message = 'John reacted to your post'
      const fromUser = { id: '123', name: 'John', username: 'john_doe' }
      
      const TestComponent = () => (
        <div>{parseNotificationMessage(message, fromUser)}</div>
      )
      
      render(<TestComponent />)
      
      // Should have clickable username
      const usernameElement = screen.getByText('John')
      expect(usernameElement).toBeInTheDocument()
      expect(usernameElement).toHaveAttribute('role', 'button')
      
      // Should have the rest of the message
      expect(screen.getByText('reacted to your post')).toBeInTheDocument()
    })

    it('should handle multiple occurrences of username in message', () => {
      const message = 'John mentioned John in a post'
      const fromUser = { id: '123', name: 'John', username: 'john_doe' }
      
      const TestComponent = () => (
        <div>{parseNotificationMessage(message, fromUser)}</div>
      )
      
      render(<TestComponent />)
      
      // Should have two clickable username elements
      const usernameElements = screen.getAllByText('John')
      expect(usernameElements).toHaveLength(2)
      
      usernameElements.forEach(element => {
        expect(element).toHaveAttribute('role', 'button')
      })
    })
  })

  describe('formatNotificationWithClickableUser', () => {
    it('should format notification with clickable username at the beginning', () => {
      const action = 'started following you'
      const fromUser = { id: '456', name: 'Alice', username: 'alice_smith' }
      
      const TestComponent = () => (
        <div>{formatNotificationWithClickableUser(action, fromUser)}</div>
      )
      
      render(<TestComponent />)
      
      // Should have clickable username
      const usernameElement = screen.getByText('Alice')
      expect(usernameElement).toBeInTheDocument()
      expect(usernameElement).toHaveAttribute('role', 'button')
      
      // Should have the action text
      expect(screen.getByText('started following you')).toBeInTheDocument()
    })

    it('should navigate to user profile when username is clicked', () => {
      const action = 'reacted to your post'
      const fromUser = { id: '789', name: 'Bob', username: 'bob_wilson' }
      
      const TestComponent = () => (
        <div>{formatNotificationWithClickableUser(action, fromUser)}</div>
      )
      
      render(<TestComponent />)
      
      const usernameElement = screen.getByText('Bob')
      fireEvent.click(usernameElement)
      
      expect(mockPush).toHaveBeenCalledWith('/profile/789')
    })

    it('should apply proper styling to clickable username', () => {
      const action = 'shared your post'
      const fromUser = { id: '101', name: 'Charlie', username: 'charlie_davis' }
      
      const TestComponent = () => (
        <div>{formatNotificationWithClickableUser(action, fromUser)}</div>
      )
      
      render(<TestComponent />)
      
      const usernameElement = screen.getByText('Charlie')
      expect(usernameElement).toHaveClass('font-medium', 'text-purple-600', 'hover:text-purple-700', 'cursor-pointer', 'transition-colors')
    })

    it('should have proper accessibility attributes', () => {
      const action = 'mentioned you'
      const fromUser = { id: '202', name: 'Diana', username: 'diana_prince' }
      
      const TestComponent = () => (
        <div>{formatNotificationWithClickableUser(action, fromUser)}</div>
      )
      
      render(<TestComponent />)
      
      const usernameElement = screen.getByText('Diana')
      expect(usernameElement).toHaveAttribute('aria-label', "View Diana's profile")
      expect(usernameElement).toHaveAttribute('tabIndex', '0')
    })
  })
})