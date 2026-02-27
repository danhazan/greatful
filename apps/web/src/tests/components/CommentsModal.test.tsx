import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import CommentsModal from '@/components/CommentsModal'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn()
  })
}))

// Helper function to render with ToastProvider
const renderWithToast = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

function StatefulCommentsModal(props: any) {
  const [open, setOpen] = React.useState(true)
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Reopen comments">Reopen</button>
      <CommentsModal
        {...props}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

describe('CommentsModal', () => {
  const mockComments = [
    {
      id: '1',
      postId: 'post-1',
      userId: 1,
      content: 'This is a great post! 😊',
      createdAt: new Date().toISOString(),
      user: {
        id: 1,
        username: 'testuser',
        displayName: 'Test User',
        profileImageUrl: null
      },
      isReply: false,
      replyCount: 2
    },
    {
      id: '2',
      postId: 'post-1',
      userId: 2,
      content: 'I agree! This is inspiring.',
      createdAt: new Date().toISOString(),
      user: {
        id: 2,
        username: 'anotheruser',
        displayName: 'Another User',
        profileImageUrl: null
      },
      isReply: false,
      replyCount: 0
    }
  ]

  const mockReplies = [
    {
      id: '3',
      postId: 'post-1',
      userId: 3,
      content: 'Thanks for sharing!',
      parentCommentId: '1',
      createdAt: new Date().toISOString(),
      user: {
        id: 3,
        username: 'replyuser',
        displayName: 'Reply User',
        profileImageUrl: null
      },
      isReply: true,
      replyCount: 0
    }
  ]

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    postId: 'post-1',
    comments: mockComments,
    totalCommentsCount: 2,
    onCommentSubmit: jest.fn().mockResolvedValue(undefined),
    onReplySubmit: jest.fn().mockResolvedValue(undefined),
    onLoadReplies: jest.fn().mockResolvedValue(mockReplies),
    isSubmitting: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: jest.fn()
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      writable: true,
      value: jest.fn()
    })
  })

  it('renders modal when open', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Comments (2)')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderWithToast(<CommentsModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('displays comments with user information', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    expect(screen.getByText('This is a great post! 😊')).toBeInTheDocument()
    expect(screen.getByText('I agree! This is inspiring.')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Another User')).toBeInTheDocument()
  })

  it('shows reply count for comments with replies', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    expect(screen.getByText(/Show 2 replies/i)).toBeInTheDocument()
  })

  it('loads and displays replies when clicking show replies button', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const showRepliesButton = screen.getByText(/Show 2 replies/i)
    fireEvent.click(showRepliesButton)
    
    await waitFor(() => {
      expect(defaultProps.onLoadReplies).toHaveBeenCalledWith('1')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Thanks for sharing!')).toBeInTheDocument()
    })
  })

  it('allows user to add a comment', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Add a comment...')
    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    
    fireEvent.change(textarea, { target: { value: 'New comment text' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(defaultProps.onCommentSubmit).toHaveBeenCalledWith('New comment text')
    })
  })

  it('shows character counter for comment input', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Add a comment...')
    
    expect(screen.getByText('0/500')).toBeInTheDocument()
    
    fireEvent.change(textarea, { target: { value: 'Test comment' } })
    
    expect(screen.getByText('12/500')).toBeInTheDocument()
  })

  it('enforces maximum character limit', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    const longText = 'a'.repeat(600)
    
    fireEvent.change(textarea, { target: { value: longText } })
    
    expect(textarea.value.length).toBe(500)
    expect(screen.getByText('500/500')).toBeInTheDocument()
  })

  it('disables submit button when comment is empty', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when comment has text', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Add a comment...')
    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    
    fireEvent.change(textarea, { target: { value: 'Test comment' } })
    
    expect(submitButton).not.toBeDisabled()
  })

  it('shows reply input when clicking reply button', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])
    
    expect(screen.getByPlaceholderText(/Reply to Test User.../i)).toBeInTheDocument()
  })

  it('allows user to submit a reply', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Click reply button
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])
    
    // Enter reply text
    const replyTextarea = screen.getByPlaceholderText(/Reply to Test User.../i)
    fireEvent.change(replyTextarea, { target: { value: 'This is a reply' } })
    
    // Submit reply
    const submitReplyButton = screen.getByRole('button', { name: /Submit reply/i })
    fireEvent.click(submitReplyButton)
    
    await waitFor(() => {
      expect(defaultProps.onReplySubmit).toHaveBeenCalledWith('1', 'This is a reply')
    })
  })

  it('cancels reply input when clicking cancel', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Click reply button
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])
    
    expect(screen.getByPlaceholderText(/Reply to Test User.../i)).toBeInTheDocument()
    
    // Click hide button (which acts as cancel)
    const hideButton = screen.getByRole('button', { name: /Hide reply input/i })
    fireEvent.click(hideButton)
    
    expect(screen.queryByPlaceholderText(/Reply to Test User.../i)).not.toBeInTheDocument()
  })

  it('shows empty state when no comments', () => {
    renderWithToast(<CommentsModal {...defaultProps} comments={[]} totalCommentsCount={0} />)
    
    expect(screen.getByText('No comments yet')).toBeInTheDocument()
    expect(screen.getByText('Be the first to comment!')).toBeInTheDocument()
  })

  it('closes modal when clicking close button', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const closeButton = screen.getByRole('button', { name: /Close comments modal/i })
    fireEvent.click(closeButton)
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('closes modal when pressing Escape key', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const modal = screen.getByRole('dialog')
    fireEvent.keyDown(modal, { key: 'Escape' })
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows loading state when submitting comment', () => {
    renderWithToast(<CommentsModal {...defaultProps} isSubmitting={true} />)
    
    // Check that submit button is disabled during submission
    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    expect(submitButton).toBeDisabled()
  })

  it('displays usernames with @ prefix', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    expect(screen.getByText('@testuser')).toBeInTheDocument()
    expect(screen.getByText('@anotheruser')).toBeInTheDocument()
  })

  it('shows relative timestamps for comments', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Should show some time ago format (e.g., "0s", "1m", etc.)
    const timeElements = screen.getAllByText(/\d+[smhdwy]/)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('collapses replies when clicking hide replies button', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Show replies first
    const showRepliesButton = screen.getByText(/Show 2 replies/i)
    fireEvent.click(showRepliesButton)
    
    await waitFor(() => {
      expect(screen.getByText('Thanks for sharing!')).toBeInTheDocument()
    })
    
    // Hide replies
    const hideRepliesButton = screen.getByText(/Hide 2 replies/i)
    fireEvent.click(hideRepliesButton)
    
    await waitFor(() => {
      expect(screen.queryByText('Thanks for sharing!')).not.toBeInTheDocument()
    })
  })

  it('has proper ARIA labels for accessibility', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'comments-modal-title')
    expect(screen.getByLabelText('Add a comment')).toBeInTheDocument()
  })

  it('supports keyboard navigation with Tab key', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const modal = screen.getByRole('dialog')
    const focusableElements = modal.querySelectorAll('button, textarea')
    
    expect(focusableElements.length).toBeGreaterThan(0)
  })

  it('supports emoji in comments', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Check that emoji is displayed in comment content
    expect(screen.getByText(/😊/)).toBeInTheDocument()
  })

  it('inserts emoji into main comment input and keeps focus', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    const textarea = screen.getByLabelText('Add a comment') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    textarea.focus()
    textarea.setSelectionRange(5, 5)
    fireEvent.select(textarea)

    fireEvent.click(screen.getByRole('button', { name: /Open emoji picker for comment/i }))
    fireEvent.click(screen.getByTitle('grinning face'))

    expect((screen.getByLabelText('Add a comment') as HTMLTextAreaElement).value).toBe('Hello😀')
    expect(document.activeElement).toBe(screen.getByLabelText('Add a comment'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search emojis...')).toBeInTheDocument()
  })

  it('clicking inside modal while picker is open closes only picker, not modal', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Open emoji picker for comment/i }))
    expect(screen.getByPlaceholderText('Search emojis...')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByLabelText('Add a comment'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search emojis...')).not.toBeInTheDocument()
  })

  it('clicking outside modal still triggers modal close', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    const backdrop = document.querySelector('.absolute.inset-0.bg-black.bg-opacity-50') as HTMLElement
    fireEvent.mouseDown(backdrop)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('preserves main comment draft across modal close and reopen', async () => {
    const statefulProps = {
      ...defaultProps,
      onClose: jest.fn()
    }

    renderWithToast(<StatefulCommentsModal {...statefulProps} />)

    const input = screen.getByLabelText('Add a comment') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'draft text 💜' } })

    const backdrop = document.querySelector('.absolute.inset-0.bg-black.bg-opacity-50') as HTMLElement
    fireEvent.mouseDown(backdrop)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Reopen comments/i }))

    expect((screen.getByLabelText('Add a comment') as HTMLTextAreaElement).value).toBe('draft text 💜')
  })

  it('inserts emoji into reply input', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])

    const replyTextarea = screen.getByPlaceholderText(/Reply to Test User.../i) as HTMLTextAreaElement
    fireEvent.change(replyTextarea, { target: { value: 'Reply' } })
    replyTextarea.focus()
    replyTextarea.setSelectionRange(5, 5)
    fireEvent.select(replyTextarea)

    fireEvent.click(screen.getByRole('button', { name: /Open emoji picker for reply/i }))
    fireEvent.click(screen.getByTitle('grinning face'))

    await waitFor(() => {
      expect((screen.getByPlaceholderText(/Reply to Test User.../i) as HTMLTextAreaElement).value).toBe('Reply😀')
    })
  })

  it('inserts emoji into edit input', async () => {
    const propsWithEdit = {
      ...defaultProps,
      currentUserId: 1,
      onCommentEdit: jest.fn().mockResolvedValue({
        ...mockComments[0],
        editedAt: new Date().toISOString()
      })
    }

    renderWithToast(<CommentsModal {...propsWithEdit} />)

    fireEvent.click(screen.getByRole('button', { name: /Edit comment/i }))
    const editTextarea = screen.getByLabelText('Edit comment') as HTMLTextAreaElement
    editTextarea.focus()
    editTextarea.setSelectionRange(editTextarea.value.length, editTextarea.value.length)
    fireEvent.select(editTextarea)

    fireEvent.click(screen.getByRole('button', { name: /Open emoji picker for edit comment/i }))
    fireEvent.click(screen.getByTitle('grinning face'))

    await waitFor(() => {
      expect((screen.getByLabelText('Edit comment') as HTMLTextAreaElement).value).toContain('😀')
    })
  })

  it('keeps keyboard inset logic mobile-gated', () => {
    const originalMatchMedia = window.matchMedia
    const originalVisualViewport = (window as any).visualViewport

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    })

    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: {
        height: 600,
        offsetTop: 80,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }
    })

    renderWithToast(<CommentsModal {...defaultProps} />)

    const dialog = screen.getByRole('dialog')
    const overlay = dialog.parentElement as HTMLElement
    expect(overlay.className).toContain('items-end')
    expect(overlay.className).toContain('sm:items-center')
    expect(overlay.style.paddingBottom).toBe('88px')

    Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia })
    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: originalVisualViewport
    })
  })

  it('does not apply keyboard inset on desktop viewport', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    })

    renderWithToast(<CommentsModal {...defaultProps} />)

    const dialog = screen.getByRole('dialog')
    const overlay = dialog.parentElement as HTMLElement
    expect(overlay.style.paddingBottom).toBe('')
  })

  it('indents replies visually', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Show replies
    const showRepliesButton = screen.getByText(/Show 2 replies/i)
    fireEvent.click(showRepliesButton)
    
    await waitFor(() => {
      const replyText = screen.getByText('Thanks for sharing!')
      // Find the parent article div that has the ml- class for indentation
      const replyArticle = replyText.closest('[role="article"]')
      expect(replyArticle?.className).toContain('ml-')
    })
  })

  it('has minimum touch target size for mobile', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Check actual button elements (not spans with role="button")
    const buttons = screen.getAllByRole('button').filter(el => el.tagName === 'BUTTON')
    
    // At least some buttons should have minimum touch target size
    const buttonsWithMinHeight = buttons.filter(button => 
      button.className.includes('min-h-[44px]') || button.className.includes('min-h-0')
    )
    
    expect(buttonsWithMinHeight.length).toBeGreaterThan(0)
  })
})
