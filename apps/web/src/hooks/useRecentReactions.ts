import { useState, useEffect, useCallback } from 'react';
import { ReactionGroup } from '@/generated/reactions';
import { loadRecentReactions, saveRecentReactions, addRecentReactionToMap } from '@/utils/reactionRecents';

export type RecentReactionsMap = Record<ReactionGroup, string[]>;

interface UseRecentReactionsReturn {
  recentReactions: RecentReactionsMap;
  addRecentReaction: (group: ReactionGroup, emojiCode: string) => void;
  isLoading: boolean;
}

export function useRecentReactions(): UseRecentReactionsReturn {
  const [recentReactions, setRecentReactions] = useState<RecentReactionsMap>(() => {
    return loadRecentReactions();
  });
  const [isLoading, setIsLoading] = useState(false);

  // Sync to localStorage whenever state changes
  useEffect(() => {
    saveRecentReactions(recentReactions);
  }, [recentReactions]);

  const addRecentReaction = useCallback((group: ReactionGroup, emojiCode: string) => {
    setRecentReactions(prev => addRecentReactionToMap(prev, group, emojiCode));
  }, []);

  return { recentReactions, addRecentReaction, isLoading };
}
