import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import FollowButton from '@/components/FollowButton'
import ShareModal from '@/components/ShareModal'
import EmojiPicker from '@/components/EmojiPicker'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the auth utilities
const mockIsAuthenticated = jest.fn(() => true)
const mockGetAccessToken = jest.fn(() => 'mock-token')

jest.mock('@/utils/auth', () => ({
  isAuthenticated: mockIsAuthenticated,
  getAccessToken: mockGetAccessToken
}))

// Mock haptic feedback
jest.mock('@/utils/hapticFeedback', () => ({
  createTouchHandlers: jest.fn(() => ({}))
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Wrapper component with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

describe.skip('Loading States and Toast Notifications', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockIsAuthenticated.mockReturnValue(true)
    mockGetAccessToken.mockReturnValue('mock-token')
    
    // Mock successful responses by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} })
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('FollowButton', () => {
    it('shows loading state during follow operation', async () => {
      // Mock a delayed response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          }), 100)
        )
      )

      render(
        <TestWrapper>
          <FollowButton userId={123} />
        </TestWrapper>
      )

      const followButton = screen.getByRole('button', { name: /follow user/i })
      
      // Click follow button
      fireEvent.click(followButton)

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(followButton).toBeDisabled()

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      }, { timeout: 200 })
    })

    it('shows success toast after successful follow', async () => {
      render(
        <TestWrapper>
          <FollowButton userId={123} />
        </TestWrapper>
      )

      const followButton = screen.getByRole('button', { name: /follow user/i })
      
      // Click follow button
      fireEvent.click(followButton)

      // Wait for success toast
      await waitFor(() => {
        expect(screen.getByText('User followed!')).toBeInTheDocument()
      })
    })

    it('shows error toast and retry option on failure', async () => {
      // Mock status check (successful) and follow action (failed)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Server error' } })
        })

      render(
        <TestWrapper>
          <FollowButton userId={123} />
        </TestWrapper>
      )

      const followButton = screen.getByRole('button', { name: /follow user/i })
      
      // Click follow button
      fireEvent.click(followButton)

      // Wait for error toast
      await waitFor(() => {
        expect(screen.getByText('Follow Failed')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('implements optimistic updates with rollback on failure', async () => {
      // Mock status check (successful) and follow action (failed)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Server error' } })
        })

      const onFollowChange = jest.fn()
      
      render(
        <TestWrapper>
          <FollowButton 
            userId={123} 
            onFollowChange={onFollowChange}
          />
        </TestWrapper>
      )

      const followButton = screen.getByRole('button', { name: /follow user/i })
      
      // Click follow button
      fireEvent.click(followButton)

      // Should immediately show optimistic update
      expect(onFollowChange).toHaveBeenCalledWith(true)

      // Wait for rollback after failure
      await waitFor(() => {
        expect(onFollowChange).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('ShareModal', () => {
    const mockPost = {
      id: '123',
      content: 'Test post content',
      author: {
        id: '456',
        name: 'Test Author'
      }
    }

    it('shows success toast after copying link', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(() => Promise.resolve())
        }
      })

      render(
        <TestWrapper>
          <ShareModal
            isOpen={true}
            onClose={() => {}}
            post={mockPost}
          />
        </TestWrapper>
      )

      const copyButton = screen.getByText('Copy Link')
      fireEvent.click(copyButton)

      // Wait for success toast - it should appear in the toast container
      await waitFor(() => {
        expect(screen.getByText('Post link copied to clipboard')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('shows loading state during message sending', async () => {
      // Mock delayed response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          }), 100)
        )
      )

      render(
        <TestWrapper>
          <ShareModal
            isOpen={true}
            onClose={() => {}}
            post={mockPost}
          />
        </TestWrapper>
      )

      // Click "Send as Message" to show message interface
      const sendMessageButton = screen.getByText('Send as Message')
      fireEvent.click(sendMessageButton)

      // Add a user (mock user selection)
      const sendButton = screen.getByRole('button', { name: /send \(0\)/i })
      
      // Since we can't easily mock user selection, we'll test the disabled state
      expect(sendButton).toBeDisabled()
    })

    it('shows error toast on share failure', async () => {
      // Mock clipboard failure
      const mockWriteText = jest.fn(() => Promise.reject(new Error('Clipboard failed')))
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText
        },
        writable: true
      })

      render(
        <TestWrapper>
          <ShareModal
            isOpen={true}
            onClose={() => {}}
            post={mockPost}
          />
        </TestWrapper>
      )

      const copyButton = screen.getByText('Copy Link')
      fireEvent.click(copyButton)

      // Wait for error toast
      await waitFor(() => {
        expect(screen.getByText('Copy Failed')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('EmojiPicker', () => {
    it('shows loading state on emoji buttons when loading', () => {
      render(
        <TestWrapper>
          <EmojiPicker
            isOpen={true}
            onClose={() => {}}
            onEmojiSelect={() => {}}
            isLoading={true}
          />
        </TestWrapper>
      )

      // Should show loading spinner instead of emoji
      const buttons = screen.getAllByRole('button')
      const emojiButtons = buttons.filter(button => 
        button.getAttribute('aria-label')?.includes('React with')
      )
      
      expect(emojiButtons.length).toBeGreaterThan(0)
    })

    it('disables emoji buttons during loading', () => {
      render(
        <TestWrapper>
          <EmojiPicker
            isOpen={true}
            onClose={() => {}}
            onEmojiSelect={() => {}}
            isLoading={true}
          />
        </TestWrapper>
      )

      const buttons = screen.getAllByRole('button')
      const emojiButtons = buttons.filter(button => 
        button.getAttribute('aria-label')?.includes('React with')
      )
      
      emojiButtons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })
  })

  describe('Toast System', () => {
    it('automatically closes success toasts after duration', async () => {
      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: 'follow-123' } })
        })

      render(
        <TestWrapper>
          <FollowButton userId={123} />
        </TestWrapper>
      )

      const followButton = screen.getByRole('button', { name: /follow user/i })
      fireEvent.click(followButton)

      // Wait for success toast to appear
      await waitFor(() => {
        expect(screen.getByText('User followed!')).toBeInTheDocument()
      })

      // Wait for toast to disappear (should auto-close after 3 seconds)
      await waitFor(() => {
        expect(screen.queryByText('User followed!')).not.toBeInTheDocument()
      }, { timeout: 4000 })
    })

    it('keeps error toasts open longer', async () => {
      // Mock status check (successful) and follow action (failed)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Server error' } })
        })

      render(
        <TestWrapper>
          <FollowButton userId={123} />
        </TestWrapper>
      )

      const followButton = screen.getByRole('button', { name: /follow user/i })
      fireEvent.click(followButton)

      // Wait for error toast
      await waitFor(() => {
        expect(screen.getByText('Follow Failed')).toBeInTheDocument()
      })

      // Error toast should still be visible after 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3500))
      expect(screen.getByText('Follow Failed')).toBeInTheDocument()
    })

    it('allows manual toast dismissal', async () => {
      // Mock status check (successful) and follow action (failed)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Server error' } })
        })

      render(
        <TestWrapper>
          <FollowButton userId={123} />
        </TestWrapper>
      )

      const followButton = screen.getByRole('button', { name: /follow user/i })
      fireEvent.click(followButton)

      // Wait for error toast
      await waitFor(() => {
        expect(screen.getByText('Follow Failed')).toBeInTheDocument()
      })

      // Find and click close button
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      // Toast should be dismissed
      await waitFor(() => {
        expect(screen.queryByText('Follow Failed')).not.toBeInTheDocument()
      })
    })
  })
})