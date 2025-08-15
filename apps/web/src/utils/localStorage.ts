/**
 * Utility functions for user-specific localStorage operations
 * Ensures proper isolation between different users' data
 */

export const getUserSpecificKey = (userId: string, key: string): string => {
  return `user_${userId}_${key}`;
};

export const getUserReactionsKey = (userId: string): string => {
  return getUserSpecificKey(userId, 'reactions');
};

export const getUserDraftsKey = (userId: string): string => {
  return getUserSpecificKey(userId, 'drafts');
};

export const getUserPreferencesKey = (userId: string): string => {
  return getUserSpecificKey(userId, 'preferences');
};

/**
 * Load user-specific reactions from localStorage
 */
export const loadUserReactions = (userId: string): Record<string, {reaction?: string, hearted?: boolean}> => {
  if (!userId || typeof window === 'undefined') return {};
  
  try {
    const userReactionsKey = getUserReactionsKey(userId);
    const stored = localStorage.getItem(userReactionsKey);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load user reactions:', error);
    return {};
  }
};

/**
 * Save user-specific reactions to localStorage
 */
export const saveUserReactions = (
  userId: string, 
  reactions: Record<string, {reaction?: string, hearted?: boolean}>
): void => {
  if (!userId || typeof window === 'undefined') return;
  
  try {
    const userReactionsKey = getUserReactionsKey(userId);
    localStorage.setItem(userReactionsKey, JSON.stringify(reactions));
  } catch (error) {
    console.error('Failed to save user reactions:', error);
  }
};

/**
 * Clear all user-specific data from localStorage
 */
export const clearUserData = (userId: string): void => {
  if (!userId || typeof window === 'undefined') return;
  
  try {
    const keysToRemove = [
      getUserReactionsKey(userId),
      getUserDraftsKey(userId),
      getUserPreferencesKey(userId)
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear user data:', error);
  }
};

/**
 * Clear generic localStorage keys that might cause cross-user data sharing
 */
export const clearGenericReactionData = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Remove the old generic key that was causing cross-user sharing
    localStorage.removeItem('local_reactions');
  } catch (error) {
    console.error('Failed to clear generic reaction data:', error);
  }
};