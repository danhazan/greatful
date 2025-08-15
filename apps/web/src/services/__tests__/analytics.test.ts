import { describe, it, beforeEach } from '@jest/globals'
import analyticsService from '../analytics'

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock fetch
global.fetch = jest.fn()

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    analyticsService.clear()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  })

  describe('trackReactionEvent', () => {
    it('should track reaction_add event locally', async () => {
      await analyticsService.trackReactionEvent('reaction_add', 'post-1', 'user-1', 'heart_eyes')

      // Analytics API calls are disabled, but local tracking should work
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
      expect(score?.reactionsCount).toBe(1)
    })

    it('should track reaction_remove event locally', async () => {
      await analyticsService.trackReactionEvent('reaction_remove', 'post-1', 'user-1', undefined, 'heart_eyes')

      // Local tracking should work even with API disabled
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
    })

    it('should track reaction_change event locally', async () => {
      // First add a reaction, then change it
      await analyticsService.trackReactionEvent('reaction_add', 'post-1', 'user-1', 'heart_eyes')
      await analyticsService.trackReactionEvent('reaction_change', 'post-1', 'user-1', 'fire', 'heart_eyes')

      // Local tracking should work - reaction_change doesn't increase count, just changes the emoji
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
      expect(score?.reactionsCount).toBe(1) // Still 1 reaction, just changed emoji
    })
  })

  describe('trackHeartEvent', () => {
    it('should track heart add event locally', async () => {
      await analyticsService.trackHeartEvent('post-1', 'user-1', true)

      // Local tracking should work
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
      expect(score?.heartsCount).toBe(1)
    })

    it('should track heart remove event locally', async () => {
      await analyticsService.trackHeartEvent('post-1', 'user-1', false)

      // Local tracking should work
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
    })
  })

  describe('trackShareEvent', () => {
    it('should track share via URL locally', async () => {
      await analyticsService.trackShareEvent('post-1', 'user-1', 'url')

      // Local tracking should work
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
      expect(score?.sharesCount).toBe(1)
    })

    it('should track share via message locally', async () => {
      await analyticsService.trackShareEvent('post-1', 'user-1', 'message')

      // Local tracking should work
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
      expect(score?.sharesCount).toBe(1)
    })
  })

  describe('trackViewEvent', () => {
    it('should track view event with duration locally', async () => {
      await analyticsService.trackViewEvent('post-1', 'user-1', 5000)

      // Local tracking should work
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
      expect(score?.viewsCount).toBe(1)
    })

    it('should track view event without duration locally', async () => {
      await analyticsService.trackViewEvent('post-1', 'user-1')

      // Local tracking should work
      const score = analyticsService.getPostEngagementScore('post-1')
      expect(score).toBeTruthy()
      expect(score?.viewsCount).toBe(1)
    })
  })

  describe('getPostEngagementScore', () => {
    it('should calculate engagement score correctly', async () => {
      // Add some events
      await analyticsService.trackHeartEvent('post-1', 'user-1', true)
      await analyticsService.trackHeartEvent('post-1', 'user-2', true)
      await analyticsService.trackReactionEvent('reaction_add', 'post-1', 'user-3', 'heart_eyes')
      await analyticsService.trackShareEvent('post-1', 'user-4', 'url')
      await analyticsService.trackViewEvent('post-1', 'user-5')

      const score = analyticsService.getPostEngagementScore('post-1')
      
      expect(score).toBeTruthy()
      expect(score!.heartsCount).toBe(2)
      expect(score!.reactionsCount).toBe(1)
      expect(score!.sharesCount).toBe(1)
      expect(score!.viewsCount).toBe(1)
      
      // Formula: (Hearts × 1.0) + (Reactions × 1.5) + (Shares × 4.0) + (Views × 0.1)
      // Expected: (2 × 1.0) + (1 × 1.5) + (1 × 4.0) + (1 × 0.1) = 7.6
      expect(score!.engagementScore).toBe(7.6)
    })

    it('should return null for non-existent post', () => {
      const score = analyticsService.getPostEngagementScore('non-existent')
      expect(score).toBeNull()
    })
  })

  describe('getUserMetrics', () => {
    it('should track user metrics correctly', async () => {
      await analyticsService.trackReactionEvent('reaction_add', 'post-1', 'user-1', 'heart_eyes')
      await analyticsService.trackReactionEvent('reaction_add', 'post-2', 'user-1', 'fire')
      await analyticsService.trackHeartEvent('post-3', 'user-1', true)
      await analyticsService.trackShareEvent('post-4', 'user-1', 'url')

      const metrics = analyticsService.getUserMetrics('user-1')
      
      expect(metrics).toBeTruthy()
      expect(metrics!.totalReactions).toBe(2)
      expect(metrics!.totalHearts).toBe(1)
      expect(metrics!.totalShares).toBe(1)
      expect(metrics!.favoriteEmojis).toEqual({
        'heart_eyes': 1,
        'fire': 1
      })
    })
  })

  describe('getTopPostsByEngagement', () => {
    it('should return posts sorted by engagement score', async () => {
      // Create posts with different engagement levels
      await analyticsService.trackHeartEvent('post-1', 'user-1', true) // Score: 1.0
      
      await analyticsService.trackHeartEvent('post-2', 'user-1', true) // Score: 5.5
      await analyticsService.trackReactionEvent('reaction_add', 'post-2', 'user-2', 'heart_eyes')
      await analyticsService.trackShareEvent('post-2', 'user-3', 'url')
      
      await analyticsService.trackShareEvent('post-3', 'user-1', 'url') // Score: 4.0

      const topPosts = analyticsService.getTopPostsByEngagement(3)
      
      expect(topPosts).toHaveLength(3)
      expect(topPosts[0].postId).toBe('post-2') // Highest score
      expect(topPosts[1].postId).toBe('post-3')
      expect(topPosts[2].postId).toBe('post-1') // Lowest score
    })

    it('should limit results correctly', async () => {
      // Create 5 posts
      for (let i = 1; i <= 5; i++) {
        await analyticsService.trackHeartEvent(`post-${i}`, 'user-1', true)
      }

      const topPosts = analyticsService.getTopPostsByEngagement(3)
      expect(topPosts).toHaveLength(3)
    })
  })

  describe('getUserFavoriteEmojis', () => {
    it('should return favorite emojis sorted by count', async () => {
      await analyticsService.trackReactionEvent('reaction_add', 'post-1', 'user-1', 'heart_eyes')
      await analyticsService.trackReactionEvent('reaction_add', 'post-2', 'user-1', 'heart_eyes')
      await analyticsService.trackReactionEvent('reaction_add', 'post-3', 'user-1', 'fire')

      const favorites = analyticsService.getUserFavoriteEmojis('user-1')
      
      expect(favorites).toHaveLength(2)
      expect(favorites[0]).toEqual({ emoji: 'heart_eyes', count: 2 })
      expect(favorites[1]).toEqual({ emoji: 'fire', count: 1 })
    })

    it('should return empty array for user with no reactions', () => {
      const favorites = analyticsService.getUserFavoriteEmojis('non-existent-user')
      expect(favorites).toEqual([])
    })
  })

  describe('getEngagementTrends', () => {
    it('should return engagement trends over specified days', async () => {
      // Clear any existing events first
      analyticsService.clear()
      
      // Mock dates to control the test
      const mockDate = new Date('2024-01-15T12:00:00Z')
      const dateSpy = jest.spyOn(global, 'Date').mockImplementation((...args) => {
        if (args.length === 0) {
          return mockDate as any
        }
        return new (Date as any)(...args)
      })

      await analyticsService.trackReactionEvent('reaction_add', 'post-1', 'user-1', 'heart_eyes')
      await analyticsService.trackHeartEvent('post-2', 'user-1', true)
      await analyticsService.trackShareEvent('post-3', 'user-1', 'url')

      const trends = analyticsService.getEngagementTrends(3)
      
      expect(trends).toHaveLength(3)
      expect(trends[2]).toEqual({
        date: '2024-01-15',
        reactions: 1,
        hearts: 1,
        shares: 1
      })

      // Restore Date
      dateSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(analyticsService.trackHeartEvent('post-1', 'user-1', true)).resolves.toBeUndefined()
    })

    it('should handle missing token gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      // Should not throw and should not call fetch
      await analyticsService.trackHeartEvent('post-1', 'user-1', true)
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})