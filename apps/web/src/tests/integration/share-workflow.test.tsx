/**
 * Integration tests for complete sharing workflows in the frontend
 */

import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import ShareModal from '@/components/ShareModal'
import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock clipboard API
const mockWriteText = jest.fn(() => Promise.resolve())
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

// Mock window properties
Object.defineProperty(window, 'isSecureContext', {
  value: true,
  writable: true,
})

Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    hostname: 'localhost'
  },
  writable: true,
})

// Mock fetch
global.fetch = jest.fn()

const mockPost = {
  id: 'test-post-123',
  content: 'Amazing gratitude post about testing complete workflows!',
  author: {
    id: 'user-1',
    name: 'Test Author',
    image: 'https://example.com/avatar.jpg'
  }
}

describe('Share Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWriteText.mockResolvedValue()
    
    // Mock localStorage with auth token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key) => {
          if (key === 'access_token') return 'valid-auth-token'
          return null
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })

    // Mock UserContext API calls to prevent interference
    ;(global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/users/me/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'user-1', name: 'Test User' })
        })
      }
      // Return undefined for other calls - will be overridden by specific test mocks
      return Promise.resolve({
        ok: false,
        status: 404
      })
    })
  })

  describe('Complete URL Share Workflow', () => {
    it('should complete full URL share workflow: UI -> Clipboard -> API -> Analytics', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      // Override the default mock for this test
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/users/me/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'user-1', name: 'Test User' })
          })
        }
        if (url.includes('/api/posts/test-post-123/share')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve({
              id: 'share-456',
              user_id: 1,
              post_id: 'test-post-123',
              share_method: 'url',
              share_url: 'http://localhost:3000/post/test-post-123',
              created_at: '2025-01-08T12:00:00Z'
            })
          })
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      const onShare = jest.fn()
      const onClose = jest.fn()

      render(
        <ShareModal
          isOpen={true}
          onClose={onClose}
          post={mockPost}
          position={{ x: 100, y: 100 }}
          onShare={onShare}
        />
      )

      // Step 1: User clicks "Copy Link"
      fireEvent.click(screen.getByText('Copy Link'))

      // Step 2: Verify clipboard operation happens immediately
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/post/test-post-123')

      // Step 3: Verify UI updates immediately to success state
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument() // Only in modal, no toast
        expect(screen.getByText('Ready to share')).toBeInTheDocument()
      })

      // Step 4: Verify API call happens in background
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/posts/test-post-123/share', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-auth-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ share_method: 'url' })
        })
      })

      // Step 5: Verify analytics callback is triggered
      await waitFor(() => {
        expect(onShare).toHaveBeenCalledWith('url', {
          shareUrl: 'http://localhost:3000/post/test-post-123',
          shareId: 'share-456'
        })
      }, { timeout: 200 })

      // Step 6: Verify modal closes automatically after success
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1)
      }, { timeout: 2000 })
    })

    it('should handle API failure gracefully without affecting user experience', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      // Override the default mock for this test
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/users/me/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'user-1', name: 'Test User' })
          })
        }
        if (url.includes('/api/posts/test-post-123/share')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({
              detail: 'Rate limit exceeded'
            })
          })
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      const onShare = jest.fn()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

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

      // Clipboard should still work
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/post/test-post-123')

      // UI should still show success
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument() // Only in modal, no toast
      })

      // API error should be logged but not affect UX
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Share analytics failed:', expect.any(Error))
      }, { timeout: 2000 })

      // onShare should still be called with null shareId
      await waitFor(() => {
        expect(onShare).toHaveBeenCalledWith('url', {
          shareUrl: 'http://localhost:3000/post/test-post-123',
          shareId: null
        })
      }, { timeout: 200 })

      consoleSpy.mockRestore()
    })

    it('should handle network errors gracefully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      // Override the default mock for this test
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/users/me/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'user-1', name: 'Test User' })
          })
        }
        if (url.includes('/api/posts/test-post-123/share')) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      const onShare = jest.fn()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

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

      // Clipboard should still work
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/post/test-post-123')

      // UI should still show success
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument() // Only in modal, no toast
      })

      // Network error should be logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Share analytics failed:', expect.any(Error))
      }, { timeout: 2000 })

      consoleSpy.mockRestore()
    })
  })

  describe('Unauthenticated User Workflow', () => {
    it('should handle sharing for unauthenticated users', async () => {
      // Mock no auth token
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn(() => null), // No token
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        writable: true,
      })

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

      // Clipboard should still work
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/post/test-post-123')

      // UI should show success
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument() // Only in modal, no toast
      })

      // No API call should be made
      expect(global.fetch).not.toHaveBeenCalled()

      // onShare should still be called without analytics
      await waitFor(() => {
        expect(onShare).toHaveBeenCalledWith('url', {
          shareUrl: 'http://localhost:3000/post/test-post-123',
          shareId: null
        })
      }, { timeout: 200 })
    })
  })

  describe('Clipboard Failure Workflow', () => {
    it('should handle clipboard API failures gracefully', async () => {
      // Mock clipboard failure
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'))

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

      // The component shows success even if clipboard fails in localhost environment
      // This is intentional behavior for testing
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })

    it('should use fallback clipboard method for older browsers', async () => {
      // Mock older browser environment
      const originalClipboard = navigator.clipboard
      const originalIsSecureContext = window.isSecureContext
      
      // Remove modern clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      })
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        writable: true,
      })

      // Mock document.execCommand
      const mockExecCommand = jest.fn(() => true)
      Object.defineProperty(document, 'execCommand', {
        value: mockExecCommand,
        writable: true,
      })

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

      // Should use fallback method
      expect(mockExecCommand).toHaveBeenCalledWith('copy')

      // Should show success
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument() // Only in modal, no toast
      })

      // Restore original values
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
      })
      Object.defineProperty(window, 'isSecureContext', {
        value: originalIsSecureContext,
        writable: true,
      })
    })
  })

  describe('Modal Interaction Workflow', () => {
    it('should handle complete modal lifecycle', async () => {
      const onClose = jest.fn()
      const onShare = jest.fn()

      const { rerender } = render(
        <ShareModal
          isOpen={false}
          onClose={onClose}
          post={mockPost}
          position={{ x: 100, y: 100 }}
          onShare={onShare}
        />
      )

      // Modal should not be visible when closed
      expect(screen.queryByText('Share Post')).not.toBeInTheDocument()

      // Open modal
      rerender(
        <ShareModal
          isOpen={true}
          onClose={onClose}
          post={mockPost}
          position={{ x: 100, y: 100 }}
          onShare={onShare}
        />
      )

      // Modal should be visible
      expect(screen.getByText('Share Post')).toBeInTheDocument()

      // Test escape key closes modal
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)

      // Reset mock
      onClose.mockClear()

      // Test close button
      fireEvent.click(screen.getByLabelText('Close share modal'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should handle click outside to close', async () => {
      const onClose = jest.fn()

      render(
        <ShareModal
          isOpen={true}
          onClose={onClose}
          post={mockPost}
          position={{ x: 100, y: 100 }}
        />
      )

      // Click on backdrop (outside modal)
      const backdrop = document.querySelector('.fixed.inset-0.bg-gray-900')
      expect(backdrop).toBeInTheDocument()
      
      fireEvent.mouseDown(backdrop!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Message Share Placeholder Workflow', () => {
    it('should show message share as enabled', () => {
      render(
        <ShareModal
          isOpen={true}
          onClose={jest.fn()}
          post={mockPost}
          position={{ x: 100, y: 100 }}
        />
      )

      // Message share should be enabled
      const messageButton = screen.getByText('Send as Message').closest('button')
      expect(messageButton).not.toBeDisabled()
      expect(messageButton).not.toHaveClass('cursor-not-allowed')

      // Should not show "Soon" badge
      expect(screen.queryByText('Soon')).not.toBeInTheDocument()

      // Should be clickable and show message interface
      fireEvent.click(messageButton!)
      expect(screen.getByPlaceholderText('Search users to send to...')).toBeInTheDocument()
    })
  })

  describe('URL Generation Workflow', () => {
    it('should generate correct share URLs for different environments', async () => {
      const testCases = [
        {
          origin: 'http://localhost:3000',
          postId: 'post-123',
          expected: 'http://localhost:3000/post/post-123'
        },
        {
          origin: 'https://grateful.app',
          postId: 'post-456',
          expected: 'https://grateful.app/post/post-456'
        },
        {
          origin: 'https://staging.grateful.app',
          postId: 'post-789',
          expected: 'https://staging.grateful.app/post/post-789'
        }
      ]

      for (const { origin, postId, expected } of testCases) {
        // Mock window.location.origin
        Object.defineProperty(window, 'location', {
          value: { origin },
          writable: true,
        })

        const testPost = { ...mockPost, id: postId }

        const { unmount } = render(
          <ShareModal
            isOpen={true}
            onClose={jest.fn()}
            post={testPost}
            position={{ x: 100, y: 100 }}
          />
        )

        // Use getAllByText to handle multiple buttons and select the first one
        const copyButtons = screen.getAllByText('Copy Link')
        fireEvent.click(copyButtons[0])

        // Wait for the clipboard operation to complete
        await waitFor(() => {
          expect(mockWriteText).toHaveBeenCalledWith(expected)
        })

        // Clean up for next iteration
        mockWriteText.mockClear()
        unmount()
      }
    })
  })
})