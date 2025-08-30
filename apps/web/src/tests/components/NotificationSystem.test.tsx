import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationSystem from '@/components/NotificationSystem'
import { 
  setupTestEnvironment, 
  cleanupTestEnvironment,
  createTestNotification,
  suppressActWarnings
} from '../utils/test-helpers'

describe('NotificationSystem', () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    suppressActWarnings()
  })

  afterEach(() => {
    cleanupTestEnvironment()
  })

  const mockNotifications = [
    createTestNotification({
      id: '1',
      fromUser: { id: '2', name: 'John Doe', image: 'https://example.com/john.jpg' },
      createdAt: '2025-01-08T12:00:00Z',
      isRead: false
    }),
    createTestNotification({
      id: '2',
      type: 'comment',
      message: 'commented on your post',
      postId: 'post-2',
      fromUser: { id: '3', name: 'Jane Smith' },
      createdAt: '2025-01-08T11:00:00Z',
      isRead: true
    })
  ]

  it('renders notification bell with unread count', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      // The aria-label includes the unread count
      expect(screen.getByLabelText('Notifications (2 unread)')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Unread count badge
    })
  })

  it('shows notifications dropdown when bell is clicked', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText(/Notifications/)
    await user.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  it('displays empty state when no notifications', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    expect(screen.getByText('You\'ll see reactions and comments here')).toBeInTheDocument()
  })

  it('marks notification as read when clicked', async () => {
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText(/Notifications/)
    await user.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const unreadNotification = screen.getByText('John Doe').closest('[role="listitem"]')!
    await user.click(unreadNotification)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/notifications/1/read', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })
    })
  })

  it('marks all notifications as read', async () => {
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText(/Notifications/)
    await user.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })

    const markAllReadButton = screen.getByText('Mark all read')
    await user.click(markAllReadButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })
    })
  })

  it('displays correct notification content', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    // Should display notification messages
    expect(screen.getByText('reacted to your post')).toBeInTheDocument()
    expect(screen.getByText('commented on your post')).toBeInTheDocument()
    
    // Should display user names
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('shows user avatars with fallback to initials', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    // John has an image
    expect(screen.getByAltText('John Doe')).toBeInTheDocument()
    
    // Jane doesn't have an image, should show initial
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    expect(screen.getByText('Notifications')).toBeInTheDocument()

    // Click outside
    const backdrop = document.querySelector('.fixed.inset-0')!
    await user.click(backdrop)

    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument()
  })

  it('closes dropdown when X button is clicked', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    const closeButton = document.querySelector('.lucide-x')?.closest('button')!
    await user.click(closeButton)

    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    // Set NODE_ENV to development to enable error logging
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
    
    render(<NotificationSystem userId="1" />)

    // Wait for the component to attempt to fetch notifications and handle the error
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch notifications:', expect.any(Error))
    }, { timeout: 3000 })

    consoleSpy.mockRestore()
    process.env.NODE_ENV = originalEnv
  })

  it('does not show unread badge when count is 0', async () => {
    const readNotifications = mockNotifications.map(n => ({ ...n, read: true }))
    
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => readNotifications
    })

    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    // Should not show unread count badge
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('formats time correctly', async () => {
    const recentNotification = {
      ...mockNotifications[0],
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [recentNotification]
    })

    const user = userEvent.setup()
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText(/Notifications/)
    await user.click(bellButton)

    await waitFor(() => {
      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })
  })
})