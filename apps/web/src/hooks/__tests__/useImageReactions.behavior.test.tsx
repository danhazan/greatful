import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useImageReactions, updateImageReactionsCache } from '../useImageReactions';
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
  });

  it('Cache reuse on reopen: skips fetch if cache hits', async () => {
    const mockPostId = 'test-post-123';
    
    // Pre-populate cache directly
    updateImageReactionsCache(mockPostId, {
      'image-1': { totalCount: 1, emojiCounts: { 'heart': 1 }, userReaction: 'heart', reactions: [] }
    });

    const { result } = renderHook(() => useImageReactions(mockPostId));

    // Should load synchronously from cache
    expect(result.current.isLoading).toBe(false);
    expect(result.current.getReactionForImage('image-1').totalCount).toBe(1);
    
    // Fetch should NOT be called since data was freshly cached
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('Critical Edge Case: Fetch resolves -> ensure reaction is NOT overwritten if optimistic mutation occurred', async () => {
    const mockPostId = 'test-post-456';
    
    // Simulate slow network fetch
    let resolveRef: (value: any) => void = () => {};
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => {
        resolveRef = resolve;
      }) as any
    );

    const { result } = renderHook(() => useImageReactions(mockPostId));
    expect(result.current.isLoading).toBe(true);
    
    // At this point, fetch has started...
    
    // User performs optimistic mutation (heart) using safeForceSetData
    act(() => {
      result.current.forceSetData({
        'image-1': { totalCount: 5, emojiCounts: { 'heart': 5 }, userReaction: 'heart', reactions: [] }
      });
    });

    // Validating UI optimistic state
    expect(result.current.getReactionForImage('image-1').totalCount).toBe(5);

    // Finally, the slow fetch resolves with STALE data (totalCount 3, no heart)
    await act(async () => {
      resolveRef({
        ok: true,
        json: async () => ({
          'image-1': { totalCount: 3, emojiCounts: { 'smile': 3 }, userReaction: null, reactions: [] }
        })
      });
    });

    // Verification: Data should REMAIN what we optimistically set (5), ignoring the stale fetch result!
    expect(result.current.getReactionForImage('image-1').totalCount).toBe(5);
    expect(result.current.getReactionForImage('image-1').userReaction).toBe('heart');
  });

  it('Loading state blocks interaction logically when there is no cache', async () => {
    const mockPostId = 'test-post-789';
    
    // Simulate slow fetch
    mockFetch.mockImplementationOnce(() => new Promise(() => {}) as any);

    const { result } = renderHook(() => useImageReactions(mockPostId));
    
    expect(result.current.isLoading).toBe(true);
    // Implicit interaction block: UI component reads isLoading and sets `disabled={isLoadingReactions}`
    expect(result.current.getReactionForImage('image-1').totalCount).toBe(0);
  });

  it('Integration: Authenticated request sends Authorization header', async () => {
    const mockPostId = 'test-post-auth';
    const mockToken = 'mock-bearer-token';
    mockGetAccessToken.mockReturnValue(mockToken);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as any);

    await act(async () => {
      renderHook(() => useImageReactions(mockPostId));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/posts/${mockPostId}/image-reactions`),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`
        })
      })
    );
  });
});
