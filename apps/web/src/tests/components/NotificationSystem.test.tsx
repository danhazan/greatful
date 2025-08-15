import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationSystem from '@/components/NotificationSystem'

// Mock fetch
global.fetch = jest.fn()

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('NotificationSystem', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('test-token')
    ;(fetch as jest.Mock).mockClear()
  })

  const mockNotifications = [
    {
      id: '1',
      type: 'reaction',
      message: 'reacted to your post',
      postId: 'post-1',
      fromUser: {
        id: '2',
        name: 'John Doe',
        image: 'https://example.com/john.jpg'
      },
      createdAt: '2025-01-08T12:00:00Z',
      read: false
    },
    {
      id: '2',
      type: 'comment',
      message: 'commented on your post',
      postId: 'post-2',
      fromUser: {
        id: '3',
        name: 'Jane Smith'
      },
      createdAt: '2025-01-08T11:00:00Z',
      read: true
    }
  ]

  it.skip('renders notification bell with unread count', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications
    })

    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument() // Unread count
    })
  })

  it.skip('shows notifications dropdown when bell is clicked', async () => {
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
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
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

  it.skip('marks notification as read when clicked', async () => {
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
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    const unreadNotification = screen.getByText('John Doe').closest('div')!
    await user.click(unreadNotification)

    expect(fetch).toHaveBeenCalledWith('/api/notifications/1/read', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
  })

  it.skip('marks all notifications as read', async () => {
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
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    const markAllReadButton = screen.getByText('Mark all read')
    await user.click(markAllReadButton)

    expect(fetch).toHaveBeenCalledWith('/api/notifications/read-all', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
  })

  it.skip('displays correct notification icons', async () => {
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

    // Should have heart icon for reaction and message circle for comment
    const heartIcons = document.querySelectorAll('.lucide-heart')
    const messageIcons = document.querySelectorAll('.lucide-message-circle')
    
    expect(heartIcons.length).toBeGreaterThan(0)
    expect(messageIcons.length).toBeGreaterThan(0)
  })

  it.skip('shows user avatars with fallback to initials', async () => {
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

  it.skip('handles API errors gracefully', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<NotificationSystem userId="1" />)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch notifications:', expect.any(Error))
    })

    consoleSpy.mockRestore()
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

  it.skip('formats time correctly', async () => {
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
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    })

    const bellButton = screen.getByLabelText('Notifications')
    await user.click(bellButton)

    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })
})