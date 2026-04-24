import { useState, useEffect, useRef, useCallback } from 'react'
import { getAccessToken } from '@/utils/auth'

export interface ReactionSummaryData {
  totalCount: number;
  emojiCounts: Record<string, number>;
  userReaction: string | null;
  reactions?: any[];
}

export type ImageReactionsMap = Record<string, ReactionSummaryData>;

// Global memory cache to reuse across unmounts/remounts
const reactionMapCache = new Map<string, { data: ImageReactionsMap; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export function updateImageReactionsCache(postId: string, newData: ImageReactionsMap) {
  reactionMapCache.set(postId, { data: newData, timestamp: Date.now() });
}

export function getImageReactionsFromCache(postId: string): ImageReactionsMap | null {
  const cached = reactionMapCache.get(postId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    reactionMapCache.delete(postId);
    return null;
  }
  return cached.data;
}

export function useImageReactions(postId: string) {
  const [data, setData] = useState<ImageReactionsMap>(() => getImageReactionsFromCache(postId) || {});
  const [isLoading, setIsLoading] = useState<boolean>(!getImageReactionsFromCache(postId));
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMutationTimeRef = useRef<number>(0);

  // Expose a safe force-set that updates the mutation timestamp
  const safeForceSetData = useCallback((updater: React.SetStateAction<ImageReactionsMap>) => {
    lastMutationTimeRef.current = Date.now();
    setData(updater);
  }, []);

  const fetchReactions = useCallback(async () => {
    const cached = getImageReactionsFromCache(postId);
    // If not cached, we load. If cached, we skip fetch to prevent race conditions during rapid reopen
    if (cached) {
      setData(cached);
      return;
    }

    setIsLoading(true);

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const fetchStartTime = Date.now();

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/posts/${postId}/image-reactions`, {
        headers,
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to fetch image reactions');
      }

      const jsonData = await response.json();
      
      // Strategy: Ignore fetch if optimistic mutation occurred while fetching
      setData(prev => {
        if (lastMutationTimeRef.current > fetchStartTime) {
          // A mutation happened during this fetch. The local optimistic state is the source of truth now.
          // We safely discard this fetch result to prevent overwriting the user reaction.
          return prev;
        }
        
        // Otherwise, update external cache and internal state safely
        updateImageReactionsCache(postId, jsonData);
        return jsonData;
      });
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchReactions();
    return () => {
      // Abort only the fetch cycle when unmounted
      abortControllerRef.current?.abort();
    };
  }, [fetchReactions]);

  /** Helper to safely get data for an image */
  const getReactionForImage = useCallback((imageId: string): ReactionSummaryData => {
    return data[imageId] || { totalCount: 0, emojiCounts: {}, userReaction: null, reactions: [] };
  }, [data]);

  return {
    data,
    isLoading,
    error,
    getReactionForImage,
    refetch: fetchReactions,
    // Provide a way for the mutation to forcibly override state when pushing optimistics
    forceSetData: safeForceSetData
  };
}
