/**
 * Optimized API Client with caching and deduplication
 */

import { apiCache, userProfileCache, followStateCache, postsCache } from './apiCache'
import { getAccessToken } from './auth'

interface APIResponse<T = any> {
  success: boolean
  data: T
  error?: string
}

interface RequestOptions {
  skipCache?: boolean
  cacheTTL?: number
  retries?: number
}

class OptimizedAPIClient {
  private baseURL: string

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): Record<string, string> {
    const token = getAccessToken()
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  }

  /**
   * Make authenticated request with caching
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & RequestOptions = {}
  ): Promise<T> {
    const { skipCache, cacheTTL, retries = 1, ...fetchOptions } = options
    
    const url = `${this.baseURL}${endpoint}`
    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...fetchOptions.headers
      }
    }

    // Use appropriate cache based on endpoint
    let cache = apiCache
    if (endpoint.includes('/profile')) {
      cache = userProfileCache
    } else if (endpoint.includes('/follows')) {
      cache = followStateCache
    } else if (endpoint.includes('/posts')) {
      cache = postsCache
    }

    try {
      const response = await cache.fetch<APIResponse<T>>(
        url,
        requestOptions,
        { skipCache, ttl: cacheTTL }
      )

      // Handle wrapped responses
      if (response && typeof response === 'object' && 'data' in response) {
        return response.data
      }
      
      return response as T
    } catch (error) {
      if (retries > 0) {
        console.warn(`Request failed, retrying... (${retries} attempts left)`)
        return this.request<T>(endpoint, { ...options, retries: retries - 1 })
      }
      throw error
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string, 
    data?: any, 
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      skipCache: true // POST requests shouldn't be cached
    })
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string, 
    data?: any, 
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      skipCache: true // PUT requests shouldn't be cached
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
      skipCache: true // DELETE requests shouldn't be cached
    })
  }

  /**
   * Invalidate cache for specific patterns
   */
  invalidateCache(pattern: string | RegExp): void {
    apiCache.invalidate(pattern)
    userProfileCache.invalidate(pattern)
    followStateCache.invalidate(pattern)
    postsCache.invalidate(pattern)
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    apiCache.clear()
    userProfileCache.clear()
    followStateCache.clear()
    postsCache.clear()
  }

  // Specialized methods for common operations

  /**
   * Get user profile with optimized caching
   */
  async getUserProfile(userId: string, options: RequestOptions = {}) {
    return this.get(`/users/${userId}/profile`, {
      cacheTTL: 60000, // Cache for 1 minute
      ...options
    })
  }

  /**
   * Get follow status with shorter cache
   */
  async getFollowStatus(userId: string, options: RequestOptions = {}) {
    return this.get(`/follows/${userId}/status`, {
      cacheTTL: 15000, // Cache for 15 seconds
      ...options
    })
  }

  /**
   * Follow/unfollow user with cache invalidation
   */
  async toggleFollow(userId: string, isCurrentlyFollowing: boolean) {
    const method = isCurrentlyFollowing ? 'DELETE' : 'POST'
    const result = await this.request(`/follows/${userId}`, {
      method,
      skipCache: true
    })

    // Invalidate related caches
    this.invalidateCache(`/follows/${userId}`)
    this.invalidateCache(`/users/${userId}/profile`)
    
    return result
  }

  /**
   * Get posts with caching
   */
  async getPosts(options: RequestOptions = {}) {
    return this.get('/posts', {
      cacheTTL: 30000, // Cache for 30 seconds
      ...options
    })
  }

  /**
   * Get user posts with caching
   */
  async getUserPosts(userId: string, options: RequestOptions = {}) {
    return this.get(`/users/${userId}/posts`, {
      cacheTTL: 45000, // Cache for 45 seconds
      ...options
    })
  }

  /**
   * Get current user profile
   */
  async getCurrentUserProfile(options: RequestOptions = {}) {
    return this.get('/users/me/profile', {
      cacheTTL: 60000, // Cache for 1 minute
      ...options
    })
  }
}

// Create singleton instance
export const apiClient = new OptimizedAPIClient()

// Export for debugging
export { OptimizedAPIClient }