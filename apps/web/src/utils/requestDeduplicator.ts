/**
 * Global Request Deduplication Service
 * Prevents multiple identical API calls and implements request coalescing
 */

interface PendingRequest<T = any> {
  promise: Promise<T>
  timestamp: number
  abortController?: AbortController
}

interface RequestConfig {
  timeout?: number // Request timeout in milliseconds
  retries?: number // Number of retry attempts
  coalesceWindow?: number // Time window for request coalescing in milliseconds
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>()
  private requestHistory = new Map<string, number>() // Track last request time
  private defaultConfig: RequestConfig = {
    timeout: 30000, // 30 seconds
    retries: 2,
    coalesceWindow: 100 // 100ms window for coalescing
  }

  /**
   * Generate a unique key for the request
   */
  private generateKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET'
    const body = options?.body || ''
    
    // Exclude headers that change frequently but don't affect the response
    const relevantHeaders = { ...options?.headers } as any
    delete relevantHeaders['Authorization'] // Auth is handled separately
    delete relevantHeaders['X-Request-ID']
    delete relevantHeaders['User-Agent']
    
    const headersString = JSON.stringify(relevantHeaders)
    return `${method}:${url}:${headersString}:${body}`
  }

  /**
   * Check if a request should be coalesced with an existing one
   */
  private shouldCoalesce(key: string, config: RequestConfig): boolean {
    const pending = this.pendingRequests.get(key)
    if (!pending) return false
    
    const now = Date.now()
    const timeSinceRequest = now - pending.timestamp
    
    return timeSinceRequest < (config.coalesceWindow || this.defaultConfig.coalesceWindow!)
  }

  /**
   * Clean up expired pending requests
   */
  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, request] of Array.from(this.pendingRequests.entries())) {
      const age = now - request.timestamp
      const timeout = this.defaultConfig.timeout!
      
      if (age > timeout) {
        expiredKeys.push(key)
        // Abort the request if possible
        if (request.abortController) {
          request.abortController.abort()
        }
      }
    }
    
    expiredKeys.forEach(key => {
      this.pendingRequests.delete(key)
      this.requestHistory.set(key, now)
    })
  }

  /**
   * Deduplicate and coalesce requests
   */
  async dedupe<T>(
    url: string,
    requestFn: (abortSignal?: AbortSignal) => Promise<T>,
    options?: RequestInit,
    config: RequestConfig = {}
  ): Promise<T> {
    const key = this.generateKey(url, options)
    const mergedConfig = { ...this.defaultConfig, ...config }
    
    // Clean up expired requests periodically
    if (Math.random() < 0.1) { // 10% chance to trigger cleanup
      this.cleanup()
    }
    
    // Check if we should coalesce with an existing request
    if (this.shouldCoalesce(key, mergedConfig)) {
      console.debug(`🔄 Coalescing request: ${url}`)
      return this.pendingRequests.get(key)!.promise
    }
    
    // Check if there's already a pending request for this key
    const existingRequest = this.pendingRequests.get(key)
    if (existingRequest) {
      console.debug(`⏳ Deduplicating request: ${url}`)
      return existingRequest.promise
    }
    
    // Create abort controller for request cancellation
    const abortController = new AbortController()
    
    // Create new request
    const promise = this.executeRequest(
      requestFn,
      abortController.signal,
      mergedConfig
    )
    
    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      abortController
    })
    
    console.debug(`🚀 New request: ${url}`)
    
    try {
      const result = await promise
      return result
    } finally {
      // Clean up completed request
      this.pendingRequests.delete(key)
      this.requestHistory.set(key, Date.now())
    }
  }

  /**
   * Execute request with retry logic and timeout
   */
  private async executeRequest<T>(
    requestFn: (abortSignal?: AbortSignal) => Promise<T>,
    abortSignal: AbortSignal,
    config: RequestConfig
  ): Promise<T> {
    let lastError: Error | null = null
    const maxRetries = config.retries || 0
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout to the request
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Request timeout after ${config.timeout}ms`))
          }, config.timeout)
          
          // Clear timeout if request completes or is aborted
          abortSignal.addEventListener('abort', () => {
            clearTimeout(timeoutId)
            reject(new Error('Request aborted'))
          })
        })
        
        const result = await Promise.race([
          requestFn(abortSignal),
          timeoutPromise
        ])
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry if request was aborted or on final attempt
        if (abortSignal.aborted || attempt === maxRetries) {
          break
        }
        
        // Exponential backoff for retries
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        console.debug(`🔄 Retrying request (attempt ${attempt + 2}/${maxRetries + 1})`)
      }
    }
    
    throw lastError || new Error('Request failed')
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    for (const [key, request] of Array.from(this.pendingRequests.entries())) {
      if (request.abortController) {
        request.abortController.abort()
      }
    }
    this.pendingRequests.clear()
  }

  /**
   * Cancel specific request by URL pattern
   */
  cancel(urlPattern: string | RegExp): void {
    const keysToCancel: string[] = []
    
    for (const [key, request] of Array.from(this.pendingRequests.entries())) {
      const matches = typeof urlPattern === 'string' 
        ? key.includes(urlPattern)
        : urlPattern.test(key)
        
      if (matches) {
        keysToCancel.push(key)
        if (request.abortController) {
          request.abortController.abort()
        }
      }
    }
    
    keysToCancel.forEach(key => this.pendingRequests.delete(key))
  }

  /**
   * Get statistics about pending requests
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      requestHistory: this.requestHistory.size,
      oldestPendingRequest: Math.min(
        ...Array.from(this.pendingRequests.values()).map(r => r.timestamp)
      )
    }
  }

  /**
   * Check if a request is currently pending
   */
  isPending(url: string, options?: RequestInit): boolean {
    const key = this.generateKey(url, options)
    return this.pendingRequests.has(key)
  }

  /**
   * Get time since last request for a given URL
   */
  getTimeSinceLastRequest(url: string, options?: RequestInit): number | null {
    const key = this.generateKey(url, options)
    const lastRequestTime = this.requestHistory.get(key)
    
    if (!lastRequestTime) return null
    
    return Date.now() - lastRequestTime
  }
}

// Create singleton instance
export const requestDeduplicator = new RequestDeduplicator()

// Export class for testing
export { RequestDeduplicator }

// Utility function for easy integration
export function dedupeRequest<T>(
  url: string,
  requestFn: (abortSignal?: AbortSignal) => Promise<T>,
  options?: RequestInit,
  config?: RequestConfig
): Promise<T> {
  return requestDeduplicator.dedupe(url, requestFn, options, config)
}