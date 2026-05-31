import { useRef, useCallback } from 'react';
import { useOptimisticMutation } from './useOptimisticMutation';
import {
  updateImageReactionsCache,
  getImageReactionsMapFromCache,
  updateCommentReactionsCache,
  getCommentReactionsMapFromCache,
  invalidateDetailedReactionsCache,
  type ReactionSummaryData,
  type ImageReactionsMap,
  type CommentReactionsMap
} from './useImageReactions';
import { apiClient } from '@/utils/apiClient';

export interface ReactionMutationOptions {
  postId: string;
  objectType: 'post' | 'image' | 'comment';
  objectId: string;
  /** Current state snapshot injected from parent (post state or image map state) */
  currentReactionState: ReactionSummaryData;
}

export function useReactionMutation({
  postId,
  objectType,
  objectId,
  currentReactionState
}: ReactionMutationOptions) {
  
  // Ref to hold the interaction intent (null means delete, string means add/update)
  const pendingEmojiRef = useRef<string | null>(null);

  const computeNewState = (emojiCode: string | null): ReactionSummaryData => {
    const { totalCount, emojiCounts, userReaction, reactions } = currentReactionState;
    const newEmojiCounts = { ...emojiCounts };
    let newTotal = totalCount;

    // Remove old reaction mapping
    if (userReaction) {
      newEmojiCounts[userReaction] = Math.max(0, (newEmojiCounts[userReaction] || 1) - 1);
      if (newEmojiCounts[userReaction] === 0) delete newEmojiCounts[userReaction];
      newTotal = Math.max(0, newTotal - 1);
    }

    // Add new reaction mapping
    if (emojiCode) {
      newEmojiCounts[emojiCode] = (newEmojiCounts[emojiCode] || 0) + 1;
      newTotal += 1;
    }

    return {
      ...currentReactionState,
      totalCount: newTotal,
      emojiCounts: newEmojiCounts,
      userReaction: emojiCode,
      // Reactions array typically doesn't need eager pushing unless displaying detailed modal immediately,
      // which we don't. The summary block is enough.
      reactions: reactions || [] 
    };
  };

  const syncGlobalCaches = (newState: ReactionSummaryData) => {
    // 1. If it's an image, update the multi-image summary cache
    if (objectType === 'image') {
      const currentCache = getImageReactionsMapFromCache(postId) || {};
      const newCache: ImageReactionsMap = {
        ...currentCache,
        [objectId]: newState
      };
      updateImageReactionsCache(postId, newCache);
    }

    if (objectType === 'comment') {
      const currentCache = getCommentReactionsMapFromCache(postId) || {};
      const newCache: CommentReactionsMap = {
        ...currentCache,
        [objectId]: newState
      };
      updateCommentReactionsCache(postId, newCache);
    }

    // 2. ALWAYS invalidate the detailed User List cache for this specific object
    const detailCacheKey = `${postId}:${objectType}:${objectId || 'none'}`;
    invalidateDetailedReactionsCache(detailCacheKey);

    // 3. Invalidate URL-based cache so ReactionViewer fetches fresh data
    apiClient.invalidateCache(`/posts/${postId}/reactions`);
  };

  const mutation = useOptimisticMutation<ReactionSummaryData, void>({
    getSnapshot: () => currentReactionState,
    applyOptimistic: () => {
      const emojiCode = pendingEmojiRef.current;
      const newState = computeNewState(emojiCode);
      
      // Update DB caches directly — this notifies hook subscribers and clears stale user lists
      syncGlobalCaches(newState);
    },
    apiCall: async (signal) => {
      const emojiCode = pendingEmojiRef.current;
      
      if (emojiCode === null) {
        const params = new URLSearchParams();
        if (objectType !== 'post') {
          params.append('object_type', objectType);
          params.append('object_id', objectId);
        }
        
        const res = await apiClient.requestRaw(`/posts/${postId}/reactions?${params.toString()}`, {
          method: 'DELETE',
          signal
        });
        
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Removal failed");
        }
      } else {
        const res = await apiClient.requestRaw(`/posts/${postId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emoji_code: emojiCode,
            object_type: objectType,
            object_id: objectId
          }),
          signal
        });
        
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Addition failed");
        }
      }
    },
    errorTitle: 'Reaction failed',
    errorMessage: (err) => err.message || 'Could not update your reaction. Please try again.',
    rollback: (snapshot) => {
      syncGlobalCaches(snapshot);
    },
    skipDebugToast: true
  });

  const handleReaction = useCallback((emojiCode: string | null) => {
    // If null is passed or it matches the current reaction, we remove it
    if (emojiCode === null || currentReactionState.userReaction === emojiCode) {
      pendingEmojiRef.current = null;
    } else {
      pendingEmojiRef.current = emojiCode;
    }
    
    mutation.execute();
  }, [currentReactionState.userReaction, mutation]);

  return { handleReaction, isInFlight: mutation.isInFlight };
}
