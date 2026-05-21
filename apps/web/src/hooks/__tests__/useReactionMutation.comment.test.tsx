import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/contexts/ToastContext'
import { useReactionMutation } from '../useReactionMutation'
import {
  getCommentReactionsMapFromCache,
  updateCommentReactionsCache,
  type ReactionSummaryData
} from '../useImageReactions'

jest.mock('@/utils/auth', () => ({
  getAccessToken: jest.fn(() => 'test-token'),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

const emptyState: ReactionSummaryData = {
  totalCount: 0,
  emojiCounts: {},
  userReaction: null,
  reactions: []
}

describe('useReactionMutation comment support', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    updateCommentReactionsCache('post-mutation', {})
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })
  })

  it('sends snake_case comment mutation payload and writes optimistic cache', async () => {
    const { result } = renderHook(() => useReactionMutation({
      postId: 'post-mutation',
      objectType: 'comment',
      objectId: 'comment-1',
      currentReactionState: emptyState
    }), { wrapper })

    await act(async () => {
      result.current.handleReaction('heart')
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/posts/post-mutation/reactions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        emoji_code: 'heart',
        object_type: 'comment',
        object_id: 'comment-1'
      })
    }))
    expect(getCommentReactionsMapFromCache('post-mutation')?.['comment-1']).toEqual(
      expect.objectContaining({
        totalCount: 1,
        emojiCounts: { heart: 1 },
        userReaction: 'heart'
      })
    )
  })

  it('rolls back stale failures without clobbering a newer emoji switch', async () => {
    let rejectFirst: (error: Error) => void = () => {}
    let resolveSecond: (response: Response) => void = () => {}

    ;(global.fetch as jest.Mock)
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectFirst = reject
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecond = resolve
      }))

    const { result, rerender } = renderHook(
      ({ reactionState }) => useReactionMutation({
        postId: 'post-mutation',
        objectType: 'comment',
        objectId: 'comment-1',
        currentReactionState: reactionState
      }),
      { wrapper, initialProps: { reactionState: emptyState } }
    )

    act(() => {
      result.current.handleReaction('heart')
    })

    const heartState = getCommentReactionsMapFromCache('post-mutation')?.['comment-1'] as ReactionSummaryData
    rerender({ reactionState: heartState })

    act(() => {
      result.current.handleReaction('fire')
    })

    await act(async () => {
      rejectFirst(new Error('late first failure'))
      resolveSecond({
        ok: true,
        json: async () => ({ success: true })
      } as Response)
    })

    await waitFor(() => {
      expect(getCommentReactionsMapFromCache('post-mutation')?.['comment-1']).toEqual(
        expect.objectContaining({
          totalCount: 1,
          emojiCounts: { fire: 1 },
          userReaction: 'fire'
        })
      )
    })
  })

  it('uses snake_case query params when removing a comment reaction', async () => {
    const reactedState: ReactionSummaryData = {
      totalCount: 1,
      emojiCounts: { heart: 1 },
      userReaction: 'heart',
      reactions: []
    }
    updateCommentReactionsCache('post-mutation', { 'comment-1': reactedState })

    const { result } = renderHook(() => useReactionMutation({
      postId: 'post-mutation',
      objectType: 'comment',
      objectId: 'comment-1',
      currentReactionState: reactedState
    }), { wrapper })

    await act(async () => {
      result.current.handleReaction(null)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/posts/post-mutation/reactions?object_type=comment&object_id=comment-1',
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(getCommentReactionsMapFromCache('post-mutation')?.['comment-1']).toEqual(
      expect.objectContaining({
        totalCount: 0,
        emojiCounts: {},
        userReaction: null
      })
    )
  })
})
