/**
 * Tests for NotificationSystem time display functionality
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import NotificationSystem from '@/components/NotificationSystem'

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock fetch
global.fetch = jest.fn()

describe('NotificationSystem Time Display', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should display different relative times for notifications with different timestamps', async () => {
    const now = new Date('2025-08-26T18:00:00.000Z')
    jest.setSystemTime(now)

    const mockNotifications = [
      {
        id: '1',
        type: 'reaction',
        message: 'User1 reacted to your post',
        post_id: 'post1',
        from_user: { id: '1', username: 'user1' },
        created_at: '2025-08-26T17:00:00.000Z', // 1 hour ago
        read: false,
        is_batch: false
      },
      {
        id: '2',
        type: 'reaction',
        message: 'User2 reacted to your post',
        post_id: 'post2',
        from_user: { id: '2', username: 'user2' },
        created_at: '2025-08-26T17:30:00.000Z', // 30 minutes ago
        read: false,
        is_batch: false
      },
      {
        id: '3',
        type: 'reaction',
        message: 'User3 reacted to your post',
        post_id: 'post3',
        from_user: { id: '3', username: 'user3' },
        created_at: '2025-08-26T17:59:00.000Z', // 1 minute ago
        read: false,
        is_batch: false
      }
    ]

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    const { container } = render(<NotificationSystem userId={1} />)

    // Wait for component to mount and fetch data
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    act(() => {
      bellButton.click()
    })

    // Check that different times are displayed
    expect(screen.getByText('1h ago')).toBeInTheDocument()
    expect(screen.getByText('30m ago')).toBeInTheDocument()
    expect(screen.getByText('1m ago')).toBeInTheDocument()
  }, 10000)

  it('should update relative times when time passes', async () => {
    const now = new Date('2025-08-26T18:00:00.000Z')
    jest.setSystemTime(now)

    const mockNotifications = [
      {
        id: '1',
        type: 'reaction',
        message: 'User1 reacted to your post',
        post_id: 'post1',
        from_user: { id: '1', username: 'user1' },
        created_at: '2025-08-26T17:59:00.000Z', // 1 minute ago initially
        read: false,
        is_batch: false
      }
    ]

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    act(() => {
      bellButton.click()
    })

    // Wait for notifications to load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Initially should show "1m ago"
    expect(screen.getByText('1m ago')).toBeInTheDocument()

    // Advance time by 2 minutes
    act(() => {
      jest.advanceTimersByTime(2 * 60 * 1000) // 2 minutes
    })

    // Should now show "3m ago"
    expect(screen.getByText('3m ago')).toBeInTheDocument()
    expect(screen.queryByText('1m ago')).not.toBeInTheDocument()
  })

  it('should handle "Just now" for very recent notifications', async () => {
    const now = new Date('2025-08-26T18:00:00.000Z')
    jest.setSystemTime(now)

    const mockNotifications = [
      {
        id: '1',
        type: 'reaction',
        message: 'User1 reacted to your post',
        post_id: 'post1',
        from_user: { id: '1', username: 'user1' },
        created_at: '2025-08-26T17:59:30.000Z', // 30 seconds ago
        read: false,
        is_batch: false
      }
    ]

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    act(() => {
      bellButton.click()
    })

    // Wait for notifications to load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Should show "Just now" for notifications less than 1 minute old
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })
})