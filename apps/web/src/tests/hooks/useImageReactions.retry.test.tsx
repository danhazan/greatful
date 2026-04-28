import { renderHook, act, waitFor } from '@testing-library/react'
import { useImageReactions, updateImageReactionsCache } from '@/hooks/useImageReactions'
import { IMAGE_REACTIONS_CONFIG } from '@/config/reactions'
import { describe, it, beforeEach, afterEach, jest, expect } from '@jest/globals'

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch

describe('useImageReactions Retry Strategy Hardening', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should retry a failed request with backoff', async () => {
    const postId = 'test-retry-' + Math.random()
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 500 }))

    const { result } = renderHook(() => useImageReactions(postId))

    // 1st Attempt
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.retryCount).toBe(1))
    
    // Trigger Retry 1
    await act(async () => {
      jest.advanceTimersByTime(IMAGE_REACTIONS_CONFIG.RETRY_DELAY_MS + 100)
    })
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2), { timeout: 5000 })
    await waitFor(() => expect(result.current.retryCount).toBe(2))
  })

  it('should cancel scheduled retry on unmount', async () => {
    const postId = 'test-unmount-' + Math.random()
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 500 }))

    const { unmount, result } = renderHook(() => useImageReactions(postId))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.retryCount).toBe(1))

    unmount()

    await act(async () => {
      jest.advanceTimersByTime(IMAGE_REACTIONS_CONFIG.RETRY_DELAY_MS * 5)
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should reset retry count and cancel old timeout on manual refetch', async () => {
    const postId = 'test-manual-' + Math.random()
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 500 }))

    const { result } = renderHook(() => useImageReactions(postId))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.retryCount).toBe(1))

    // Wait half-way through the delay
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await act(async () => {
      result.current.refetch()
    })

    // 2nd fetch (manual) should start
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    
    // Advance remaining 500ms of the ORIGINAL delay
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    
    // Should still be at 2 calls (if old one was cleared)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Now advance 500ms more (total 1000ms from 2nd failure)
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    // 3rd fetch (scheduled from 2nd failure) should start
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3))
  })

  it('should skip retry if mutation happens', async () => {
    const postId = 'test-mutation-' + Math.random()
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 500 }))

    const { result } = renderHook(() => useImageReactions(postId))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.retryCount).toBe(1))
    
    await act(async () => {
      updateImageReactionsCache(postId, { 'img1': { totalCount: 1, emojiCounts: { '👍': 1 }, userReaction: '👍' } }, 'success')
    })
    
    await waitFor(() => expect(result.current.data['img1'].totalCount).toBe(1))

    await act(async () => {
      jest.runAllTimers()
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should recover if a retry succeeds', async () => {
    const postId = 'test-recovery-' + Math.random()
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 } as any)
      .mockResolvedValueOnce({ 
        ok: true, 
        json: () => Promise.resolve({ 'img1': { totalCount: 5, emojiCounts: {}, userReaction: null } }) 
      } as any)

    const { result } = renderHook(() => useImageReactions(postId))

    await waitFor(() => expect(result.current.retryCount).toBe(1))

    await act(async () => {
      jest.advanceTimersByTime(IMAGE_REACTIONS_CONFIG.RETRY_DELAY_MS + 100)
    })
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(result.current.data['img1'].totalCount).toBe(5)
    })
    expect(result.current.retryCount).toBe(0)
  })
})
