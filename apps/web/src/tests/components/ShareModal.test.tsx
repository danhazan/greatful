import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ShareModal from '@/components/ShareModal'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
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
      />
    )

    expect(screen.queryByText('Share Post')).not.toBeInTheDocument()
  })

  it('displays post preview correctly', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
      />
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('This is a test gratitude post about being thankful for testing.')).toBeInTheDocument()
  })

  it('truncates long content in preview', () => {
    const longPost = {
      ...mockPost,
      content: 'This is a very long gratitude post that should be truncated because it exceeds the maximum length limit for the preview display in the share modal component.'
    }

    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={longPost}
      />
    )

    const previewText = screen.getByText(/This is a very long gratitude post/)
    expect(previewText.textContent).toContain('...')
    expect(previewText.textContent!.length).toBeLessThan(longPost.content.length)
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    
    render(
      <ShareModal
        isOpen={true}
        onClose={onClose}
        post={mockPost}
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
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('handles copy link functionality', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    const mockClipboard = navigator.clipboard.writeText as jest.MockedFunction<typeof navigator.clipboard.writeText>
    
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
        onShare={onShare}
      />
    )

    fireEvent.click(screen.getByText('Copy Link'))

    // Wait for API call and clipboard operation
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

    await waitFor(() => {
      expect(mockClipboard).toHaveBeenCalledWith('https://example.com/post/test-post-1')
    })

    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument()
    })

    expect(onShare).toHaveBeenCalledWith('url', {
      shareUrl: 'https://example.com/post/test-post-1',
      shareId: 'share-1'
    })
  })

  it('shows loading state during share operation', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    
    // Mock delayed API response
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'share-1', share_url: 'https://example.com/post/test-post-1' })
        } as Response), 100)
      )
    )

    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
      />
    )

    fireEvent.click(screen.getByText('Copy Link'))

    // Should show loading spinner
    expect(screen.getByRole('button', { name: /copy link/i })).toHaveClass('opacity-50', 'cursor-not-allowed')
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('Link Copied!')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    // Mock API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' })
    } as Response)

    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
      />
    )

    fireEvent.click(screen.getByText('Copy Link'))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to share post:', { error: 'Rate limit exceeded' })
    })

    consoleSpy.mockRestore()
  })

  it('shows "Send as Message" as disabled with coming soon badge', () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={jest.fn()}
        post={mockPost}
      />
    )

    const messageButton = screen.getByText('Send as Message').closest('button')
    expect(messageButton).toBeDisabled()
    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
  })
})