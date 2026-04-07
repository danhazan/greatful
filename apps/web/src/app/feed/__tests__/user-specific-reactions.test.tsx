import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { loadUserReactions, saveUserReactions } from '@/utils/localStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('User-specific reactions', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should keep different users reactions completely separate', () => {
    // Simulate User A reacting to posts
    const userAReactions = {
      'post1': { reaction: 'heart' },
      'post2': { reaction: 'pray' },
      'post3': { reaction: 'fire' }
    };
    
    // Simulate User B reacting to the same posts differently
    const userBReactions = {
      'post1': { reaction: 'pray' },
      'post2': { reaction: 'heart' },
      'post3': { reaction: 'muscle' }
    };
    
    // Save reactions for both users
    saveUserReactions('userA', userAReactions);
    saveUserReactions('userB', userBReactions);
    
    // Verify User A's reactions are preserved
    const loadedUserAReactions = loadUserReactions('userA');
    expect(loadedUserAReactions).toEqual(userAReactions);
    expect(loadedUserAReactions['post1'].reaction).toBe('heart');
    
    // Verify User B's reactions are preserved and different
    const loadedUserBReactions = loadUserReactions('userB');
    expect(loadedUserBReactions).toEqual(userBReactions);
    expect(loadedUserBReactions['post1'].reaction).toBe('pray');
    
    // Verify they don't interfere with each other
    expect(loadedUserAReactions).not.toEqual(loadedUserBReactions);
  });

  it('should handle new user with no existing reactions', () => {
    // Set up reactions for existing user
    saveUserReactions('existingUser', { 'post1': { reaction: 'heart' } });
    
    // New user should have empty reactions
    const newUserReactions = loadUserReactions('newUser');
    expect(newUserReactions).toEqual({});
    
    // Existing user's reactions should be unaffected
    const existingUserReactions = loadUserReactions('existingUser');
    expect(existingUserReactions).toEqual({ 'post1': { reaction: 'heart' } });
  });

  it('should handle user updating their own reactions without affecting others', () => {
    // Set up initial reactions for two users
    saveUserReactions('user1', { 'post1': { reaction: 'heart_eyes' } });
    saveUserReactions('user2', { 'post1': { reaction: 'fire' } });
    
    // User 1 updates their reaction
    const updatedUser1Reactions = { 'post1': { reaction: 'pray' } };
    saveUserReactions('user1', updatedUser1Reactions);
    
    // Verify User 1's reactions are updated
    expect(loadUserReactions('user1')).toEqual(updatedUser1Reactions);
    
    // Verify User 2's reactions are unchanged
    expect(loadUserReactions('user2')).toEqual({ 'post1': { reaction: 'fire' } });
  });

  it('should demonstrate global vs individual state concept', () => {
    // Mock post data with global counts (from all users)
    const mockPost = {
      id: 'post1',
      reactionsCount: 18, // Global count from ALL users
    };
    
    // User A's individual state
    const userAReactions = { 'post1': { reaction: 'heart' } };
    saveUserReactions('userA', userAReactions);
    
    // User B's individual state  
    const userBReactions = { 'post1': { reaction: 'fire' } };
    saveUserReactions('userB', userBReactions);
    
    // Simulate how the feed would merge data for User A
    const userAPost = {
      ...mockPost,
      // Global counts stay the same (from server)
      reactionsCount: mockPost.reactionsCount,
      // Individual state from User A's localStorage
      currentUserReaction: userAReactions['post1'].reaction,
    };
    
    // Simulate how the feed would merge data for User B
    const userBPost = {
      ...mockPost,
      // Global counts stay the same (from server)
      reactionsCount: mockPost.reactionsCount,
      // Individual state from User B's localStorage
      currentUserReaction: userBReactions['post1'].reaction,
    };
    
    // Both users see the same global counts
    expect(userAPost.reactionsCount).toBe(18);
    expect(userBPost.reactionsCount).toBe(18);
    
    // But they see their own individual reactions
    expect(userAPost.currentUserReaction).toBe('heart');
    expect(userBPost.currentUserReaction).toBe('fire');
  });
});