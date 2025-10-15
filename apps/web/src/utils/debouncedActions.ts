/**
 * Debounced Actions Utility
 * Provides debouncing for user-triggered actions like search, autocomplete, etc.
 */

interface DebounceOptions {
  delay: number
  immediate?: boolean // Execute immediately on first call
  maxWait?: number // Maximum time to wait before executing
}

interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): Promise<ReturnType<T>>
  cancel: () => void
  flush: () => Promise<ReturnType<T> | undefined>
  pending: () => boolean
}

/**
 * Create a debounced version of a function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  options: DebounceOptions
): DebouncedFunction<T> {
  let timeoutId: NodeJS.Timeout | null = null
  let maxTimeoutId: NodeJS.Timeout | null = null
  let lastCallTime = 0
  let lastArgs: Parameters<T> | null = null
  let lastResult: ReturnType<T> | undefined
  let pendingPromise: Promise<ReturnType<T>> | null = null
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null
  let rejectPromise: ((error: any) => void) | null = null

  const { delay, immediate = false, maxWait } = options

  const execute = async (): Promise<ReturnType<T>> => {
    if (!lastArgs) {
      throw new Error('No arguments available for execution')
    }

    try {
      const result = await func(...lastArgs)
      lastResult = result
      return result
    } catch (error) {
      throw error
    }
  }

  const debouncedFunction = (...args: Parameters<T>): Promise<ReturnType<T>> => {
    lastArgs = args
    lastCallTime = Date.now()

    // If there's already a pending promise, return it
    if (pendingPromise) {
      return pendingPromise
    }

    // Create new promise
    pendingPromise = new Promise<ReturnType<T>>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    const executeAndResolve = async () => {
      try {
        const result = await execute()
        if (resolvePromise) {
          resolvePromise(result)
        }
      } catch (error) {
        if (rejectPromise) {
          rejectPromise(error)
        }
      } finally {
        // Clean up
        pendingPromise = null
        resolvePromise = null
        rejectPromise = null
        timeoutId = null
        if (maxTimeoutId) {
          clearTimeout(maxTimeoutId)
          maxTimeoutId = null
        }
      }
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Execute immediately if requested and this is the first call
    if (immediate && !timeoutId && !maxTimeoutId) {
      executeAndResolve()
      return pendingPromise
    }

    // Set up debounce timeout
    timeoutId = setTimeout(executeAndResolve, delay)

    // Set up max wait timeout if specified
    if (maxWait && !maxTimeoutId) {
      maxTimeoutId = setTimeout(executeAndResolve, maxWait)
    }

    return pendingPromise
  }

  // Cancel pending execution
  debouncedFunction.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId)
      maxTimeoutId = null
    }
    if (rejectPromise) {
      rejectPromise(new Error('Debounced function cancelled'))
    }
    pendingPromise = null
    resolvePromise = null
    rejectPromise = null
  }

  // Execute immediately
  debouncedFunction.flush = async (): Promise<ReturnType<T> | undefined> => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId)
      maxTimeoutId = null
    }

    if (lastArgs) {
      try {
        const result = await execute()
        if (resolvePromise) {
          resolvePromise(result)
        }
        return result
      } catch (error) {
        if (rejectPromise) {
          rejectPromise(error)
        }
        throw error
      } finally {
        pendingPromise = null
        resolvePromise = null
        rejectPromise = null
      }
    }

    return lastResult
  }

  // Check if execution is pending
  debouncedFunction.pending = (): boolean => {
    return timeoutId !== null || maxTimeoutId !== null
  }

  return debouncedFunction
}

/**
 * Debounced search function factory
 */
export function createDebouncedSearch<T>(
  searchFunction: (query: string) => Promise<T[]>,
  delay: number = 300
) {
  return debounce(searchFunction, {
    delay,
    maxWait: 1000 // Maximum 1 second wait
  })
}

/**
 * Debounced API call function factory
 */
export function createDebouncedApiCall<T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  delay: number = 500
) {
  return debounce(apiFunction, {
    delay,
    maxWait: 2000 // Maximum 2 seconds wait
  })
}

/**
 * Throttle function - limits execution to once per interval
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number
): T {
  let lastCallTime = 0
  let timeoutId: NodeJS.Timeout | null = null

  return ((...args: Parameters<T>) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    if (timeSinceLastCall >= interval) {
      // Execute immediately
      lastCallTime = now
      return func(...args)
    } else {
      // Schedule execution
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      const remainingTime = interval - timeSinceLastCall
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now()
        func(...args)
        timeoutId = null
      }, remainingTime)
    }
  }) as T
}

/**
 * Rate limiter - prevents function from being called more than N times per interval
 */
export function rateLimit<T extends (...args: any[]) => any>(
  func: T,
  maxCalls: number,
  interval: number
): T {
  const calls: number[] = []

  return ((...args: Parameters<T>) => {
    const now = Date.now()
    
    // Remove old calls outside the interval
    while (calls.length > 0 && now - calls[0] > interval) {
      calls.shift()
    }

    // Check if we've exceeded the rate limit
    if (calls.length >= maxCalls) {
      console.warn(`Rate limit exceeded: ${maxCalls} calls per ${interval}ms`)
      return
    }

    // Record this call and execute
    calls.push(now)
    return func(...args)
  }) as T
}

// Pre-configured debounced functions for common use cases
export const debouncedSearch = createDebouncedSearch(
  async (query: string) => {
    // This would be replaced with actual search implementation
    return []
  },
  300
)

export const debouncedUserSearch = createDebouncedSearch(
  async (query: string) => {
    // This would be replaced with actual user search implementation
    return []
  },
  300
)

// Throttled functions for frequent events
export const throttledScroll = throttle((callback: () => void) => {
  callback()
}, 100)

export const throttledResize = throttle((callback: () => void) => {
  callback()
}, 250)

// Rate limited functions for API calls
export const rateLimitedApiCall = rateLimit(
  (callback: () => void) => {
    callback()
  },
  10, // 10 calls
  60000 // per minute
)