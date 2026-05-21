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
export type CommentReactionsMap = Record<string, ReactionSummaryData>;

type CacheStatus = 'idle' | 'loading' | 'success' | 'error';

interface CacheEntry {
  data: ImageReactionsMap;
  status: CacheStatus;
  error?: Error;
  timestamp: number;
  version: number;
  retryCount: number;
  lastAttemptAt: number;
}

const CACHE_TTL = 1000 * 60 * 5;
const SOFT_CACHE_TTL = 1000 * 60;
const createEmptyEntry = (): CacheEntry => ({
  data: {},
  status: 'idle',
  timestamp: 0,
  version: 0,
  retryCount: 0,
  lastAttemptAt: 0
})

const detailedReactionsCache = new Map<string, { data: Reaction[]; timestamp: number }>();

function createSummaryStore(name: string, endpointForPost: (postId: string) => string) {
  const summaryCache = new Map<string, CacheEntry>();
  const pendingFetches = new Map<string, Promise<ImageReactionsMap>>();
  const subscribers = new Map<string, Set<(entry: CacheEntry) => void>>();
  const pendingRetryTimeouts = new Map<string, any>();

  const clearPendingRetries = (postId: string) => {
    const timeoutId = pendingRetryTimeouts.get(postId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pendingRetryTimeouts.delete(postId);
    }
  };

  const updateCache = (
    postId: string,
    data: ImageReactionsMap,
    status: CacheStatus = 'success',
    error?: Error,
    incomingRetryCount?: number
  ) => {
    const current = summaryCache.get(postId);

    if (incomingRetryCount === undefined || incomingRetryCount === 0) {
      clearPendingRetries(postId);
    }

    let retryCount = incomingRetryCount ?? current?.retryCount ?? 0;
    if (status === 'error' && incomingRetryCount === undefined) {
      retryCount++;
    } else if (status === 'success') {
      retryCount = 0;
    }

    const entry: CacheEntry = {
      data,
      status,
      error,
      timestamp: Date.now(),
      version: (current?.version ?? 0) + 1,
      retryCount,
      lastAttemptAt: status === 'loading' || status === 'error' ? Date.now() : (current?.lastAttemptAt ?? 0)
    };

    summaryCache.set(postId, entry);

    const callbacks = Array.from(subscribers.get(postId) || []);
    callbacks.forEach(callback => {
      try {
        callback(entry);
      } catch (e) {
        console.error(`[${name}] Subscriber callback failed`, e);
      }
    });

    if (status === 'error' && retryCount <= IMAGE_REACTIONS_CONFIG.MAX_RETRIES) {
      const delay = IMAGE_REACTIONS_CONFIG.RETRY_DELAY_MS * (IMAGE_REACTIONS_CONFIG.RETRY_BACKOFF_FACTOR ** (retryCount - 1));

      if (process.env.NODE_ENV === 'development') {
        console.warn(`[${name}] Fetch failed for ${postId}. Retrying in ${delay}ms... (Attempt ${retryCount}/${IMAGE_REACTIONS_CONFIG.MAX_RETRIES})`, error);
      }

      const timeoutId = setTimeout(() => {
        pendingRetryTimeouts.delete(postId);
        const latest = summaryCache.get(postId);
        if (latest && latest.status === 'error' && latest.retryCount === retryCount) {
          updateCache(postId, latest.data, 'idle', undefined, retryCount);
        }
      }, delay);

      pendingRetryTimeouts.set(postId, timeoutId);
    }
  };

  const getEntry = (postId: string): CacheEntry | null => {
    const cached = summaryCache.get(postId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      summaryCache.delete(postId);
      return null;
    }
    return cached;
  };

  const getMap = (postId: string): ImageReactionsMap | null => {
    const entry = getEntry(postId);
    return entry ? entry.data : null;
  };

  const subscribe = (postId: string, callback: (entry: CacheEntry) => void) => {
    if (!subscribers.has(postId)) {
      subscribers.set(postId, new Set());
    }
    subscribers.get(postId)!.add(callback);

    return () => {
      const postSubscribers = subscribers.get(postId);
      if (!postSubscribers) return;
      postSubscribers.delete(callback);
      if (postSubscribers.size === 0) {
        subscribers.delete(postId);
        clearPendingRetries(postId);
      }
    };
  };

  const fetchSummaries = async (postId: string): Promise<ImageReactionsMap> => {
    const existingFetch = pendingFetches.get(postId);
    if (existingFetch) return existingFetch;

    const fetchPromise = (async () => {
      try {
        const token = getAccessToken();
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpointForPost(postId), { headers });
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText} (${response.status})`);

        return await response.json();
      } finally {
        pendingFetches.delete(postId);
      }
    })();

    pendingFetches.set(postId, fetchPromise);
    return fetchPromise;
  };

  const useSummaries = (postId: string, enabled: boolean = true) => {
    const [entry, setEntry] = useState<CacheEntry>(() =>
      getEntry(postId) || createEmptyEntry()
    );

    useEffect(() => {
      if (!postId) return;

      const current = getEntry(postId);
      if (current) setEntry(current);

      return subscribe(postId, setEntry);
    }, [postId]);

    useEffect(() => {
      const isIdle = entry.status === 'idle';
      const isSuccess = entry.status === 'success';
      const isStale = isSuccess && entry.timestamp > 0 && Date.now() - entry.timestamp > SOFT_CACHE_TTL;

      if (!enabled || !postId || (!isIdle && !isStale) || entry.status === 'loading') {
        return;
      }

      updateCache(postId, entry.data, 'loading');
      const loadingVersion = getEntry(postId)?.version || 0;

      fetchSummaries(postId)
        .then(data => {
          const current = getEntry(postId);
          if (current && current.version > loadingVersion) return;
          updateCache(postId, data, 'success');
        })
        .catch(err => {
          const current = getEntry(postId);
          if (current && current.version > loadingVersion) return;
          updateCache(postId, entry.data, 'error', err);
        });
    }, [enabled, postId, entry.status, entry.timestamp, entry.data]);

    const getReactionForObject = useCallback((objectId: string): ReactionSummaryData => {
      return entry.data[objectId] || { totalCount: 0, emojiCounts: {}, userReaction: null, reactions: [] };
    }, [entry.data]);

    return {
      data: entry.data,
      isLoading: entry.status === 'loading',
      error: entry.error,
      retryCount: entry.retryCount,
      getReactionForObject,
      refetch: () => {
        updateCache(postId, entry.data, 'idle', undefined, 0);
      }
    };
  };

  return {
    summaryCache,
    detailed: {
      pendingFetches,
      pendingRetryTimeouts,
      subscribers
    },
    updateCache,
    getEntry,
    getMap,
    clearPendingRetries,
    getSubscribersCount: (postId: string) => subscribers.get(postId)?.size || 0,
    useSummaries
  };
}

const imageStore = createSummaryStore('ImageReactions', postId => `/api/posts/${postId}/image-reactions`);
const commentStore = createSummaryStore('CommentReactions', postId => `/api/posts/${postId}/comment-reactions`);

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__IMAGE_REACTION_CACHE__ = {
    summary: imageStore.summaryCache,
    detailed: detailedReactionsCache,
    pending: imageStore.detailed.pendingFetches,
    retryTimeouts: imageStore.detailed.pendingRetryTimeouts,
    subscribers: imageStore.detailed.subscribers
  };
  (window as any).__COMMENT_REACTION_CACHE__ = {
    summary: commentStore.summaryCache,
    detailed: detailedReactionsCache,
    pending: commentStore.detailed.pendingFetches,
    retryTimeouts: commentStore.detailed.pendingRetryTimeouts,
    subscribers: commentStore.detailed.subscribers
  };
}

export function clearPendingRetries(postId: string) {
  imageStore.clearPendingRetries(postId);
}

export function clearPendingCommentRetries(postId: string) {
  commentStore.clearPendingRetries(postId);
}

export function updateImageReactionsCache(
  postId: string,
  data: ImageReactionsMap,
  status: CacheStatus = 'success',
  error?: Error,
  incomingRetryCount?: number
) {
  imageStore.updateCache(postId, data, status, error, incomingRetryCount);
}

export function updateCommentReactionsCache(
  postId: string,
  data: CommentReactionsMap,
  status: CacheStatus = 'success',
  error?: Error,
  incomingRetryCount?: number
) {
  commentStore.updateCache(postId, data, status, error, incomingRetryCount);
}

export function getImageReactionsFromCache(postId: string): CacheEntry | null {
  return imageStore.getEntry(postId);
}

export function getCommentReactionsFromCache(postId: string): CacheEntry | null {
  return commentStore.getEntry(postId);
}

export function getImageReactionsMapFromCache(postId: string): ImageReactionsMap | null {
  return imageStore.getMap(postId);
}

export function getCommentReactionsMapFromCache(postId: string): CommentReactionsMap | null {
  return commentStore.getMap(postId);
}

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

export function getSubscribersCount(postId: string): number {
  return imageStore.getSubscribersCount(postId);
}

export function getCommentSubscribersCount(postId: string): number {
  return commentStore.getSubscribersCount(postId);
}

export function useImageReactions(postId: string, enabled: boolean = true) {
  const result = imageStore.useSummaries(postId, enabled);
  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    retryCount: result.retryCount,
    getReactionForImage: result.getReactionForObject,
    refetch: result.refetch
  };
}

export function useCommentReactions(postId: string, enabled: boolean = true) {
  const result = commentStore.useSummaries(postId, enabled);
  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    retryCount: result.retryCount,
    getReactionForComment: result.getReactionForObject,
    refetch: result.refetch
  };
}
