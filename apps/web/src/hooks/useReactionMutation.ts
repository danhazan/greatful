import { useRef, useCallback } from 'react';
import { useOptimisticMutation } from './useOptimisticMutation';
import { updateImageReactionsCache, getImageReactionsMapFromCache, type ReactionSummaryData, type ImageReactionsMap } from './useImageReactions';
import { getAccessToken } from '@/utils/auth';

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

  const applyToCacheIfImage = (newState: ReactionSummaryData) => {
    if (objectType !== 'image') return;
    const currentCache = getImageReactionsMapFromCache(postId) || {};
    const newCache: ImageReactionsMap = {
      ...currentCache,
      [objectId]: newState
    };
    updateImageReactionsCache(postId, newCache);
  };

  const mutation = useOptimisticMutation<ReactionSummaryData, void>({
    getSnapshot: () => currentReactionState,
    applyOptimistic: () => {
      const emojiCode = pendingEmojiRef.current;
      const newState = computeNewState(emojiCode);
      
      // Update DB cache directly strictly — this will notify all hook subscribers
      applyToCacheIfImage(newState);
    },
    apiCall: async (signal) => {
      const emojiCode = pendingEmojiRef.current;
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      if (emojiCode === null) {
        // DELETE operation
        const params = new URLSearchParams();
        if (objectType !== 'post') {
          params.append('objectType', objectType);
          params.append('objectId', objectId);
        }
        
        const res = await fetch(`/api/posts/${postId}/reactions?${params.toString()}`, {
          method: 'DELETE',
          headers,
          signal
        });
        
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Removal failed");
        }
      } else {
        // POST/PUT operation
        headers['Content-Type'] = 'application/json';
        const res = await fetch(`/api/posts/${postId}/reactions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            emojiCode,
            objectType,
            objectId
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
      applyToCacheIfImage(snapshot);
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
