/**
 * Test notification persistence across component remounts
 */

import { SmartNotificationPoller } from '@/utils/smartNotificationPoller'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

describe('SmartNotificationPoller - Notification Persistence', () => {
  let poller: SmartNotificationPoller

  beforeEach(() => {
    poller = new SmartNotificationPoller()
  })

  afterEach(() => {
    poller.stop()
  })

  it('should cache notification state after fetching', async () => {
    const mockNotifications = [
      { id: '1', type: 'like', message: 'User liked your post', read: false },
      { id: '2', type: 'comment', message: 'User commented', read: true }
    ]

    // Mock the fetch to return notifications
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockNotifications })
    })

    const callback = jest.fn()
    poller.onUpdate(callback)
    poller.start('123')

    // Wait for initial fetch
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify callback was called with notifications
    expect(callback).toHaveBeenCalled()
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    expect(lastCall.notifications).toHaveLength(2)
    expect(lastCall.unreadCount).toBe(1)

    // Verify state is cached
    const cachedState = poller.getCachedState()
    expect(cachedState).not.toBeNull()
    expect(cachedState?.notifications).toHaveLength(2)
    expect(cachedState?.unreadCount).toBe(1)
  })

  it('should restore cached state when restarting', async () => {
    const mockNotifications = [
      { id: '1', type: 'like', message: 'User liked your post', read: false }
    ]

    // Mock the fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockNotifications })
    })

    // First start - fetch notifications
    const callback1 = jest.fn()
    poller.onUpdate(callback1)
    poller.start('123')

    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify first fetch worked
    expect(callback1).toHaveBeenCalled()

    // Stop polling (simulating component unmount)
    poller.stop()

    // Clear the first callback
    callback1.mockClear()

    // Start again with new callback (simulating component remount)
    const callback2 = jest.fn()
    poller.onUpdate(callback2)
    poller.start('123')

    // Callback should be called immediately with cached state (synchronously)
    expect(callback2).toHaveBeenCalled()
    const firstCall = callback2.mock.calls[0][0]
    
    // Should have the cached notifications from the first fetch
    expect(firstCall.notifications.length).toBeGreaterThan(0)
    expect(firstCall.unreadCount).toBeGreaterThanOrEqual(0)
  })

  it('should keep cached state after stopping', () => {
    const mockState = {
      notifications: [{ id: '1', type: 'like', message: 'Test', read: false }],
      unreadCount: 1,
      timestamp: Date.now()
    }

    // Manually set cached state (simulating a previous fetch)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockState.notifications })
    })

    const callback = jest.fn()
    poller.onUpdate(callback)
    poller.start('123')

    // Wait for fetch
    setTimeout(() => {
      // Stop polling
      poller.stop()

      // Cached state should still be available
      const cachedState = poller.getCachedState()
      expect(cachedState).not.toBeNull()
    }, 100)
  })

  it('should return null for cached state when no notifications fetched yet', () => {
    const cachedState = poller.getCachedState()
    expect(cachedState).toBeNull()
  })
})
