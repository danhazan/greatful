import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useImageReactions, updateImageReactionsCache, getImageReactionsFromCache, getSubscribersCount } from '../useImageReactions';
import * as auth from '@/utils/auth';

// Mock auth utils
jest.mock('@/utils/auth', () => ({
  getAccessToken: jest.fn(),
}));

const mockGetAccessToken = auth.getAccessToken as jest.MockedFunction<typeof auth.getAccessToken>;

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('useImageReactions (@behavior)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the internal module cache between tests if possible, 
    // but since it's a module-level variable, we just use different IDs or manually clear it
  });

  it('Cache reuse: returns success status immediately if cache hits', async () => {
    const mockPostId = 'test-post-123';
    const mockData = {
      'image-1': { totalCount: 1, emojiCounts: { 'heart': 1 }, userReaction: 'heart', reactions: [] }
    };
    
    // Pre-populate cache directly
    updateImageReactionsCache(mockPostId, mockData);

    const { result } = renderHook(() => useImageReactions(mockPostId));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.getReactionForImage('image-1').totalCount).toBe(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('Reactive Subscription: updates hook state when cache is updated externally', async () => {
    const mockPostId = 'test-post-sub';
    const { result } = renderHook(() => useImageReactions(mockPostId, false));

    expect(result.current.getReactionForImage('image-1').totalCount).toBe(0);

    const newData = {
      'image-1': { totalCount: 5, emojiCounts: { 'heart': 5 }, userReaction: 'heart', reactions: [] }
    };

    act(() => {
      updateImageReactionsCache(mockPostId, newData);
    });

    expect(result.current.getReactionForImage('image-1').totalCount).toBe(5);
  });

  it('Strict Mode Deduplication: only one fetch fires even on multiple mounts', async () => {
    const mockPostId = 'test-post-dedup';
    mockFetch.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({
        ok: true,
        json: async () => ({})
      }), 10);
    }) as any);

    const { rerender } = renderHook(() => useImageReactions(mockPostId, true));
    
    // Rerender/Double mount simulation
    await act(async () => {
      rerender();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('Optimistic Integrity: latest cache write (mutation) wins over stale fetch', async () => {
    const mockPostId = 'test-post-race';
    
    let resolveFetch: (val: any) => void = () => {};
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }) as any);

    const { result } = renderHook(() => useImageReactions(mockPostId, true));
    expect(result.current.isLoading).toBe(true);

    // Perform optimistic update while fetch is pending
    const optimisticData = {
      'image-1': { totalCount: 10, emojiCounts: { 'heart': 10 }, userReaction: 'heart', reactions: [] }
    };
    
    act(() => {
      updateImageReactionsCache(mockPostId, optimisticData);
    });

    expect(result.current.getReactionForImage('image-1').totalCount).toBe(10);

    // Resolve the stale fetch with different data
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          'image-1': { totalCount: 2, emojiCounts: { 'smile': 2 }, userReaction: null, reactions: [] }
        })
      });
    });

    // Verification: Optimistic data (10) should STILL be there, NOT overwritten by the stale fetch (2)!
    expect(result.current.getReactionForImage('image-1').totalCount).toBe(10);
    expect(result.current.getReactionForImage('image-1').userReaction).toBe('heart');
  });

  it('Subscription Lifecycle: cleans up on unmount and prevents duplicates on remount', async () => {
    const mockPostId = 'lifecycle-test';
    
    // 1. Mount first instance
    const { unmount } = renderHook(() => useImageReactions(mockPostId, false));
    expect(getSubscribersCount(mockPostId)).toBe(1);
    
    // 2. Unmount first instance
    unmount();
    expect(getSubscribersCount(mockPostId)).toBe(0);
    
    // 3. Mount second instance
    const { result } = renderHook(() => useImageReactions(mockPostId, false));
    expect(getSubscribersCount(mockPostId)).toBe(1);
    
    // 4. Trigger cache update
    act(() => {
      updateImageReactionsCache(mockPostId, {
        'img': { totalCount: 1, emojiCounts: {}, userReaction: null }
      });
    });
    
    expect(result.current.getReactionForImage('img').totalCount).toBe(1);
  });
});
