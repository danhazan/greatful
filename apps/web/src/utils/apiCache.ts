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

export type QueryKey = readonly string[]
export type QueryPolicy = 'network-first' | 'cache-first-until-invalidated'
export type RefetchReason = 'mount' | 'tagInvalidation' | 'manual' | 'policyBypass'

interface TaggedQueryEntry<T = any> {
  queryKey: QueryKey
  serializedKey: string
  tags: Set<string>
  viewerScope: string
  data?: T
  error?: Error | null
  stale: boolean
  version: number
  lastFetchedAt?: number
  subscribers: Set<(reason: RefetchReason) => void>
  inFlightPromise?: Promise<T>
  inFlightVersion?: number
}

interface InvalidateOptions {
  viewerScope?: string
}

function debugLog(event: string, payload: Record<string, unknown>) {
  if (process.env['NODE_ENV'] !== 'development') return
  console.debug(`[TaggedQueryCache] ${event}`, payload)
}

export function serializeQueryKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey)
}

export function canonicalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags)).sort((left, right) => left.localeCompare(right))
}

export function serializeQueryTags(tags: string[]): string {
  return JSON.stringify(canonicalizeTags(tags))
}

function serializeScopedQueryKey(queryKey: QueryKey, viewerScope: string): string {
  return `${viewerScope}::${serializeQueryKey(queryKey)}`
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

class TaggedQueryCache {
  private entries = new Map<string, TaggedQueryEntry>()
  private tagIndex = new Map<string, Set<string>>()
  private pendingRefetches = new Map<string, RefetchReason>()
  private flushScheduled = false
  private viewerScope = 'anon'

  setViewerScope(viewerScope: string) {
    if (this.viewerScope === viewerScope) return
    this.viewerScope = viewerScope
    this.reset()
  }

  getViewerScope() {
    return this.viewerScope
  }

  private getOrCreateEntry(queryKey: QueryKey, tags: string[], viewerScope?: string): TaggedQueryEntry {
    const effectiveViewerScope = viewerScope || this.viewerScope
    const serializedKey = serializeScopedQueryKey(queryKey, effectiveViewerScope)
    let entry = this.entries.get(serializedKey)
    const canonicalTags = canonicalizeTags(tags)

    if (!entry) {
      entry = {
        queryKey,
        serializedKey,
        tags: new Set(),
        viewerScope: effectiveViewerScope,
        stale: true,
        version: 0,
        subscribers: new Set(),
      }
      this.entries.set(serializedKey, entry)
    }

    canonicalTags.forEach((tag) => {
      if (entry!.tags.has(tag)) return
      entry!.tags.add(tag)
      let keys = this.tagIndex.get(tag)
      if (!keys) {
        keys = new Set()
        this.tagIndex.set(tag, keys)
      }
      keys.add(serializedKey)
    })

    return entry
  }

  subscribe(queryKey: QueryKey, tags: string[], callback: (reason: RefetchReason) => void, viewerScope?: string): () => void {
    const entry = this.getOrCreateEntry(queryKey, tags, viewerScope)
    entry.subscribers.add(callback)
    debugLog('subscribe', { queryKey, tags, subscriberCount: entry.subscribers.size })

    return () => {
      const current = this.entries.get(entry.serializedKey)
      if (!current) return
      current.subscribers.delete(callback)
      debugLog('unsubscribe', { queryKey, subscriberCount: current.subscribers.size })
    }
  }

  getSnapshot<T = any>(queryKey: QueryKey, tags: string[], viewerScope?: string) {
    const entry = this.getOrCreateEntry(queryKey, tags, viewerScope)
    return {
      data: entry.data as T | undefined,
      error: entry.error ?? null,
      stale: entry.stale,
      version: entry.version,
      lastFetchedAt: entry.lastFetchedAt,
      viewerScope: entry.viewerScope,
    }
  }

  getVersion(queryKey: QueryKey, tags: string[], viewerScope?: string) {
    return this.getOrCreateEntry(queryKey, tags, viewerScope).version
  }

  runWithInFlight<T = any>(
    queryKey: QueryKey,
    tags: string[],
    options: {
      viewerScope?: string
      version: number
      fetcher: () => Promise<T>
    }
  ): Promise<T> {
    const entry = this.getOrCreateEntry(queryKey, tags, options.viewerScope) as TaggedQueryEntry<T>

    if (entry.inFlightPromise && entry.inFlightVersion === options.version) {
      debugLog('reuseInFlight', { queryKey, version: options.version })
      return entry.inFlightPromise
    }

    const promise = options.fetcher().finally(() => {
      const current = this.entries.get(entry.serializedKey) as TaggedQueryEntry<T> | undefined
      if (!current || current.inFlightPromise !== promise) return
      current.inFlightPromise = undefined
      current.inFlightVersion = undefined
      debugLog('clearInFlight', { queryKey, version: options.version })
    })

    entry.inFlightPromise = promise
    entry.inFlightVersion = options.version
    debugLog('setInFlight', { queryKey, version: options.version })

    return promise
  }

  setData<T = any>(
    queryKey: QueryKey,
    tags: string[],
    data: T,
    options?: { viewerScope?: string; version?: number; error?: Error | null }
  ) {
    const entry = this.getOrCreateEntry(queryKey, tags, options?.viewerScope)
    if (typeof options?.version === 'number' && options.version !== entry.version) {
      debugLog('dropSetDataVersionMismatch', { queryKey, expectedVersion: entry.version, receivedVersion: options.version })
      return false
    }

    entry.data = data
    entry.error = options?.error ?? null
    entry.stale = false
    entry.lastFetchedAt = Date.now()
    debugLog('setData', { queryKey, version: entry.version })
    return true
  }

  setError(queryKey: QueryKey, tags: string[], error: Error, options?: { viewerScope?: string; version?: number }) {
    const entry = this.getOrCreateEntry(queryKey, tags, options?.viewerScope)
    if (typeof options?.version === 'number' && options.version !== entry.version) {
      debugLog('dropSetErrorVersionMismatch', { queryKey, expectedVersion: entry.version, receivedVersion: options.version })
      return false
    }

    entry.error = error
    entry.stale = true
    debugLog('setError', { queryKey, version: entry.version, message: error.message })
    return true
  }

  patchData<T = any>(queryKey: QueryKey, updater: (current: T | undefined) => T | undefined) {
    const entry = this.entries.get(serializeScopedQueryKey(queryKey, this.viewerScope))
    if (!entry) return
    const next = updater(entry.data as T | undefined)
    if (typeof next === 'undefined') return
    entry.data = next
    entry.error = null
    debugLog('patchData', { queryKey, version: entry.version })
  }

  invalidateTags(tags: string[], options?: InvalidateOptions) {
    const affectedKeys = new Set<string>()
    const canonicalTags = canonicalizeTags(tags)

    canonicalTags.forEach((tag) => {
      const keys = this.tagIndex.get(tag)
      if (!keys) return
      keys.forEach((key) => affectedKeys.add(key))
    })

    affectedKeys.forEach((serializedKey) => {
      const entry = this.entries.get(serializedKey)
      if (!entry) return
      if (options?.viewerScope && entry.viewerScope !== options.viewerScope) return

      const oldVersion = entry.version
      entry.stale = true
      entry.version += 1
      if (entry.subscribers.size > 0) {
        this.pendingRefetches.set(serializedKey, 'tagInvalidation')
      }
      debugLog('invalidate', { queryKey: entry.queryKey, tags: canonicalTags, version: entry.version })
    })

    this.scheduleFlush()
  }

  private scheduleFlush() {
    if (this.flushScheduled) return
    this.flushScheduled = true

    queueMicrotask(() => {
      this.flushScheduled = false
      const refetches = Array.from(this.pendingRefetches.entries())
      this.pendingRefetches.clear()

      refetches.forEach(([serializedKey, reason]) => {
        const entry = this.entries.get(serializedKey)
        if (!entry) return
        entry.subscribers.forEach((subscriber) => subscriber(reason))
      })
    })
  }

  reset() {
    this.entries.clear()
    this.tagIndex.clear()
    this.pendingRefetches.clear()
    this.flushScheduled = false
    debugLog('reset', { viewerScope: this.viewerScope })
  }

  getStats() {
    const inFlightEntries = Array.from(this.entries.values()).filter((entry) => entry.inFlightPromise).length

    return {
      entries: this.entries.size,
      tagCount: this.tagIndex.size,
      pendingRefetches: this.pendingRefetches.size,
      inFlightEntries,
      viewerScope: this.viewerScope,
    }
  }
}

export const taggedQueryCache = new TaggedQueryCache()

/*
export const batchDataCache = new APICache({
  ttl: 180000, // 3 minutes for batch data (less frequent changes)
  maxSize: 100
})
*/
