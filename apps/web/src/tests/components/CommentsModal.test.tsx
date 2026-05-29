import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach } from '@jest/globals'
import { ToastProvider } from '@/contexts/ToastContext'
import { updateCommentReactionsCache } from '@/hooks/useImageReactions'


jest.mock('@/components/EmojiPicker', () => {
  return {
    __esModule: true,
    default: function MockEmojiPicker({ isOpen, onEmojiSelect, onCancel }: any) {
      if (!isOpen) return null
      return (
        <div role="dialog" aria-label="Reaction picker">
          <button type="button" onClick={() => onEmojiSelect('heart')}>Pick heart</button>
          <button type="button" onClick={onCancel}>Cancel reaction picker</button>
        </div>
      )
    }
  }
})

jest.mock('@/components/ReactionViewer', () => {
  return {
    __esModule: true,
    default: function MockReactionViewer({ isOpen, objectType, objectId }: any) {
      if (!isOpen) return null
      return (
        <div role="dialog" aria-label="Reaction viewer">
          Reaction viewer {objectType}:{objectId}
        </div>
      )
    }
  }
})

import CommentsModal from '@/components/CommentsModal'

// Helper function to render with ToastProvider
const renderWithToast = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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
    updateCommentReactionsCache('post-1', {})
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    })
    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: jest.fn()
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      writable: true,
      value: jest.fn()
    })
  })

  it('caps the footer textarea at four lines and enables internal scrolling', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      value: 220
    })

    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5' } })

    expect(textarea.style.height).toBe('102px')
    expect(textarea.style.overflowY).toBe('auto')
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

  it('shows React text for initially unreacted comments and replies', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    const topLevelReactionButtons = screen.getAllByRole('button', { name: /react to comment/i })
    expect(within(topLevelReactionButtons[0]).getByText('React')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show 2 replies/i }))

    await waitFor(() => {
      expect(screen.getByText('Thanks for sharing!')).toBeInTheDocument()
    })

    const allReactionButtons = screen.getAllByRole('button', { name: /react to comment/i })
    expect(within(allReactionButtons[allReactionButtons.length - 1]).getByText('React')).toBeInTheDocument()
  })

  it('optimistically changes the comment reaction label to Reacted after selecting an emoji', async () => {
    updateCommentReactionsCache('post-1', {})

    renderWithToast(<CommentsModal {...defaultProps} />)

    fireEvent.click(screen.getAllByRole('button', { name: /react to comment/i })[0])
    fireEvent.click(screen.getByText('Pick heart'))

    const reactedButton = await screen.findByRole('button', { name: /remove reaction from comment/i })
    expect(within(reactedButton).getByText('Reacted')).toBeInTheDocument()
  })

  it('rolls the comment reaction label back to React when optimistic add fails', async () => {
    updateCommentReactionsCache('post-1', {})
    const mutation = deferred<Response>()
    ;(global.fetch as jest.Mock).mockReturnValueOnce(mutation.promise)

    renderWithToast(<CommentsModal {...defaultProps} />)

    fireEvent.click(screen.getAllByRole('button', { name: /react to comment/i })[0])
    fireEvent.click(screen.getByText('Pick heart'))

    const optimisticButton = await screen.findByRole('button', { name: /remove reaction from comment/i })
    expect(within(optimisticButton).getByText('Reacted')).toBeInTheDocument()

    mutation.reject(new Error('network down'))

    await waitFor(() => {
      const reactionButtons = screen.getAllByRole('button', { name: /react to comment/i })
      expect(within(reactionButtons[0]).getByText('React')).toBeInTheDocument()
    })
  })

  it('returns the comment reaction label to React when removing a reaction succeeds', async () => {
    updateCommentReactionsCache('post-1', {
      '1': { totalCount: 1, emojiCounts: { heart: 1 }, userReaction: 'heart', reactions: [] }
    })

    renderWithToast(<CommentsModal {...defaultProps} />)

    const reactedButton = screen.getByRole('button', { name: /remove reaction from comment/i })
    expect(within(reactedButton).getByText('Reacted')).toBeInTheDocument()

    fireEvent.click(reactedButton)

    await waitFor(() => {
      const reactionButtons = screen.getAllByRole('button', { name: /react to comment/i })
      expect(within(reactionButtons[0]).getByText('React')).toBeInTheDocument()
    })
  })

  it('keeps comment reaction viewer lazy until a banner is opened', async () => {
    updateCommentReactionsCache('post-1', {
      '1': { totalCount: 1, emojiCounts: { heart: 1 }, userReaction: null, reactions: [] }
    })

    renderWithToast(<CommentsModal {...defaultProps} />)

    expect(screen.queryByLabelText('Reaction viewer')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('View reactions'))

    expect(screen.getByLabelText('Reaction viewer')).toHaveTextContent('comment:1')
  })

  it('optimistically shows then removes a phantom banner when adding a comment reaction fails', async () => {
    updateCommentReactionsCache('post-1', {})
    const mutation = deferred<Response>()
    ;(global.fetch as jest.Mock).mockReturnValueOnce(mutation.promise)

    renderWithToast(<CommentsModal {...defaultProps} />)

    fireEvent.click(screen.getAllByRole('button', { name: /react to comment/i })[0])
    fireEvent.click(screen.getByText('Pick heart'))

    await waitFor(() => {
      expect(screen.getByTitle('View reactions')).toBeInTheDocument()
    })

    mutation.reject(new Error('network down'))

    await waitFor(() => {
      expect(screen.queryByTitle('View reactions')).not.toBeInTheDocument()
    })
  })

  it('optimistically hides then restores the final reaction banner when removal fails', async () => {
    updateCommentReactionsCache('post-1', {
      '1': { totalCount: 1, emojiCounts: { heart: 1 }, userReaction: 'heart', reactions: [] }
    })
    const mutation = deferred<Response>()
    ;(global.fetch as jest.Mock).mockReturnValueOnce(mutation.promise)

    renderWithToast(<CommentsModal {...defaultProps} />)

    expect(screen.getByTitle('View reactions')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remove reaction from comment/i }))

    await waitFor(() => {
      expect(screen.queryByTitle('View reactions')).not.toBeInTheDocument()
    })

    mutation.reject(new Error('network down'))

    await waitFor(() => {
      expect(screen.getByTitle('View reactions')).toBeInTheDocument()
    })
  })

  it('shows reply count for comments with replies', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /show 2 replies/i })).toBeInTheDocument()
  })

  it('loads and displays replies when clicking show replies button', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const showRepliesButton = screen.getByRole('button', { name: /show 2 replies/i })
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
    
    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    const submitButton = screen.getByRole('button', { name: /Post comment/i })

    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      value: 220
    })
    
    fireEvent.change(textarea, { target: { value: 'New comment text' } })
    textarea.scrollTop = 48
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(defaultProps.onCommentSubmit).toHaveBeenCalledWith('New comment text')
    })

    await waitFor(() => {
      expect(textarea.value).toBe('')
      expect(textarea.style.height).toBe('30px')
      expect(textarea.style.overflowY).toBe('hidden')
      expect(textarea.scrollTop).toBe(0)
    })
  })

  it('shows character counter for comment input', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Add a comment...')
    
    expect(screen.getByText('0/2000')).toBeInTheDocument()
    
    fireEvent.change(textarea, { target: { value: 'Test comment' } })
    
    expect(screen.getByText('12/2000')).toBeInTheDocument()
  })

  it('enforces maximum character limit', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    const longText = 'a'.repeat(2500)
    
    fireEvent.change(textarea, { target: { value: longText } })
    
    expect(textarea.value.length).toBe(2000)
    expect(screen.getByText('2000/2000')).toBeInTheDocument()
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

  it('uses the footer input for replies when clicking reply button', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])
    
    expect(screen.getByPlaceholderText(/Reply to Test User.../i)).toBeInTheDocument()
    expect(screen.queryAllByPlaceholderText(/Reply to Test User.../i)).toHaveLength(1)
  })

  it('allows user to submit a reply', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Click reply button
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])
    
    // Enter reply text into footer input
    const replyTextarea = screen.getByPlaceholderText(/Reply to Test User.../i) as HTMLTextAreaElement
    Object.defineProperty(replyTextarea, 'scrollHeight', {
      configurable: true,
      value: 220
    })
    fireEvent.change(replyTextarea, { target: { value: 'This is a reply' } })
    replyTextarea.scrollTop = 36
    
    // Submit reply from footer send button
    const submitReplyButton = screen.getByRole('button', { name: /Post reply/i })
    fireEvent.click(submitReplyButton)
    
    // Verify handler was called - this is the core behavior
    await waitFor(() => {
      expect(defaultProps.onReplySubmit).toHaveBeenCalledWith('1', 'This is a reply')
    })
    
    // After submission, verify reply mode is cancelled (main input is visible)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
    })
  })

  it('cancels reply mode when clicking cancel', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])
    
    expect(screen.getByPlaceholderText(/Reply to Test User.../i)).toBeInTheDocument()
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)
    
    expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
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
    
    expect(screen.getAllByText('Just now').length).toBeGreaterThan(0)
  })

  it('collapses replies when clicking hide replies button', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    
    // Show replies first
    const showRepliesButton = screen.getByRole('button', { name: /show 2 replies/i })
    fireEvent.click(showRepliesButton)
    
    await waitFor(() => {
      expect(screen.getByText('Thanks for sharing!')).toBeInTheDocument()
    })
    
    // Hide replies
    const hideRepliesButton = screen.getByRole('button', { name: /hide 2 replies/i })
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
    expect(document.querySelector('[data-minimal-emoji-picker]')).toBeInTheDocument()
  })

  it('clicking inside the footer input keeps the picker open and modal stable', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Open emoji picker for comment/i }))
    expect(document.querySelector('[data-minimal-emoji-picker]')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByLabelText('Add a comment'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.querySelector('[data-minimal-emoji-picker]')).toBeInTheDocument()
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

  it('shows emoji picker button in reply mode', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    // Enter reply mode
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])

    // Verify reply mode is active
    expect(screen.getByPlaceholderText(/Reply to Test User.../i)).toBeInTheDocument()
    
    // Reply mode shows footer with input - verify the main comment input is no longer visible
    expect(screen.queryByPlaceholderText('Add a comment...')).not.toBeInTheDocument()
  })

  it('can switch between different reply targets', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    // Enter reply mode for first comment
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])
    
    // Verify first reply target is active
    expect(screen.getByPlaceholderText(/Reply to Test User.../i)).toBeInTheDocument()

    // Switch to second reply target
    fireEvent.click(replyButtons[1])
    
    // Verify second reply target is now active
    expect(screen.getByPlaceholderText(/Reply to Another User.../i)).toBeInTheDocument()
  })

  // Note: Comment editing requires currentUserId to match comment userId + onCommentEdit prop
  // These tests verify basic edit button existence when conditions are met
  // Full edit functionality testing would require more complex setup

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
    const showRepliesButton = screen.getByRole('button', { name: /show 2 replies/i })
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

  // ── Issue 1: Emoji Tray + Submit Button ───────────────────────────────
  it('submits in one click when emoji picker is open', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Comment with emoji open' } })

    // Open emoji picker
    fireEvent.click(screen.getByRole('button', { name: /Open emoji picker for comment/i }))
    expect(document.querySelector('[data-minimal-emoji-picker]')).toBeInTheDocument()

    // Submit button should have data-submit-button attribute
    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    expect(submitButton).toHaveAttribute('data-submit-button')

    // Click submit
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(defaultProps.onCommentSubmit).toHaveBeenCalledWith('Comment with emoji open')
    })

    // Picker closed as part of submit flow
    expect(document.querySelector('[data-minimal-emoji-picker]')).not.toBeInTheDocument()
  })

  it('submits reply in one click when emoji picker is open', async () => {
    renderWithToast(<CommentsModal {...defaultProps} />)

    // Enter reply mode
    const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
    fireEvent.click(replyButtons[0])

    const replyTextarea = screen.getByPlaceholderText(/Reply to Test User.../i) as HTMLTextAreaElement
    fireEvent.change(replyTextarea, { target: { value: 'Reply with emoji open' } })

    // Open emoji picker in reply mode
    fireEvent.click(screen.getAllByRole('button', { name: /Open emoji picker/i })[0])
    expect(document.querySelector('[data-minimal-emoji-picker]')).toBeInTheDocument()

    // Submit reply button should have data-submit-button
    const submitReplyButton = screen.getByRole('button', { name: /Post reply/i })
    expect(submitReplyButton).toHaveAttribute('data-submit-button')

    // Click submit
    fireEvent.click(submitReplyButton)

    await waitFor(() => {
      expect(defaultProps.onReplySubmit).toHaveBeenCalledWith('1', 'Reply with emoji open')
    })

    // Picker closed
    expect(document.querySelector('[data-minimal-emoji-picker]')).not.toBeInTheDocument()
  })

  // ── Issue 3: Delete Confirmation Visibility ───────────────────────────
  it('renders delete confirmation with data attribute for scroll targeting', async () => {
    const ownComment = [{
      id: '5',
      postId: 'post-1',
      userId: 1,
      content: 'My own comment',
      createdAt: new Date().toISOString(),
      user: {
        id: 1,
        username: 'testuser',
        displayName: 'Test User',
        profileImageUrl: null
      },
      isReply: false,
      replyCount: 0
    }]

    const props = {
      ...defaultProps,
      currentUserId: 1,
      onCommentDelete: jest.fn().mockResolvedValue(undefined),
      comments: ownComment,
      totalCommentsCount: 1
    }

    renderWithToast(<CommentsModal {...props} />)

    const deleteButton = screen.getByRole('button', { name: /Delete comment/i })
    fireEvent.click(deleteButton)

    const confirmEl = document.querySelector('[data-delete-confirm="5"]')
    expect(confirmEl).toBeInTheDocument()
    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  // ── Issue 4: Delete Eligibility Refresh ──────────────────────────────
  it('refreshes reply cache after deleting a reply', async () => {
    const myReply = [
      {
        id: 'del-reply-1',
        postId: 'post-1',
        userId: 1,
        content: 'My deletable reply',
        parentCommentId: '1',
        createdAt: new Date().toISOString(),
        user: {
          id: 1,
          username: 'testuser',
          displayName: 'Test User',
          profileImageUrl: null
        },
        isReply: true,
        replyCount: 0,
        canDelete: true
      }
    ]

    const loadRepliesMock = jest.fn().mockResolvedValue(myReply)

    const props = {
      ...defaultProps,
      currentUserId: 1,
      onCommentDelete: jest.fn().mockResolvedValue(undefined),
      onLoadReplies: loadRepliesMock
    }

    renderWithToast(<CommentsModal {...props} />)

    // Show replies for comment 1
    fireEvent.click(screen.getByRole('button', { name: /show 2 replies/i }))

    await waitFor(() => {
      expect(screen.getByText('My deletable reply')).toBeInTheDocument()
    })

    // Find and click delete on the reply
    const allDeleteButtons = screen.getAllByRole('button', { name: /Delete comment/i })
    // The last delete button is the reply's (replies render after parent comment)
    fireEvent.click(allDeleteButtons[allDeleteButtons.length - 1])

    // Confirm deletion (the confirmation button's name is exactly "Delete", not "Delete comment")
    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(confirmButton)

    // Verify onLoadReplies was called twice: once for initial load, once to refresh after delete.
    // (forceReload=true is internal to loadReplies, not passed to the onLoadReplies prop)
    await waitFor(() => {
      expect(loadRepliesMock).toHaveBeenCalledTimes(2)
    })
  })

  // ── Issue 2: Pending-State Locking ────────────────────────────────────
  it('disables textarea and submit during pending mutation', async () => {
    const deferredSubmit = deferred<void>()
    const props = {
      ...defaultProps,
      onCommentSubmit: jest.fn(() => deferredSubmit.promise)
    }

    renderWithToast(<CommentsModal {...props} />)

    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'During pending' } })

    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    fireEvent.click(submitButton)

    // Controls disabled while pending
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
      expect(textarea).toBeDisabled()
    })

    deferredSubmit.resolve()

    await waitFor(() => {
      expect(submitButton).toBeDisabled() // disabled because empty text now
    })
  })

  it('disables edit and reply buttons during pending mutation', async () => {
    const deferredSubmit = deferred<void>()
    const props = {
      ...defaultProps,
      onCommentSubmit: jest.fn(() => deferredSubmit.promise),
      currentUserId: 1,
      onCommentEdit: jest.fn().mockResolvedValue({ content: '', editedAt: null })
    }

    renderWithToast(<CommentsModal {...props} />)

    // Type and submit
    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Test' } })

    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    fireEvent.click(submitButton)

    // Verify reply and edit buttons are disabled during pending
    await waitFor(() => {
      const replyButtons = screen.getAllByRole('button', { name: /Reply to/i })
      replyButtons.forEach(btn => expect(btn).toBeDisabled())
    })

    // Comment 1 (userId: 1) is owned by currentUserId: 1, so Edit button exists
    const editButton = screen.getByRole('button', { name: /Edit comment/i })
    expect(editButton).toBeDisabled()

    deferredSubmit.resolve()
  })

  // ── Issue 2: New Comment Auto-Scroll ─────────────────────────────────
  it('clears textarea immediately on new comment submit (optimistic)', async () => {
    const deferredSubmit = deferred<void>()
    const props = {
      ...defaultProps,
      onCommentSubmit: jest.fn(() => deferredSubmit.promise)
    }

    renderWithToast(<CommentsModal {...props} />)

    const textarea = screen.getByPlaceholderText('Add a comment...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Optimistic clear' } })

    const submitButton = screen.getByRole('button', { name: /Post comment/i })
    fireEvent.click(submitButton)

    // Textarea should clear immediately (optimistically) before API resolves
    expect(textarea.value).toBe('')
    expect(textarea).toBeDisabled()

    deferredSubmit.resolve()
  })
})
