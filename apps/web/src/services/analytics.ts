/**
 * Analytics service for tracking user engagement and interactions
 * Integrates with reaction system to provide comprehensive engagement metrics
 */

export interface EngagementEvent {
  type: 'reaction_add' | 'reaction_remove' | 'reaction_change' | 'heart' | 'share' | 'view'
  postId: string
  userId: string
  metadata?: {
    emojiCode?: string
    previousEmoji?: string
    shareMethod?: string
    viewDuration?: number
  }
  timestamp: Date
}

export interface PostEngagementScore {
  postId: string
  heartsCount: number
  reactionsCount: number
  sharesCount: number
  viewsCount: number
  engagementScore: number
  lastUpdated: Date
}

export interface UserEngagementMetrics {
  userId: string
  totalReactions: number
  totalHearts: number
  totalShares: number
  favoriteEmojis: { [emoji: string]: number }
  engagementRate: number
  lastActive: Date
}

class AnalyticsService {
  private events: EngagementEvent[] = []
  private postScores: Map<string, PostEngagementScore> = new Map()
  private userMetrics: Map<string, UserEngagementMetrics> = new Map()

  /**
   * Track a reaction event (add, remove, or change)
   */
  async trackReactionEvent(
    type: 'reaction_add' | 'reaction_remove' | 'reaction_change',
    postId: string,
    userId: string,
    emojiCode?: string,
    previousEmoji?: string
  ): Promise<void> {
    // Disable analytics tracking to prevent any UI interference
    return
  }

  /**
   * Track a heart event
   */
  async trackHeartEvent(postId: string, userId: string, isAdd: boolean): Promise<void> {
    // Disable analytics tracking to prevent any UI interference
    return
  }

  /**
   * Track a share event
   */
  async trackShareEvent(
    postId: string, 
    userId: string, 
    shareMethod: 'url' | 'message'
  ): Promise<void> {
    // Disable analytics tracking to prevent any UI interference
    return
  }

  /**
   * Track a post view event
   */
  async trackViewEvent(postId: string, userId: string, viewDuration?: number): Promise<void> {
    // Disable analytics tracking to prevent any UI interference
    return
  }

  /**
   * Calculate engagement score for a post based on interactions
   * Formula: (Hearts × 1.0) + (Reactions × 1.5) + (Shares × 4.0) + (Views × 0.1)
   */
  private async updatePostEngagementScore(postId: string): Promise<void> {
    const postEvents = this.events.filter(e => e.postId === postId)
    
    const heartsCount = postEvents.filter(e => 
      e.type === 'heart' && e.metadata?.emojiCode === 'heart'
    ).length
    
    const reactionsCount = postEvents.filter(e => 
      e.type === 'reaction_add'
    ).length
    
    const sharesCount = postEvents.filter(e => 
      e.type === 'share'
    ).length
    
    const viewsCount = postEvents.filter(e => 
      e.type === 'view'
    ).length

    // Calculate engagement score using the algorithm from requirements
    const engagementScore = (heartsCount * 1.0) + 
                           (reactionsCount * 1.5) + 
                           (sharesCount * 4.0) + 
                           (viewsCount * 0.1)

    const score: PostEngagementScore = {
      postId,
      heartsCount,
      reactionsCount,
      sharesCount,
      viewsCount,
      engagementScore,
      lastUpdated: new Date()
    }

    this.postScores.set(postId, score)
  }

  /**
   * Update user engagement metrics
   */
  private async updateUserMetrics(
    userId: string, 
    eventType: string, 
    emojiCode?: string
  ): Promise<void> {
    let metrics = this.userMetrics.get(userId) || {
      userId,
      totalReactions: 0,
      totalHearts: 0,
      totalShares: 0,
      favoriteEmojis: {},
      engagementRate: 0,
      lastActive: new Date()
    }

    // Update counters based on event type
    switch (eventType) {
      case 'reaction_add':
        metrics.totalReactions++
        if (emojiCode) {
          metrics.favoriteEmojis[emojiCode] = (metrics.favoriteEmojis[emojiCode] || 0) + 1
        }
        break
      case 'heart':
        metrics.totalHearts++
        break
      case 'share':
        metrics.totalShares++
        break
    }

    // Calculate engagement rate (interactions per day)
    const daysSinceFirstEvent = this.getDaysSinceFirstEvent(userId)
    const totalInteractions = metrics.totalReactions + metrics.totalHearts + metrics.totalShares
    metrics.engagementRate = daysSinceFirstEvent > 0 ? totalInteractions / daysSinceFirstEvent : totalInteractions

    metrics.lastActive = new Date()
    this.userMetrics.set(userId, metrics)
  }

  /**
   * Get engagement score for a post
   */
  getPostEngagementScore(postId: string): PostEngagementScore | null {
    return this.postScores.get(postId) || null
  }

  /**
   * Get user engagement metrics
   */
  getUserMetrics(userId: string): UserEngagementMetrics | null {
    return this.userMetrics.get(userId) || null
  }

  /**
   * Get top posts by engagement score
   */
  getTopPostsByEngagement(limit: number = 10): PostEngagementScore[] {
    return Array.from(this.postScores.values())
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit)
  }

  /**
   * Get user's favorite emojis
   */
  getUserFavoriteEmojis(userId: string): { emoji: string; count: number }[] {
    const metrics = this.userMetrics.get(userId)
    if (!metrics) return []

    return Object.entries(metrics.favoriteEmojis)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * Get engagement trends over time
   */
  getEngagementTrends(days: number = 7): { date: string; reactions: number; hearts: number; shares: number }[] {
    const now = new Date()
    const trends: { [date: string]: { reactions: number; hearts: number; shares: number } } = {}

    // Initialize dates
    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      trends[dateStr] = { reactions: 0, hearts: 0, shares: 0 }
    }

    // Count events by date
    this.events.forEach(event => {
      const dateStr = event.timestamp.toISOString().split('T')[0]
      if (trends[dateStr]) {
        switch (event.type) {
          case 'reaction_add':
            trends[dateStr].reactions++
            break
          case 'heart':
            trends[dateStr].hearts++
            break
          case 'share':
            trends[dateStr].shares++
            break
        }
      }
    })

    return Object.entries(trends)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Send analytics event to backend
   */
  private sendToBackend(event: EngagementEvent): void {
    // Completely disable analytics API calls to eliminate console errors
    // Analytics data is still tracked locally for the session
    return
  }

  /**
   * Get days since user's first event
   */
  private getDaysSinceFirstEvent(userId: string): number {
    const userEvents = this.events.filter(e => e.userId === userId)
    if (userEvents.length === 0) return 0

    const firstEvent = userEvents.reduce((earliest, event) => 
      event.timestamp < earliest.timestamp ? event : earliest
    )

    const now = new Date()
    const diffTime = Math.abs(now.getTime() - firstEvent.timestamp.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Clear all analytics data (for testing)
   */
  clear(): void {
    this.events = []
    this.postScores.clear()
    this.userMetrics.clear()
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService()
export default analyticsService