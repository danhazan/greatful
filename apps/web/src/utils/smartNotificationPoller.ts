/**
 * Smart Notification Polling Service
 * Implements adaptive polling based on user activity and page visibility
 */

import { apiClient } from './apiClient'

interface PollingConfig {
  activeInterval: number // Polling interval when user is active (ms)
  idleInterval: number // Polling interval when user is idle (ms)
  hiddenInterval: number // Polling interval when tab is hidden (ms)
  idleThreshold: number // Time before considering user idle (ms)
  maxRetries: number // Maximum retry attempts on failure
  backoffMultiplier: number // Exponential backoff multiplier
}

interface NotificationUpdate {
  notifications: any[]
  unreadCount: number
  timestamp: number
}

type NotificationCallback = (update: NotificationUpdate) => void
type ErrorCallback = (error: Error) => void

class SmartNotificationPoller {
  private config: PollingConfig = {
    activeInterval: 30000, // 30 seconds when active
    idleInterval: 120000, // 2 minutes when idle
    hiddenInterval: 300000, // 5 minutes when tab hidden
    idleThreshold: 120000, // 2 minutes idle threshold
    maxRetries: 3,
    backoffMultiplier: 2
  }

  private isPolling = false
  private pollInterval: NodeJS.Timeout | null = null
  private lastActivity = Date.now()
  private lastPollTime = 0
  private retryCount = 0
  private callbacks: NotificationCallback[] = []
  private errorCallbacks: ErrorCallback[] = []
  private userId: string | null = null
  
  // Store last notification state to persist across component remounts
  private lastNotificationState: NotificationUpdate | null = null

  constructor(config?: Partial<PollingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Only setup tracking in browser environment
    if (typeof window !== 'undefined') {
      this.setupActivityTracking()
      this.setupVisibilityTracking()
    }
  }

  /**
   * Start polling for notifications
   */
  start(userId: string): void {
    if (this.isPolling) {
      this.stop()
    }

    this.userId = userId
    this.isPolling = true
    this.lastActivity = Date.now()
    this.retryCount = 0

    console.debug('🔔 Starting smart notification polling for user:', userId)
    
    // If we have cached notification state, immediately notify callbacks
    if (this.lastNotificationState) {
      console.debug('📦 Restoring cached notification state')
      this.callbacks.forEach(callback => {
        try {
          callback(this.lastNotificationState!)
        } catch (error) {
          console.error('Error in notification callback:', error)
        }
      })
    }
    
    // Initial fetch
    this.fetchNotifications()
    
    // Schedule next poll
    this.scheduleNextPoll()
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isPolling) return

    console.debug('🔕 Stopping notification polling')
    
    this.isPolling = false
    this.userId = null
    
    if (this.pollInterval) {
      clearTimeout(this.pollInterval)
      this.pollInterval = null
    }
    
    // Note: We intentionally keep lastNotificationState to restore on next start
  }

  /**
   * Add callback for notification updates
   */
  onUpdate(callback: NotificationCallback): () => void {
    this.callbacks.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Add callback for errors
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.errorCallbacks.indexOf(callback)
      if (index > -1) {
        this.errorCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Force immediate poll
   */
  async poll(): Promise<void> {
    if (!this.userId) return
    
    await this.fetchNotifications()
  }

  /**
   * Get cached notification state (useful for restoring state on component mount)
   */
  getCachedState(): NotificationUpdate | null {
    return this.lastNotificationState
  }

  /**
   * Get current polling interval based on user state
   */
  private getCurrentInterval(): number {
    const now = Date.now()
    const timeSinceActivity = now - this.lastActivity
    const isHidden = typeof document !== 'undefined' ? document.hidden : false

    if (isHidden) {
      return this.config.hiddenInterval
    } else if (timeSinceActivity > this.config.idleThreshold) {
      return this.config.idleInterval
    } else {
      return this.config.activeInterval
    }
  }

  /**
   * Schedule next poll with adaptive interval
   */
  private scheduleNextPoll(): void {
    if (!this.isPolling) return

    const interval = this.getCurrentInterval()
    
    // Apply exponential backoff if there were recent failures
    const backoffInterval = interval * Math.pow(this.config.backoffMultiplier, this.retryCount)
    const finalInterval = Math.min(backoffInterval, this.config.hiddenInterval)

    console.debug(`📅 Scheduling next poll in ${finalInterval / 1000}s (base: ${interval / 1000}s, retries: ${this.retryCount})`)

    this.pollInterval = setTimeout(() => {
      this.fetchNotifications()
      this.scheduleNextPoll()
    }, finalInterval)
  }

  /**
   * Fetch notifications from API
   */
  private async fetchNotifications(): Promise<void> {
    if (!this.userId || !this.isPolling) return

    const now = Date.now()
    
    // Prevent too frequent polling (minimum 10 seconds between requests)
    if (now - this.lastPollTime < 10000) {
      console.debug('⏳ Skipping poll - too frequent')
      return
    }

    this.lastPollTime = now

    try {
      console.debug('🔄 Fetching notifications...')
      
      const notifications = await apiClient.getNotifications({
        skipCache: this.retryCount > 0 // Skip cache on retries
      })

      const unreadCount = Array.isArray(notifications) 
        ? notifications.filter((n: any) => !n.read).length 
        : 0

      const update: NotificationUpdate = {
        notifications: Array.isArray(notifications) ? notifications : [],
        unreadCount,
        timestamp: now
      }

      // Store the notification state for persistence across component remounts
      this.lastNotificationState = update

      // Notify all callbacks
      this.callbacks.forEach(callback => {
        try {
          callback(update)
        } catch (error) {
          console.error('Error in notification callback:', error)
        }
      })

      // Reset retry count on success
      this.retryCount = 0

      console.debug(`✅ Fetched ${update.notifications.length} notifications (${unreadCount} unread)`)

    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error)
      
      this.retryCount = Math.min(this.retryCount + 1, this.config.maxRetries)
      
      // Notify error callbacks
      const errorObj = error instanceof Error ? error : new Error(String(error))
      this.errorCallbacks.forEach(callback => {
        try {
          callback(errorObj)
        } catch (callbackError) {
          console.error('Error in notification error callback:', callbackError)
        }
      })

      // If max retries reached, reduce polling frequency
      if (this.retryCount >= this.config.maxRetries) {
        console.warn('⚠️ Max retries reached, reducing polling frequency')
      }
    }
  }

  /**
   * Setup activity tracking
   */
  private setupActivityTracking(): void {
    if (typeof document !== 'undefined') {
      const updateActivity = () => {
        this.lastActivity = Date.now()
      }

      // Track various user activities
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
      
      events.forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true })
      })

      // Cleanup function would be needed in a real implementation
      // to remove event listeners when the poller is destroyed
    }
  }

  /**
   * Setup page visibility tracking
   */
  private setupVisibilityTracking(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Page became visible - update activity and potentially poll immediately
          this.lastActivity = Date.now()
          
          // If we haven't polled recently, do an immediate poll
          const timeSinceLastPoll = Date.now() - this.lastPollTime
          if (timeSinceLastPoll > this.config.activeInterval) {
            console.debug('👁️ Page visible - immediate poll')
            this.fetchNotifications()
          }
        }
        
        // Reschedule next poll with new interval
        if (this.isPolling && this.pollInterval) {
          clearTimeout(this.pollInterval)
          this.scheduleNextPoll()
        }
      })
    }
  }

  /**
   * Get current poller statistics
   */
  getStats() {
    return {
      isPolling: this.isPolling,
      userId: this.userId,
      lastActivity: this.lastActivity,
      lastPollTime: this.lastPollTime,
      retryCount: this.retryCount,
      currentInterval: this.getCurrentInterval(),
      isHidden: document.hidden,
      timeSinceActivity: Date.now() - this.lastActivity,
      callbackCount: this.callbacks.length,
      errorCallbackCount: this.errorCallbacks.length
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...config }
    
    // Reschedule if currently polling
    if (this.isPolling && this.pollInterval) {
      clearTimeout(this.pollInterval)
      this.scheduleNextPoll()
    }
  }
}

// Create singleton instance
export const smartNotificationPoller = new SmartNotificationPoller()

// Export class for testing
export { SmartNotificationPoller }