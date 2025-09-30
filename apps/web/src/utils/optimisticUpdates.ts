'use client'

interface OptimisticUpdate<T> {
  id: string
  originalValue: T
  newValue: T
  timestamp: number
}

class OptimisticUpdateManager<T> {
  private updates: Map<string, OptimisticUpdate<T>> = new Map()
  private rollbackCallbacks: Map<string, (originalValue: T) => void> = new Map()

  // Apply an optimistic update
  applyUpdate(
    id: string,
    originalValue: T,
    newValue: T,
    rollbackCallback: (originalValue: T) => void
  ): void {
    const update: OptimisticUpdate<T> = {
      id,
      originalValue,
      newValue,
      timestamp: Date.now()
    }

    this.updates.set(id, update)
    this.rollbackCallbacks.set(id, rollbackCallback)
  }

  // Confirm an optimistic update (remove from pending)
  confirmUpdate(id: string): void {
    this.updates.delete(id)
    this.rollbackCallbacks.delete(id)
  }

  // Rollback an optimistic update
  rollbackUpdate(id: string): boolean {
    const update = this.updates.get(id)
    const rollbackCallback = this.rollbackCallbacks.get(id)

    if (update && rollbackCallback) {
      rollbackCallback(update.originalValue)
      this.updates.delete(id)
      this.rollbackCallbacks.delete(id)
      return true
    }

    return false
  }

  // Rollback all updates older than specified time (in milliseconds)
  rollbackStaleUpdates(maxAge: number = 30000): void {
    const now = Date.now()
    
    this.updates.forEach((update, id) => {
      if (now - update.timestamp > maxAge) {
        this.rollbackUpdate(id)
      }
    })
  }

  // Get all pending updates
  getPendingUpdates(): OptimisticUpdate<T>[] {
    return Array.from(this.updates.values())
  }

  // Clear all updates
  clear(): void {
    this.updates.clear()
    this.rollbackCallbacks.clear()
  }
}

// Global instances for different types of updates
export const followStateManager = new OptimisticUpdateManager<boolean>()
export const userProfileManager = new OptimisticUpdateManager<any>()
export const postStateManager = new OptimisticUpdateManager<any>()

// Utility function for creating optimistic update handlers
export function createOptimisticHandler<T>(
  manager: OptimisticUpdateManager<T>,
  updateId: string,
  originalValue: T,
  newValue: T,
  setState: (value: T) => void,
  apiCall: () => Promise<void>
): () => Promise<void> {
  return async () => {
    // Apply optimistic update
    setState(newValue)
    manager.applyUpdate(updateId, originalValue, newValue, setState)

    try {
      // Execute API call
      await apiCall()
      
      // Confirm update on success
      manager.confirmUpdate(updateId)
    } catch (error) {
      // Rollback on failure
      manager.rollbackUpdate(updateId)
      throw error
    }
  }
}

// Auto-cleanup stale updates every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    followStateManager.rollbackStaleUpdates()
    userProfileManager.rollbackStaleUpdates()
    postStateManager.rollbackStaleUpdates()
  }, 30000)
}