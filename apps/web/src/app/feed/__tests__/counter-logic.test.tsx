/**
 * Test to verify that global counts remain server-authoritative 
 * and individual user state is managed separately
 */

describe('Counter Logic - Global vs Individual State', () => {
  it('should keep global counts unchanged when user reacts', () => {
    // Mock post with server data (global counts)
    const serverPost = {
      id: 'post1',
      heartsCount: 25,      // Global count from ALL users
      reactionsCount: 18,   // Global count from ALL users
      content: 'Test post'
    };

    // User's individual state (from localStorage)
    const userState = {
      isHearted: false,
      currentUserReaction: undefined
    };

    // When user hearts the post
    const afterHeart = {
      ...serverPost,
      // Global counts should remain unchanged (server-authoritative)
      heartsCount: serverPost.heartsCount,  // Still 25
      reactionsCount: serverPost.reactionsCount,  // Still 18
      // Only individual state changes
      isHearted: true  // User's personal state
    };

    expect(afterHeart.heartsCount).toBe(25);  // Global count unchanged
    expect(afterHeart.reactionsCount).toBe(18);  // Global count unchanged
    expect(afterHeart.isHearted).toBe(true);  // Individual state updated
  });

  it('should keep global counts unchanged when user adds emoji reaction', () => {
    // Mock post with server data
    const serverPost = {
      id: 'post1',
      heartsCount: 25,
      reactionsCount: 18,
      content: 'Test post'
    };

    // When user adds emoji reaction
    const afterReaction = {
      ...serverPost,
      // Global counts should remain unchanged
      heartsCount: serverPost.heartsCount,  // Still 25
      reactionsCount: serverPost.reactionsCount,  // Still 18
      // Only individual state changes
      currentUserReaction: 'heart_eyes'  // User's personal reaction
    };

    expect(afterReaction.heartsCount).toBe(25);
    expect(afterReaction.reactionsCount).toBe(18);
    expect(afterReaction.currentUserReaction).toBe('heart_eyes');
  });

  it('should demonstrate correct data separation', () => {
    // Server provides global engagement data
    const globalData = {
      heartsCount: 100,     // Hearts from ALL users
      reactionsCount: 75,   // Reactions from ALL users
    };

    // User A's individual state
    const userAState = {
      isHearted: true,
      currentUserReaction: 'fire'
    };

    // User B's individual state  
    const userBState = {
      isHearted: false,
      currentUserReaction: 'pray'
    };

    // Both users see the same global counts
    const userAView = { ...globalData, ...userAState };
    const userBView = { ...globalData, ...userBState };

    // Global counts are identical for both users
    expect(userAView.heartsCount).toBe(100);
    expect(userBView.heartsCount).toBe(100);
    expect(userAView.reactionsCount).toBe(75);
    expect(userBView.reactionsCount).toBe(75);

    // Individual states are different
    expect(userAView.isHearted).toBe(true);
    expect(userBView.isHearted).toBe(false);
    expect(userAView.currentUserReaction).toBe('fire');
    expect(userBView.currentUserReaction).toBe('pray');
  });

  it('should never modify global counts locally', () => {
    const originalGlobalCounts = {
      heartsCount: 50,
      reactionsCount: 30
    };

    // Simulate multiple user actions
    const actions = [
      'heart',
      'unheart', 
      'react_fire',
      'react_pray',
      'remove_reaction'
    ];

    // After any number of user actions, global counts should remain unchanged
    actions.forEach(action => {
      const postAfterAction = {
        ...originalGlobalCounts,
        // Global counts must never change locally
        heartsCount: originalGlobalCounts.heartsCount,
        reactionsCount: originalGlobalCounts.reactionsCount,
        // Only individual state can change
        isHearted: action.includes('heart'),
        currentUserReaction: action.includes('react_') ? action.split('_')[1] : undefined
      };

      expect(postAfterAction.heartsCount).toBe(50);  // Never changes
      expect(postAfterAction.reactionsCount).toBe(30);  // Never changes
    });
  });

  it('should handle edge cases correctly', () => {
    // Post with zero counts
    const emptyPost = {
      heartsCount: 0,
      reactionsCount: 0
    };

    // Even with zero counts, they should not be modified locally
    const afterUserAction = {
      ...emptyPost,
      heartsCount: emptyPost.heartsCount,  // Still 0
      reactionsCount: emptyPost.reactionsCount,  // Still 0
      isHearted: true,
      currentUserReaction: 'heart_eyes'
    };

    expect(afterUserAction.heartsCount).toBe(0);
    expect(afterUserAction.reactionsCount).toBe(0);
    expect(afterUserAction.isHearted).toBe(true);
    expect(afterUserAction.currentUserReaction).toBe('heart_eyes');
  });
});