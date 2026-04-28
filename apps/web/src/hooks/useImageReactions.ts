import { useState, useEffect, useCallback } from 'react'
import { getAccessToken } from '@/utils/auth'
import { IMAGE_REACTIONS_CONFIG } from '@/config/reactions'

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
  version: number; // Added for strict race detection
  retryCount: number;
  lastAttemptAt: number;
}

// --- Global Data Layer ---

const reactionMapCache = new Map<string, CacheEntry>();
const detailedReactionsCache = new Map<string, { data: Reaction[]; timestamp: number }>();
const pendingFetches = new Map<string, Promise<ImageReactionsMap>>();
const subscribers = new Map<string, Set<(entry: CacheEntry) => void>>();
const pendingRetryTimeouts = new Map<string, any>();

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes hard expiry
const SOFT_CACHE_TTL = 1000 * 60; // 1 minute soft invalidation

// Debug hook for QA in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__IMAGE_REACTION_CACHE__ = {
    summary: reactionMapCache,
    detailed: detailedReactionsCache,
    pending: pendingFetches,
    retryTimeouts: pendingRetryTimeouts,
    subscribers
  };
}

/**
 * Clear any pending retry timers for a specific post
 */
export function clearPendingRetries(postId: string) {
  const timeoutId = pendingRetryTimeouts.get(postId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    pendingRetryTimeouts.delete(postId);
  }
}

/**
 * Update the global cache and notify all active subscribers
 */
export function updateImageReactionsCache(
  postId: string, 
  data: ImageReactionsMap, 
  status: CacheStatus = 'success',
  error?: Error,
  incomingRetryCount?: number
) {
  const current = reactionMapCache.get(postId);
  
  // Clear any existing retries whenever we perform a deliberate status change
  // (Unless this IS a scheduled retry transition to 'idle')
  // We identify scheduled retries by them passing the current retryCount (which is > 0)
  if (incomingRetryCount === undefined || incomingRetryCount === 0) {
    clearPendingRetries(postId);
  }

  // Determine retry count
  let retryCount = incomingRetryCount ?? current?.retryCount ?? 0;
  if (status === 'error' && incomingRetryCount === undefined) {
    retryCount++;
  } else if (status === 'success') {
    retryCount = 0;
  }

  const nextVersion = (current?.version ?? 0) + 1;

  const entry: CacheEntry = {
    data,
    status,
    error,
    timestamp: Date.now(),
    version: nextVersion,
    retryCount,
    lastAttemptAt: status === 'loading' || status === 'error' ? Date.now() : (current?.lastAttemptAt ?? 0)
  };
  
  reactionMapCache.set(postId, entry);
  
  // Notify subscribers
  const postSubscribers = subscribers.get(postId);
  if (postSubscribers) {
    const callbacks = Array.from(postSubscribers);
    callbacks.forEach(callback => {
      try {
        callback(entry);
      } catch (e) {
        console.error('[ImageReactions] Subscriber callback failed', e);
      }
    });
  }

  // Handle scheduled retry
  if (status === 'error' && retryCount <= IMAGE_REACTIONS_CONFIG.MAX_RETRIES) {
    const delay = IMAGE_REACTIONS_CONFIG.RETRY_DELAY_MS * (IMAGE_REACTIONS_CONFIG.RETRY_BACKOFF_FACTOR ** (retryCount - 1));
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ImageReactions] Fetch failed for ${postId}. Retrying in ${delay}ms... (Attempt ${retryCount}/${IMAGE_REACTIONS_CONFIG.MAX_RETRIES})`, error);
    }

    const timeoutId = setTimeout(() => {
      pendingRetryTimeouts.delete(postId);
      const latest = reactionMapCache.get(postId);
      
      // STALE RETRY GUARD
      if (latest && latest.status === 'error' && latest.retryCount === retryCount) {
        updateImageReactionsCache(postId, latest.data, 'idle', undefined, retryCount);
      }
    }, delay);

    pendingRetryTimeouts.set(postId, timeoutId);
  }
}

/**
 * Get current cache entry
 */
export function getImageReactionsFromCache(postId: string): CacheEntry | null {
  const cached = reactionMapCache.get(postId);
  if (!cached) return null;
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
 * Subscribe a component
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
        clearPendingRetries(postId);
      }
    }
  };
}

/**
 * Detailed reactions
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
 * Fetch logic
 */
async function fetchImageReactions(postId: string): Promise<ImageReactionsMap> {
  const existingFetch = pendingFetches.get(postId);
  if (existingFetch) return existingFetch;

  const fetchPromise = (async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/posts/${postId}/image-reactions`, { headers });
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText} (${response.status})`);
      
      return await response.json();
    } finally {
      pendingFetches.delete(postId);
    }
  })();

  pendingFetches.set(postId, fetchPromise);
  return fetchPromise;
}

export function getSubscribersCount(postId: string): number {
  return subscribers.get(postId)?.size || 0;
}

// --- Hook Implementation ---

export function useImageReactions(postId: string, enabled: boolean = true) {
  const [entry, setEntry] = useState<CacheEntry>(() => 
    getImageReactionsFromCache(postId) || { data: {}, status: 'idle', timestamp: 0, version: 0, retryCount: 0, lastAttemptAt: 0 }
  );

  // Synchronization effect
  useEffect(() => {
    if (!postId) return;
    
    // Initial sync
    const current = getImageReactionsFromCache(postId);
    if (current) {
      setEntry(current);
    }

    return subscribeToImageReactions(postId, (newEntry) => {
      setEntry(newEntry);
    });
  }, [postId]); // FIXED: Removed entry.timestamp and entry.status dependencies to prevent redundant resubscriptions

  // Fetch effect
  useEffect(() => {
    const isIdle = entry.status === 'idle';
    const isSuccess = entry.status === 'success';
    const isStale = isSuccess && entry.timestamp > 0 && Date.now() - entry.timestamp > SOFT_CACHE_TTL;

    if (!enabled || !postId || (!isIdle && !isStale) || entry.status === 'loading') {
      return;
    }

    updateImageReactionsCache(postId, entry.data, 'loading');
    
    // Capture the version of the loading status we just set
    const loadingVersion = getImageReactionsFromCache(postId)?.version || 0;

    fetchImageReactions(postId)
      .then(data => {
        // RACE CHECK: Only update if no other mutation/fetch happened in the meantime
        const current = getImageReactionsFromCache(postId);
        if (current && current.version > loadingVersion) {
          return;
        }
        updateImageReactionsCache(postId, data, 'success');
      })
      .catch(err => {
        const current = getImageReactionsFromCache(postId);
        if (current && current.version > loadingVersion) {
          return;
        }
        updateImageReactionsCache(postId, entry.data, 'error', err);
      });
  }, [enabled, postId, entry.status, entry.timestamp]); // entry.timestamp is needed for staleness check

  const getReactionForImage = useCallback((imageId: string): ReactionSummaryData => {
    return entry.data[imageId] || { totalCount: 0, emojiCounts: {}, userReaction: null, reactions: [] };
  }, [entry.data]);

  return {
    data: entry.data,
    isLoading: entry.status === 'loading',
    error: entry.error,
    retryCount: entry.retryCount,
    getReactionForImage,
    refetch: () => {
      updateImageReactionsCache(postId, entry.data, 'idle', undefined, 0);
    }
  };
}
