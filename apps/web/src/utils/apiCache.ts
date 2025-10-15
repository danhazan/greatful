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
   * Smart invalidation for related data
   */
  invalidateRelated(url: string, options?: RequestInit): void {
    const key = this.generateKey(url, options)
    
    // Define related patterns for smart invalidation
    const relatedPatterns: Record<string, string[]> = {
      '/users/': ['/follows/', '/posts/', '/notifications'],
      '/follows/': ['/users/', '/posts/'],
      '/posts/': ['/users/', '/notifications'],
      '/notifications': ['/users/']
    }
    
    // Find matching patterns and invalidate related data
    for (const [pattern, relatedUrls] of Object.entries(relatedPatterns)) {
      if (key.includes(pattern)) {
        relatedUrls.forEach(relatedPattern => {
          this.invalidate(relatedPattern)
        })
        break
      }
    }
  }

  /**
   * Batch invalidation for multiple patterns
   */
  invalidateBatch(patterns: (string | RegExp)[]): void {
    patterns.forEach(pattern => this.invalidate(pattern))
  }

  /**
   * Conditional invalidation based on data freshness
   */
  invalidateIfStale(url: string, options?: RequestInit, maxAge: number = this.config.ttl): void {
    const key = this.generateKey(url, options)
    const entry = this.cache.get(key)
    
    if (entry) {
      const age = Date.now() - entry.timestamp
      if (age > maxAge) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache hit rate statistics
   */
  getHitRate(): { hits: number; misses: number; rate: number } {
    // This would need to be tracked over time in a real implementation
    // For now, return basic stats
    return {
      hits: 0, // Would track actual hits
      misses: 0, // Would track actual misses
      rate: 0 // hits / (hits + misses)
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now()
    const entries = Array.from(this.cache.values())
    const validEntries = entries.filter(entry => now < entry.expiresAt)
    const expiredEntries = entries.length - validEntries.length
    
    return {
      size: this.cache.size,
      validEntries: validEntries.length,
      expiredEntries,
      pendingRequests: this.pendingRequests.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      memoryUsage: this.cache.size * 1024 // Rough estimate
    }
  }
}

// Create singleton instance with optimized TTL values
export const apiCache = new APICache({
  ttl: 60000, // 1 minute (increased from 30 seconds)
  maxSize: 300 // Increased cache size
})

// Specialized caches for different data types with optimized TTL values
export const userProfileCache = new APICache({
  ttl: 300000, // 5 minutes for user profiles (increased from 1 minute)
  maxSize: 100 // Increased cache size
})

export const followStateCache = new APICache({
  ttl: 120000, // 2 minutes for follow states (increased from 15 seconds)
  maxSize: 200 // Increased cache size
})

export const postsCache = new APICache({
  ttl: 60000, // 1 minute for posts (increased from 30 seconds)
  maxSize: 150 // Increased cache size
})

// New specialized caches for specific use cases
export const notificationCache = new APICache({
  ttl: 30000, // 30 seconds for notifications (more dynamic)
  maxSize: 50
})

export const batchDataCache = new APICache({
  ttl: 180000, // 3 minutes for batch data (less frequent changes)
  maxSize: 100
})