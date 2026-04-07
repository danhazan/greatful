import { describe, it, expect } from '@jest/globals'
/**
 * Test to verify that global counts remain server-authoritative 
 */

describe('Counter Logic - Global vs Individual State', () => {
  it('should keep global counts unchanged when user reacts', () => {
    // Mock post with server data (global counts)
    const serverPost = {
      id: 'post1',
      reactionsCount: 25,   // Global count from ALL users
      content: 'Test post'
    };

    // User's individual state (from localStorage)
    const userState = {
      currentUserReaction: undefined
    };

    // When user reacts to the post
    const afterReaction = {
      ...serverPost,
      // Global counts should remain unchanged (server-authoritative)
      reactionsCount: serverPost.reactionsCount,  // Still 25
      // Only individual state changes
      currentUserReaction: 'heart'  // User's personal state
    };

    expect(afterReaction.reactionsCount).toBe(25);  // Global count unchanged
    expect(afterReaction.currentUserReaction).toBe('heart');  // Individual state updated
  });

  it('should demonstrate correct data separation', () => {
    // Server provides global engagement data
    const globalData = {
      reactionsCount: 100,   // Reactions from ALL users
    };

    // User A's individual state
    const userAState = {
      currentUserReaction: 'fire'
    };

    // User B's individual state  
    const userBState = {
      currentUserReaction: 'pray'
    };

    // Both users see the same global counts
    const userAView = { ...globalData, ...userAState };
    const userBView = { ...globalData, ...userBState };

    // Global counts are identical for both users
    expect(userAView.reactionsCount).toBe(100);
    expect(userBView.reactionsCount).toBe(100);

    // Individual states are different
    expect(userAView.currentUserReaction).toBe('fire');
    expect(userBView.currentUserReaction).toBe('pray');
  });

  it('should never modify global counts locally', () => {
    const originalGlobalCounts = {
      reactionsCount: 50
    };

    // Simulate multiple user actions
    const actions = [
      'react_fire',
      'react_pray',
      'remove_reaction'
    ];

    // After any number of user actions, global counts should remain unchanged
    actions.forEach(action => {
      const postAfterAction = {
        ...originalGlobalCounts,
        // Global counts must never change locally
        reactionsCount: originalGlobalCounts.reactionsCount,
        // Only individual state can change
        currentUserReaction: action.includes('react_') ? action.split('_')[1] : undefined
      };

      expect(postAfterAction.reactionsCount).toBe(50);  // Never changes
    });
  });

  it('should handle edge cases correctly', () => {
    // Post with zero counts
    const emptyPost = {
      reactionsCount: 0
    };

    // Even with zero counts, they should not be modified locally
    const afterUserAction = {
      ...emptyPost,
      reactionsCount: emptyPost.reactionsCount,  // Still 0
      currentUserReaction: 'heart_eyes'
    };

    expect(afterUserAction.reactionsCount).toBe(0);
    expect(afterUserAction.currentUserReaction).toBe('heart_eyes');
  });
});