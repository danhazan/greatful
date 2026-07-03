import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from '@jest/globals'
import { ToastProvider } from '@/contexts/ToastContext'
import CommentsModal from '@/components/CommentsModal'
import { updateCommentReactionsCache } from '@/hooks/useImageReactions'

jest.mock('@/components/EmojiPicker', () => ({
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
}))

jest.mock('@/components/ReactionViewer', () => ({
  __esModule: true,
  default: function MockReactionViewer({ isOpen, objectType, objectId }: any) {
    if (!isOpen) return null
    return (
      <div role="dialog" aria-label="Reaction viewer">
        Reaction viewer {objectType}:{objectId}
      </div>
    )
  }
}))

const renderWithToast = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('CommentsModal RTL Support', () => {
  const hebrewComment = {
    id: '1',
    postId: 'post-1',
    userId: 1,
    content: 'שלום עולם',
    createdAt: new Date().toISOString(),
    user: { id: 1, username: 'testuser', displayName: 'Test User', profileImageUrl: null },
    isReply: false,
    replyCount: 0
  }

  const arabicComment = {
    id: '2',
    postId: 'post-1',
    userId: 1,
    content: 'مرحبا بالعالم',
    createdAt: new Date().toISOString(),
    user: { id: 1, username: 'testuser', displayName: 'Test User', profileImageUrl: null },
    isReply: false,
    replyCount: 0
  }

  const englishComment = {
    id: '3',
    postId: 'post-1',
    userId: 1,
    content: 'Hello World',
    createdAt: new Date().toISOString(),
    user: { id: 1, username: 'testuser', displayName: 'Test User', profileImageUrl: null },
    isReply: false,
    replyCount: 0
  }

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    postId: 'post-1',
    comments: [],
    totalCommentsCount: 0,
    currentUserId: 1,
    onCommentSubmit: jest.fn().mockResolvedValue(undefined),
    onReplySubmit: jest.fn().mockResolvedValue(undefined),
    onLoadReplies: jest.fn().mockResolvedValue([]),
    onCommentEdit: jest.fn().mockResolvedValue({ content: '', editedAt: new Date().toISOString() }),
    isSubmitting: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    updateCommentReactionsCache('post-1', {})
  })

  it('applies dir="rtl" to comment bubble with Hebrew content', () => {
    renderWithToast(
      <CommentsModal {...defaultProps} comments={[hebrewComment]} />
    )
    const p = screen.getByText('שלום עולם')
    expect(p).toHaveAttribute('dir', 'rtl')
  })

  it('applies dir="rtl" to comment bubble with Arabic content', () => {
    renderWithToast(
      <CommentsModal {...defaultProps} comments={[arabicComment]} />
    )
    const p = screen.getByText('مرحبا بالعالم')
    expect(p).toHaveAttribute('dir', 'rtl')
  })

  it('applies dir="ltr" to comment bubble with English content', () => {
    renderWithToast(
      <CommentsModal {...defaultProps} comments={[englishComment]} />
    )
    const p = screen.getByText('Hello World')
    expect(p).toHaveAttribute('dir', 'ltr')
  })

  it('applies dir to new comment textarea based on typed text', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    const textarea = screen.getByLabelText('Add a comment')
    expect(textarea).toHaveAttribute('dir', 'ltr')

    fireEvent.change(textarea, { target: { value: 'שלום' } })
    expect(textarea).toHaveAttribute('dir', 'rtl')

    fireEvent.change(textarea, { target: { value: 'Hello' } })
    expect(textarea).toHaveAttribute('dir', 'ltr')
  })

  it('applies dir to reply textarea based on typed text', () => {
    renderWithToast(
      <CommentsModal {...defaultProps} comments={[englishComment]} />
    )
    fireEvent.click(screen.getByText('Reply'))
    const textarea = screen.getByLabelText(/Reply to/)
    expect(textarea).toHaveAttribute('dir', 'ltr')

    fireEvent.change(textarea, { target: { value: 'תשובה' } })
    expect(textarea).toHaveAttribute('dir', 'rtl')
  })

  it('applies dir to edit textarea based on content', () => {
    renderWithToast(
      <CommentsModal {...defaultProps} comments={[hebrewComment]} />
    )
    fireEvent.click(screen.getByLabelText('Edit comment'))
    const textarea = screen.getByLabelText('Edit comment')
    expect(textarea).toHaveAttribute('dir', 'rtl')
  })

  it('direction persists across mode switches driven by content', () => {
    renderWithToast(<CommentsModal {...defaultProps} />)
    const textarea = screen.getByLabelText('Add a comment')

    fireEvent.change(textarea, { target: { value: 'שלום' } })
    expect(textarea).toHaveAttribute('dir', 'rtl')

    fireEvent.change(textarea, { target: { value: '' } })
    expect(textarea).toHaveAttribute('dir', 'ltr')
  })
})
