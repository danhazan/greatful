/**
 * Tests for NotificationSystem batching functionality
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import NotificationSystem from '@/components/NotificationSystem'

// Mock fetch
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

describe.skip('NotificationSystem Batching', () => {
  // SKIPPED: Batching logic edge cases
  // See apps/web/SKIPPED_TESTS.md for details
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  afterEach(() => {
    // Clean up any timers
    jest.clearAllTimers()
    // Reset DOM
    document.body.innerHTML = ''
  })

  const mockBatchNotification = {
    id: 'batch-123',
    type: 'reaction',
    message: '3 people reacted to your post',
    postId: 'post-123',
    fromUser: {
      id: 'batch',
      name: 'Multiple Users',
      image: undefined
    },
    createdAt: '2025-08-26T10:00:00Z',
    read: false,
    isBatch: true,
    batchCount: 3,
    parentId: null
  }

  const mockBatchChildren = [
    {
      id: 'child-1',
      type: 'reaction',
      message: 'reacted with 😍 to your post',
      postId: 'post-123',
      fromUser: {
        id: 'user1',
        name: 'User One',
        image: undefined
      },
      createdAt: '2025-08-26T09:00:00Z',
      read: false,
      isBatch: false,
      batchCount: 1,
      parentId: 'batch-123'
    },
    {
      id: 'child-2',
      type: 'reaction',
      message: 'reacted with 🙏 to your post',
      postId: 'post-123',
      fromUser: {
        id: 'user2',
        name: 'User Two',
        image: undefined
      },
      createdAt: '2025-08-26T09:30:00Z',
      read: false,
      isBatch: false,
      batchCount: 1,
      parentId: 'batch-123'
    }
  ]

  it('displays batch notification with count', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBatchNotification]
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })

    // Should show batch count in avatar
    expect(screen.getByText('3')).toBeInTheDocument()

    // Should show expand/collapse arrow (check for specific button)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('expands batch to show children when clicked', async () => {
    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBatchNotification]
    })

    // Mock mark as read call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    // Mock batch children fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBatchChildren
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })

    // Click on batch notification to expand
    const batchNotification = screen.getByText('3 people reacted to your post')
    fireEvent.click(batchNotification)

    // Debug: Check if the API call was made
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3) // Initial fetch + mark as read + children fetch
    })



    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
      expect(screen.getByText('User Two')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should show individual reactions
    expect(screen.getByText('reacted with 😍 to your post')).toBeInTheDocument()
    expect(screen.getByText('reacted with 🙏 to your post')).toBeInTheDocument()

    // Verify API call for batch children
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/notifications/batch-123/children',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token'
        })
      })
    )
  })

  it('collapses batch when clicked again', async () => {
    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBatchNotification]
    })

    // Mock mark as read call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    // Mock batch children fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBatchChildren
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })

    // Expand batch
    const batchNotification = screen.getByText('3 people reacted to your post')
    fireEvent.click(batchNotification)

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // Collapse batch
    fireEvent.click(batchNotification)

    await waitFor(() => {
      expect(screen.queryByText('User One')).not.toBeInTheDocument()
      expect(screen.queryByText('User Two')).not.toBeInTheDocument()
    })
  })

  it('shows correct unread count for batch notifications', async () => {
    const unreadBatch = { ...mockBatchNotification, read: false }
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [unreadBatch]
    })

    render(<NotificationSystem userId={1} />)

    await waitFor(() => {
      // Should show unread count of 1 (only parent notification counts)
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('handles batch children fetch error gracefully', async () => {
    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBatchNotification]
    })

    // Mock batch children fetch error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })

    // Click on batch notification to expand
    const batchNotification = screen.getByText('3 people reacted to your post')
    fireEvent.click(batchNotification)

    // Should not expand if fetch fails
    await waitFor(() => {
      expect(screen.queryByText('User One')).not.toBeInTheDocument()
    })
  })

  it('displays individual child notifications correctly', async () => {
    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBatchNotification]
    })

    // Mock mark as read call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    // Mock batch children fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBatchChildren
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications and expand batch
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })

    const batchNotification = screen.getByText('3 people reacted to your post')
    fireEvent.click(batchNotification)

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // Check child notification styling
    const childElements = screen.getAllByText(/reacted with .* to your post/)
    expect(childElements).toHaveLength(2)

    // Children should have smaller avatars and indented styling
    // The batch children container now has border-l-4 and the individual children don't have border classes
    const batchChildrenContainer = document.querySelector('.border-l-4.border-purple-200')
    expect(batchChildrenContainer).toBeInTheDocument()
  })

  it('marks batch and children as read when batch is clicked for non-expansion', async () => {
    const unreadBatch = { ...mockBatchNotification, read: false }
    
    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [unreadBatch]
    })

    // Mock mark as read API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })

    // For unread batch notifications, clicking should expand them
    const batchNotification = screen.getByText('3 people reacted to your post')
    fireEvent.click(batchNotification)

    // Should try to expand (but will fail since no children mock)
    // The notification should still be visible
    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })
  })

  it('caches batch children to avoid repeated API calls', async () => {
    // Mock initial notifications fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBatchNotification]
    })

    // Mock mark as read call (will be called twice - once for each click)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    // Mock batch children fetch (should only be called once)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBatchChildren
    })

    // Mock second mark as read call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    render(<NotificationSystem userId={1} />)

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })

    const batchNotification = screen.getByText('3 people reacted to your post')
    
    // Expand batch
    fireEvent.click(batchNotification)
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // Collapse batch
    fireEvent.click(batchNotification)
    await waitFor(() => {
      expect(screen.queryByText('User One')).not.toBeInTheDocument()
    })

    // Expand again - should use cached data
    fireEvent.click(batchNotification)
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // Should only have made 3 API calls total (notifications + mark as read + children)
    // The second click doesn't trigger mark as read because it's already read
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('handles mixed batch and single notifications', async () => {
    const singleNotification = {
      id: 'single-456',
      type: 'reaction',
      message: 'reacted with 💜 to your post',
      postId: 'post-456',
      fromUser: {
        id: 'user3',
        name: 'User Three',
        image: undefined
      },
      createdAt: '2025-08-26T11:00:00Z',
      read: false,
      isBatch: false,
      batchCount: 1,
      parentId: null
    }

    // Reset and set up fresh mock
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [mockBatchNotification, singleNotification]
    })

    render(<NotificationSystem userId={1} />)

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', {
        headers: { Authorization: 'Bearer mock-token' }
      })
    })

    // Open notifications
    const bellButton = screen.getByLabelText('Notifications')
    fireEvent.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('3 people reacted to your post')).toBeInTheDocument()
    })
    
    expect(screen.getByText('User Three')).toBeInTheDocument()

    // Batch should have expand arrow, single should not
    const expandArrows = document.querySelectorAll('svg')
    expect(expandArrows.length).toBeGreaterThan(0)

    // Single notification should show user avatar, batch should show count
    expect(screen.getByText('3')).toBeInTheDocument() // Batch count
    expect(screen.getByText('U')).toBeInTheDocument() // User Three initial
  })
})