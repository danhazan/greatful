import { 
  getUserSpecificKey, 
  getUserReactionsKey, 
  loadUserReactions, 
  saveUserReactions, 
  clearUserData,
  clearGenericReactionData 
} from '../localStorage';

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
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('localStorage utilities', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getUserSpecificKey', () => {
    it('should create user-specific keys', () => {
      expect(getUserSpecificKey('user123', 'reactions')).toBe('user_user123_reactions');
      expect(getUserSpecificKey('user456', 'drafts')).toBe('user_user456_drafts');
    });
  });

  describe('getUserReactionsKey', () => {
    it('should create user-specific reaction keys', () => {
      expect(getUserReactionsKey('user123')).toBe('user_user123_reactions');
      expect(getUserReactionsKey('user456')).toBe('user_user456_reactions');
    });
  });

  describe('loadUserReactions', () => {
    it('should return empty object for non-existent user reactions', () => {
      const reactions = loadUserReactions('user123');
      expect(reactions).toEqual({});
    });

    it('should load user-specific reactions', () => {
      const testReactions = {
        'post1': { reaction: 'heart_eyes', hearted: true },
        'post2': { hearted: false }
      };
      
      localStorageMock.setItem('user_user123_reactions', JSON.stringify(testReactions));
      
      const reactions = loadUserReactions('user123');
      expect(reactions).toEqual(testReactions);
    });

    it('should return empty object for invalid JSON', () => {
      // Mock console.error to suppress expected error output during test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      localStorageMock.setItem('user_user123_reactions', 'invalid json');
      
      const reactions = loadUserReactions('user123');
      expect(reactions).toEqual({});
      
      // Verify that error was logged
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load user reactions:', expect.any(SyntaxError));
      
      // Restore console.error
      consoleSpy.mockRestore();
    });

    it('should return empty object for empty userId', () => {
      expect(loadUserReactions('')).toEqual({});
    });
  });

  describe('saveUserReactions', () => {
    it('should save user-specific reactions', () => {
      const testReactions = {
        'post1': { reaction: 'heart_eyes', hearted: true },
        'post2': { hearted: false }
      };
      
      saveUserReactions('user123', testReactions);
      
      const stored = localStorageMock.getItem('user_user123_reactions');
      expect(JSON.parse(stored!)).toEqual(testReactions);
    });

    it('should not save for empty userId', () => {
      const testReactions = { 'post1': { hearted: true } };
      
      saveUserReactions('', testReactions);
      
      expect(localStorageMock.length).toBe(0);
    });
  });

  describe('clearUserData', () => {
    it('should clear all user-specific data', () => {
      // Set up some user data
      localStorageMock.setItem('user_user123_reactions', '{"post1": {"hearted": true}}');
      localStorageMock.setItem('user_user123_drafts', '{"draft1": "content"}');
      localStorageMock.setItem('user_user123_preferences', '{"theme": "dark"}');
      localStorageMock.setItem('other_key', 'should remain');
      
      clearUserData('user123');
      
      expect(localStorageMock.getItem('user_user123_reactions')).toBeNull();
      expect(localStorageMock.getItem('user_user123_drafts')).toBeNull();
      expect(localStorageMock.getItem('user_user123_preferences')).toBeNull();
      expect(localStorageMock.getItem('other_key')).toBe('should remain');
    });
  });

  describe('clearGenericReactionData', () => {
    it('should clear the old generic reaction key', () => {
      localStorageMock.setItem('local_reactions', '{"post1": {"hearted": true}}');
      localStorageMock.setItem('user_user123_reactions', '{"post1": {"hearted": true}}');
      
      clearGenericReactionData();
      
      expect(localStorageMock.getItem('local_reactions')).toBeNull();
      expect(localStorageMock.getItem('user_user123_reactions')).toBe('{"post1": {"hearted": true}}');
    });
  });

  describe('user isolation', () => {
    it('should keep different users reactions separate', () => {
      const user1Reactions = { 'post1': { reaction: 'heart_eyes', hearted: true } };
      const user2Reactions = { 'post1': { reaction: 'fire', hearted: false } };
      
      saveUserReactions('user1', user1Reactions);
      saveUserReactions('user2', user2Reactions);
      
      expect(loadUserReactions('user1')).toEqual(user1Reactions);
      expect(loadUserReactions('user2')).toEqual(user2Reactions);
      
      // Verify they don't interfere with each other
      expect(loadUserReactions('user1')).not.toEqual(user2Reactions);
      expect(loadUserReactions('user2')).not.toEqual(user1Reactions);
    });
  });
});