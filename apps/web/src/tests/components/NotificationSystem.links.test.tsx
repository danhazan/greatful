/**
 * Tests for NotificationSystem link functionality
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationSystem from '@/components/NotificationSystem'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('NotificationSystem Links', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    mockPush.mockClear()
  })

  it('should navigate to post page when clicking reaction notification', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'reaction',
        message: 'reacted to your post',
        postId: 'post-123',
        fromUser: {
          id: '2',
          name: 'User One',
          image: null
        },
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on reaction notification (click on message area, not username)
    const notification = screen.getByText('reacted to your post')
    fireEvent.click(notification)

    // Should navigate to post page
    expect(mockPush).toHaveBeenCalledWith('/post/post-123')
  })

  it('should navigate to user profile when clicking follow notification', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'new_follower',
        message: 'started following you',
        postId: null,
        data: { follower_id: 123 },
        fromUser: {
          id: '2',
          name: 'follower_user',
          image: null
        },
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on follow notification (clicking on the notification area, not the username)
    const notificationArea = screen.getByText('started following you')
    fireEvent.click(notificationArea)

    // Should navigate to user profile using follower_id from notification data
    expect(mockPush).toHaveBeenCalledWith('/profile/123')
  })

  it('should navigate to user profile when clicking username in follow notification', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'new_follower',
        message: 'started following you',
        postId: null,
        data: { follower_id: 123 },
        fromUser: {
          id: '2',
          name: 'follower_user',
          image: null
        },
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on the clickable username
    const usernameElement = screen.getByText('follower_user')
    fireEvent.click(usernameElement)

    // Should navigate to user profile using fromUser.id (clickable username behavior)
    expect(mockPush).toHaveBeenCalledWith('/profile/2')
  })

  it('should navigate to post page when clicking mention notification', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'mention',
        message: 'mentioned you in a post',
        postId: 'post-456',
        fromUser: {
          id: '2',
          name: 'mentioner_user',
          image: null
        },
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on mention notification (click on message area, not username)
    const notification = screen.getByText('mentioned you in a post')
    fireEvent.click(notification)

    // Should navigate to post page
    expect(mockPush).toHaveBeenCalledWith('/post/post-456')
  })

  it('should navigate to post page when clicking share notification', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'post_shared',
        message: 'shared your post',
        postId: 'post-789',
        fromUser: {
          id: '2',
          name: 'sharer_user',
          image: null
        },
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on share notification (click on message area, not username)
    const notification = screen.getByText('shared your post')
    fireEvent.click(notification)

    // Should navigate to post page
    expect(mockPush).toHaveBeenCalledWith('/post/post-789')
  })

  it('should not navigate for batch notifications, only expand/collapse', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'reaction',
        message: '3 people reacted to your post',
        postId: 'post-123',
        fromUser: null,
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: true,
        batchCount: 3,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    // Mock batch children fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on batch notification
    const batchNotification = screen.getByText('3 people reacted to your post')
    fireEvent.click(batchNotification)

    // Should not navigate
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should handle unknown notification types gracefully', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'unknown_type',
        message: 'some unknown notification',
        postId: null,
        fromUser: {
          id: '2',
          name: 'Unknown User',
          image: null
        },
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on unknown notification type (clicking on message area, not username)
    const messageArea = screen.getByText('some unknown notification')
    fireEvent.click(messageArea)

    // Should not navigate for unknown types when clicking message area
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should navigate to user profile when clicking username in any notification type', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'reaction',
        message: 'reacted to your post',
        postId: 'post-123',
        fromUser: {
          id: '2',
          name: 'Reactor User',
          image: null
        },
        createdAt: '2024-01-01T12:00:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null
      }
    ]

    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId={1} />)

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.any(Object))
    })

    // Open notifications dropdown
    const bellButton = screen.getByRole('button', { name: /Notifications/ })
    fireEvent.click(bellButton)

    // Click on the clickable username (should navigate to user profile)
    const usernameElement = screen.getByText('Reactor User')
    fireEvent.click(usernameElement)

    // Should navigate to user profile using shared navigation logic
    expect(mockPush).toHaveBeenCalledWith('/profile/2')
  })
})