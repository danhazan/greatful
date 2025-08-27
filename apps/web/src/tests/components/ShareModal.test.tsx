import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ShareModal from '@/components/ShareModal'

// Mock clipboard API
const mockWriteText = jest.fn(() => Promise.resolve())
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

// Mock window.isSecureContext
Object.defineProperty(window, 'isSecureContext', {
  value: true,
  writable: true,
})

// Mock fetch
global.fetch = jest.fn()

const mockPost = {
  id: 'test-post-1',
  content: 'This is a test gratitude post about being thankful for testing.',
  author: {
    id: 'user-1',
    name: 'Test User',
    image: 'https://example.com/avatar.jpg'
  }
}

describe('ShareModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset clipboard mock
    mockWriteText.mockResolvedValue()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
  })

  it('renders when open', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    expect(screen.getByText('Share Post')).toBeInTheDocument()
    expect(screen.getByText('Copy Link')).toBeInTheDocument()
    expect(screen.getByText('Send as Message')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <ShareModal
        isOpen={false}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    expect(screen.queryByText('Share Post')).not.toBeInTheDocument()
  })

  it('displays share options correctly', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    expect(screen.getByText('Copy Link')).toBeInTheDocument()
    expect(screen.getByText('Get shareable URL')).toBeInTheDocument()
    expect(screen.getByText('Send as Message')).toBeInTheDocument()
    expect(screen.getByText('Share with users')).toBeInTheDocument()
  })

  it('positions popup correctly', () => {
    const { container } = render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 200, y: 150 }}
      />
    )

    const popup = container.querySelector('.fixed.z-50')
    expect(popup).toBeInTheDocument()
    // The popup should be positioned with inline styles
    expect(popup).toHaveAttribute('style')
    const style = popup?.getAttribute('style')
    expect(style).toContain('left:')
    expect(style).toContain('top:')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    
    render(
      <ShareModal
        isOpen={true}
        onClose={onClose}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    fireEvent.click(screen.getByLabelText('Close share modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when escape key is pressed', () => {
    const onClose = jest.fn()
    
    render(
      <ShareModal
        isOpen={true}
        onClose={onClose}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('handles copy link functionality with decoupled clipboard and API', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'share-1',
        share_url: 'https://example.com/post/test-post-1'
      })
    } as Response)

    const onShare = jest.fn()

    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 100, y: 100 }}
        onShare={onShare}
      />
    )

    fireEvent.click(screen.getByText('Copy Link'))

    // Clipboard operation should happen immediately
    expect(mockWriteText).toHaveBeenCalledWith('http://localhost/post/test-post-1')

    // UI should update immediately without waiting for API
    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument()
    })

    // API call should happen in background (fire-and-forget)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/posts/test-post-1/share', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ share_method: 'url' })
      })
    })

    // onShare callback should eventually be called (with delay)
    await waitFor(() => {
      expect(onShare).toHaveBeenCalledWith('url', {
        shareUrl: 'http://localhost/post/test-post-1',
        shareId: 'share-1'
      })
    }, { timeout: 200 })
  })

  it('shows success state immediately after clipboard copy', async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    fireEvent.click(screen.getByText('Copy Link'))

    // Should show success state immediately after clipboard operation
    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument()
    })
    
    // Button should be disabled during success state
    expect(screen.getByRole('button', { name: /link copied/i })).toBeDisabled()
  })

  it('handles API errors gracefully without affecting clipboard UX', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    // Mock API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' })
    } as Response)

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    fireEvent.click(screen.getByText('Copy Link'))

    // Clipboard should work immediately regardless of API status
    expect(mockWriteText).toHaveBeenCalledWith('http://localhost/post/test-post-1')

    // UI should show success immediately
    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument()
    })

    // API error should be logged but not affect UX
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Share analytics failed:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })

  it('shows "Send as Message" as disabled with coming soon badge', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
        position={{ x: 100, y: 100 }}
      />
    )

    const messageButton = screen.getByText('Send as Message').closest('button')
    expect(messageButton).toBeDisabled()
    expect(screen.getByText('Soon')).toBeInTheDocument()
  })
})