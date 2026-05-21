import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { renderHook, act } from '@testing-library/react'
import {
  useCommentReactions,
  updateCommentReactionsCache,
  getCommentSubscribersCount
} from '../useImageReactions'

jest.mock('@/utils/auth', () => ({
  getAccessToken: jest.fn(),
}))

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

describe('useCommentReactions (@behavior)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reuses warm cache without refetching', () => {
    const postId = 'comment-cache-hit'
    updateCommentReactionsCache(postId, {
      'comment-1': { totalCount: 1, emojiCounts: { heart: 1 }, userReaction: 'heart', reactions: [] }
    })

    const { result } = renderHook(() => useCommentReactions(postId))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.getReactionForComment('comment-1').totalCount).toBe(1)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('dedupes concurrent summary fetches', async () => {
    const postId = 'comment-dedup'
    mockFetch.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({
        ok: true,
        json: async () => ({})
      } as Response), 10)
    }) as Promise<Response>)

    const { rerender } = renderHook(() => useCommentReactions(postId, true))

    await act(async () => {
      rerender()
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/api/posts/comment-dedup/comment-reactions', expect.any(Object))
  })

  it('keeps optimistic cache writes when stale fetch resolves later', async () => {
    const postId = 'comment-race'
    let resolveFetch: (val: Response) => void = () => {}
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve
    }) as Promise<Response>)

    const { result } = renderHook(() => useCommentReactions(postId, true))
    expect(result.current.isLoading).toBe(true)

    act(() => {
      updateCommentReactionsCache(postId, {
        'comment-1': { totalCount: 3, emojiCounts: { fire: 3 }, userReaction: 'fire', reactions: [] }
      })
    })

    expect(result.current.getReactionForComment('comment-1').totalCount).toBe(3)

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          'comment-1': { totalCount: 1, emojiCounts: { heart: 1 }, userReaction: null, reactions: [] }
        })
      } as Response)
    })

    expect(result.current.getReactionForComment('comment-1').totalCount).toBe(3)
    expect(result.current.getReactionForComment('comment-1').userReaction).toBe('fire')
  })

  it('cleans up subscribers on unmount', () => {
    const postId = 'comment-subscriber-cleanup'
    const { unmount } = renderHook(() => useCommentReactions(postId, false))

    expect(getCommentSubscribersCount(postId)).toBe(1)

    unmount()

    expect(getCommentSubscribersCount(postId)).toBe(0)
  })
})
