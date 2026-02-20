'use client'

// Event types for cross-component state synchronization
export type StateSyncEvent = 
  | { type: 'USER_PROFILE_UPDATED'; payload: { userId: string; updates: any } }
  | { type: 'FOLLOW_STATE_CHANGED'; payload: { userId: string; isFollowing: boolean } }
  | { type: 'POST_UPDATED'; payload: { postId: string; updates: any } }
  | { type: 'NOTIFICATION_COUNT_CHANGED'; payload: { count: number } }

// Global event emitter for state synchronization
class StateSyncEmitter {
  private listeners: Map<string, Set<(event: StateSyncEvent) => void>> = new Map()

  // Subscribe to specific event types
  subscribe(eventType: string, callback: (event: StateSyncEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    
    this.listeners.get(eventType)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  // Subscribe to all events
  subscribeAll(callback: (event: StateSyncEvent) => void): () => void {
    const unsubscribeFunctions: (() => void)[] = []
    
    // Subscribe to all known event types
    const eventTypes = [
      'USER_PROFILE_UPDATED',
      'FOLLOW_STATE_CHANGED', 
      'POST_UPDATED',
      'NOTIFICATION_COUNT_CHANGED'
    ]
    
    eventTypes.forEach(eventType => {
      unsubscribeFunctions.push(this.subscribe(eventType, callback))
    })
    
    // Return function to unsubscribe from all
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    }
  }

  // Emit an event to all subscribers
  emit(event: StateSyncEvent): void {
    const listeners = this.listeners.get(event.type)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in state sync listener:', error)
        }
      })
    }
  }

  // Get listener count for debugging
  getListenerCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size || 0
    }
    
    let total = 0
    this.listeners.forEach(listeners => {
      total += listeners.size
    })
    return total
  }
}

// Global instance
export const stateSyncEmitter = new StateSyncEmitter()

// Utility functions for common state sync operations
export const stateSyncUtils = {
  // Emit user profile update
  updateUserProfile: (userId: string, updates: any) => {
    stateSyncEmitter.emit({
      type: 'USER_PROFILE_UPDATED',
      payload: { userId, updates }
    })
  },

  // Emit follow state change
  updateFollowState: (userId: string, isFollowing: boolean) => {
    stateSyncEmitter.emit({
      type: 'FOLLOW_STATE_CHANGED',
      payload: { userId, isFollowing }
    })
  },

  // Emit post update
  updatePost: (postId: string, updates: any) => {
    stateSyncEmitter.emit({
      type: 'POST_UPDATED',
      payload: { postId, updates }
    })
  },

  // Emit notification count change
  updateNotificationCount: (count: number) => {
    stateSyncEmitter.emit({
      type: 'NOTIFICATION_COUNT_CHANGED',
      payload: { count }
    })
  }
}

// React hook for subscribing to state sync events
export function useStateSyncSubscription(
  eventType: string | 'ALL',
  callback: (event: StateSyncEvent) => void,
  dependencies: any[] = []
): void {
  React.useEffect(() => {
    if (eventType === 'ALL') {
      return stateSyncEmitter.subscribeAll(callback)
    } else {
      return stateSyncEmitter.subscribe(eventType, callback)
    }
  }, [eventType, ...dependencies])
}

// Performance monitoring for state sync
export const stateSyncMonitor = {
  logEvent: (event: StateSyncEvent) => {
    if (process.env['NODE_ENV'] === 'development') {
      console.log('State Sync Event:', event.type, event.payload)
    }
  },

  logListenerCount: () => {
    if (process.env['NODE_ENV'] === 'development') {
      console.log('State Sync Listeners:', {
        USER_PROFILE_UPDATED: stateSyncEmitter.getListenerCount('USER_PROFILE_UPDATED'),
        FOLLOW_STATE_CHANGED: stateSyncEmitter.getListenerCount('FOLLOW_STATE_CHANGED'),
        POST_UPDATED: stateSyncEmitter.getListenerCount('POST_UPDATED'),
        NOTIFICATION_COUNT_CHANGED: stateSyncEmitter.getListenerCount('NOTIFICATION_COUNT_CHANGED'),
        total: stateSyncEmitter.getListenerCount()
      })
    }
  }
}

// Add React import for useEffect
import React from 'react'