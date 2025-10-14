/**
 * Centralized API Cache Manager
 * Prevents duplicate requests and manages cache invalidation
 */

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  expiresAt: number
  requestPromise?: Promise<T>
}

interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum number of entries
}

class APICache {
  private cache = new Map<string, CacheEntry>()
  private pendingRequests = new Map<string, Promise<any>>()
  private config: CacheConfig

  constructor(config: CacheConfig = { ttl: 30000, maxSize: 100 }) {
    this.config = config
  }

  /**
   * Generate cache key from URL and options
   */
  private generateKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET'
    const headers = JSON.stringify(options?.headers || {})
    const body = options?.body || ''
    return `${method}:${url}:${headers}:${body}`
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() < entry.expiresAt
  }

  /**
   * Clean expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    
    // Remove expired entries
    for (const [key, entry] of entries) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key)
      }
    }

    // If still over max size, remove oldest entries
    if (this.cache.size > this.config.maxSize) {
      const remainingEntries = Array.from(this.cache.entries())
      remainingEntries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toRemove = remainingEntries.slice(0, this.cache.size - this.config.maxSize)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * Get cached data if available and valid
   */
  get<T = any>(url: string, options?: RequestInit): T | null {
    const key = this.generateKey(url, options)
    const entry = this.cache.get(key)
    
    if (entry && this.isValid(entry)) {
      return entry.data as T
    }
    
    return null
  }

  /**
   * Set cache data
   */
  set<T = any>(url: string, data: T, options?: RequestInit, customTTL?: number): void {
    const key = this.generateKey(url, options)
    const ttl = customTTL || this.config.ttl
    const now = Date.now()
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    })
    
    this.cleanup()
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string | RegExp): void {
    const keys = Array.from(this.cache.keys())
    const toDelete = keys.filter(key => {
      if (typeof pattern === 'string') {
        return key.includes(pattern)
      }
      return pattern.test(key)
    })
    
    toDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
  }

  /**
   * Cached fetch with deduplication
   */
  async fetch<T = any>(
    url: string, 
    options?: RequestInit, 
    cacheOptions?: { ttl?: number; skipCache?: boolean }
  ): Promise<T> {
    const key = this.generateKey(url, options)
    
    // Check cache first (unless skipCache is true)
    if (!cacheOptions?.skipCache) {
      const cached = this.get<T>(url, options)
      if (cached !== null) {
        return cached
      }
    }

    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!
    }

    // Make new request
    const requestPromise = this.makeRequest<T>(url, options)
    this.pendingRequests.set(key, requestPromise)

    try {
      const result = await requestPromise
      
      // Cache the result
      if (!cacheOptions?.skipCache) {
        this.set(url, result, options, cacheOptions?.ttl)
      }
      
      return result
    } finally {
      this.pendingRequests.delete(key)
    }
  }

  /**
   * Make actual HTTP request
   */
  private async makeRequest<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return response.json()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl
    }
  }
}

// Create singleton instance
export const apiCache = new APICache({
  ttl: 30000, // 30 seconds
  maxSize: 200 // 200 entries max
})

// Specialized caches for different data types
export const userProfileCache = new APICache({
  ttl: 60000, // 1 minute for user profiles
  maxSize: 50
})

export const followStateCache = new APICache({
  ttl: 15000, // 15 seconds for follow states (more dynamic)
  maxSize: 100
})

export const postsCache = new APICache({
  ttl: 30000, // 30 seconds for posts
  maxSize: 100
})