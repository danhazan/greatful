import { useState, useEffect, useCallback } from 'react'
import { getAccessToken } from '@/utils/auth'

export interface ReactionSummaryData {
  totalCount: number;
  emojiCounts: Record<string, number>;
  userReaction: string | null;
  reactions?: any[];
}

export interface Reaction {
  id: string
  userId: string | number
  userName: string
  userImage?: string
  emojiCode: string
  createdAt: string
}

export type ImageReactionsMap = Record<string, ReactionSummaryData>;

type CacheStatus = 'idle' | 'loading' | 'success' | 'error';

interface CacheEntry {
  data: ImageReactionsMap;
  status: CacheStatus;
  error?: Error;
  timestamp: number;
}

// --- Global Data Layer ---

const reactionMapCache = new Map<string, CacheEntry>();
const detailedReactionsCache = new Map<string, { data: Reaction[]; timestamp: number }>();
const pendingFetches = new Map<string, Promise<ImageReactionsMap>>();
const subscribers = new Map<string, Set<(entry: CacheEntry) => void>>();

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes hard expiry
const SOFT_CACHE_TTL = 1000 * 60; // 1 minute soft invalidation

/**
 * Update the global cache and notify all active subscribers
 */
export function updateImageReactionsCache(
  postId: string, 
  data: ImageReactionsMap, 
  status: CacheStatus = 'success',
  error?: Error
) {
  const entry: CacheEntry = {
    data,
    status,
    error,
    timestamp: Date.now()
  };
  
  reactionMapCache.set(postId, entry);
  
  // Notify subscribers
  const postSubscribers = subscribers.get(postId);
  if (postSubscribers) {
    postSubscribers.forEach(callback => callback(entry));
  }
}

/**
 * Get current cache entry, handling TTL expiration
 */
export function getImageReactionsFromCache(postId: string): CacheEntry | null {
  const cached = reactionMapCache.get(postId);
  if (!cached) return null;
  
  // Expiration check
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    reactionMapCache.delete(postId);
    return null;
  }
  
  return cached;
}

/**
 * Helper to get just the data map from cache
 */
export function getImageReactionsMapFromCache(postId: string): ImageReactionsMap | null {
  const entry = getImageReactionsFromCache(postId);
  return entry ? entry.data : null;
}

/**
 * Subscribe a component to cache updates for a specific postId
 */
function subscribeToImageReactions(postId: string, callback: (entry: CacheEntry) => void) {
  if (!subscribers.has(postId)) {
    subscribers.set(postId, new Set());
  }
  subscribers.get(postId)!.add(callback);
  
  return () => {
    const postSubscribers = subscribers.get(postId);
    if (postSubscribers) {
      postSubscribers.delete(callback);
      if (postSubscribers.size === 0) {
        subscribers.delete(postId);
      }
    }
  };
}

/**
 * For testing purposes only: Get total subscribers for a post
 */
export function getSubscribersCount(postId: string): number {
  return subscribers.get(postId)?.size || 0;
}

/**
 * Helpers for detailed reaction list (ReactionViewer)
 */
export function getDetailedReactionsFromCache(key: string): Reaction[] | null {
  const cached = detailedReactionsCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    detailedReactionsCache.delete(key);
    return null;
  }
  return cached.data;
}

export function updateDetailedReactionsCache(key: string, data: Reaction[]) {
  detailedReactionsCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateDetailedReactionsCache(key: string) {
  detailedReactionsCache.delete(key);
}

/**
 * Deduplicated fetch logic
 */
async function fetchImageReactions(postId: string): Promise<ImageReactionsMap> {
  // If a fetch is already in flight for this post, reuse its promise
  const existingFetch = pendingFetches.get(postId);
  if (existingFetch) return existingFetch;

  const fetchPromise = (async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/posts/${postId}/image-reactions`, { headers });
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      
      return await response.json();
    } finally {
      // Clean up the map so future manual refetches can proceed
      pendingFetches.delete(postId);
    }
  })();

  pendingFetches.set(postId, fetchPromise);
  return fetchPromise;
}

// --- Hook Implementation ---

export function useImageReactions(postId: string, enabled: boolean = true) {
  const [entry, setEntry] = useState<CacheEntry>(() => 
    getImageReactionsFromCache(postId) || { data: {}, status: 'idle', timestamp: 0 }
  );

  // 1. Subscription: Keep local state in sync with global cache
  useEffect(() => {
    if (!postId) return;
    
    // Sync immediately in case cache was updated between initialization and effect
    const current = getImageReactionsFromCache(postId);
    if (current) setEntry(current);

    return subscribeToImageReactions(postId, (newEntry) => {
      setEntry(newEntry);
    });
  }, [postId]);

  // 2. Lifecycle: Trigger lazy fetching
  useEffect(() => {
    if (!enabled || !postId || entry.status === 'loading') {
      return;
    }

    const isStale = Date.now() - entry.timestamp > SOFT_CACHE_TTL;
    if (entry.status === 'success' && !isStale) {
      return;
    }

    const startTimestamp = entry.timestamp;

    // Mark as loading globally so other hooks don't start a second request
    updateImageReactionsCache(postId, entry.data, 'loading');

    fetchImageReactions(postId)
      .then(data => {
        // RACE CHECK: Only update if no other mutation/fetch happened in the meantime
        const current = getImageReactionsFromCache(postId);
        if (current && current.timestamp > startTimestamp && current.status !== 'loading') {
          return;
        }
        updateImageReactionsCache(postId, data, 'success');
      })
      .catch(err => {
        const current = getImageReactionsFromCache(postId);
        if (current && current.timestamp > startTimestamp && current.status !== 'loading') {
          return;
        }
        updateImageReactionsCache(postId, entry.data, 'error', err);
      });
  }, [enabled, postId, entry.status, entry.data, entry.timestamp]);

  const getReactionForImage = useCallback((imageId: string): ReactionSummaryData => {
    return entry.data[imageId] || { totalCount: 0, emojiCounts: {}, userReaction: null, reactions: [] };
  }, [entry.data]);

  return {
    data: entry.data,
    isLoading: entry.status === 'loading',
    error: entry.error,
    getReactionForImage,
    refetch: () => {
      updateImageReactionsCache(postId, entry.data, 'idle');
    }
  };
}
