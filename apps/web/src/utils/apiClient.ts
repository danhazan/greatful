/**
 * Optimized API Client with caching and deduplication
 */

import { apiCache, userProfileCache, followStateCache, postsCache, notificationCache, QueryKey, taggedQueryCache } from './apiCache'
import { requestDeduplicator } from './requestDeduplicator'
import { getAccessToken } from './auth'
import { queryTags } from './queryKeys'

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
   * Make authenticated request with caching and deduplication
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & RequestOptions = {}
  ): Promise<T> {
    const { skipCache, cacheTTL, retries = 1, ...fetchOptions } = options

    const url = `${this.baseURL}${endpoint}`
    const authHeaders = this.getAuthHeaders()
    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
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
    } else if (endpoint.includes('/notifications')) {
      cache = notificationCache
    } else if (endpoint.includes('/batch')) {
      cache = apiCache
    }

    // Use request deduplicator for GET requests
    if (requestOptions.method === 'GET' || !requestOptions.method) {
      return requestDeduplicator.dedupe(
        url,
        async (abortSignal) => {
          const response = await cache.fetch<APIResponse<T>>(
            url,
            { ...requestOptions, signal: abortSignal },
            { skipCache, ttl: cacheTTL }
          )

          // Handle wrapped responses
          if (response && typeof response === 'object' && 'data' in response) {
            return response.data
          }

          return response as T
        },
        requestOptions,
        { retries }
      )
    }

    // For non-GET requests, use direct cache fetch
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
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      skipCache: true // PATCH requests shouldn't be cached
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
   * Invalidate cache for specific patterns with smart invalidation
   */
  invalidateCache(pattern: string | RegExp): void {
    apiCache.invalidate(pattern)
    userProfileCache.invalidate(pattern)
    followStateCache.invalidate(pattern)
    postsCache.invalidate(pattern)
    notificationCache.invalidate(pattern)
  }

  /**
   * Smart cache invalidation for related data
   */
  invalidateRelatedCache(url: string): void {
    apiCache.invalidateRelated(url)
    userProfileCache.invalidateRelated(url)
    followStateCache.invalidateRelated(url)
    postsCache.invalidateRelated(url)
    notificationCache.invalidateRelated(url)
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    apiCache.clear()
    userProfileCache.clear()
    followStateCache.clear()
    postsCache.clear()
    notificationCache.clear()

    // Also cancel any pending requests
    requestDeduplicator.cancelAll()
    taggedQueryCache.reset()
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats() {
    return {
      api: apiCache.getStats(),
      userProfile: userProfileCache.getStats(),
      followState: followStateCache.getStats(),
      posts: postsCache.getStats(),
      notifications: notificationCache.getStats(),
      deduplicator: requestDeduplicator.getStats(),
      taggedQueries: taggedQueryCache.getStats(),
    }
  }

  setViewerScope(viewerScope: string) {
    taggedQueryCache.setViewerScope(viewerScope)
  }

  getViewerScope() {
    return taggedQueryCache.getViewerScope()
  }

  invalidateTags(tags: string[]) {
    taggedQueryCache.invalidateTags(tags, { viewerScope: this.getViewerScope() })
  }

  patchTaggedQuery<T>(queryKey: QueryKey, updater: (current: T | undefined) => T | undefined) {
    taggedQueryCache.patchData<T>(queryKey, updater)
  }

  invalidateUserPosts(userId: string) {
    this.invalidateTags([queryTags.userPosts(userId)])
  }

  invalidatePostDetails(postId: string) {
    this.invalidateTags([
      queryTags.post(postId),
      queryTags.postComments(postId),
      queryTags.postReactions(postId),
    ])
  }

  invalidateFeed() {
    this.invalidateTags([queryTags.feed])
  }

  invalidateProfile(userId: string) {
    this.invalidateTags([
      queryTags.userProfile(userId),
      userId === 'me' ? queryTags.currentUserProfile : queryTags.userProfile(userId),
    ])
  }

  invalidatePostAuthorGraph(postId: string, authorId: string, options?: { includeFeed?: boolean; includeProfile?: boolean }) {
    const tags = [
      queryTags.userPosts(authorId),
      queryTags.post(postId),
      queryTags.postComments(postId),
      queryTags.postReactions(postId),
    ]

    if (options?.includeFeed) tags.push(queryTags.feed)
    if (options?.includeProfile) {
      tags.push(queryTags.currentUserProfile)
      tags.push(queryTags.userProfile(authorId))
    }

    this.invalidateTags(tags)
  }

  // Specialized methods for common operations

  /**
   * Get user profile with optimized caching
   */
  async getUserProfile(userId: string, options: RequestOptions = {}): Promise<any> {
    return this.get(`/users/${userId}/profile`, {
      cacheTTL: 300000, // Cache for 5 minutes (increased from 1 minute)
      ...options
    })
  }

  /**
   * Get follow status with optimized cache
   */
  async getFollowStatus(userId: string, options: RequestOptions = {}): Promise<any> {
    return this.get(`/follows/${userId}/status`, {
      cacheTTL: 120000, // Cache for 2 minutes (increased from 15 seconds)
      ...options
    })
  }

  /**
   * Follow/unfollow user with smart cache invalidation
   */
  async toggleFollow(userId: string, isCurrentlyFollowing: boolean) {
    const method = isCurrentlyFollowing ? 'DELETE' : 'POST'
    const result = await this.request(`/follows/${userId}`, {
      method,
      skipCache: true
    })

    // Smart cache invalidation for related data
    this.invalidateRelatedCache(`/follows/${userId}`)
    this.invalidateRelatedCache(`/users/${userId}/profile`)

    // Also invalidate current user's profile (following count changes)
    this.invalidateCache('/users/me/profile')
    this.invalidateTags([
      queryTags.currentUserProfile,
      queryTags.userProfile(userId),
    ])

    return result
  }

  /**
   * Get posts with caching
   */
  async getPosts(options: RequestOptions = {}): Promise<any> {
    return this.get('/posts', {
      cacheTTL: 60000, // Cache for 1 minute (increased from 30 seconds)
      ...options
    })
  }

  /**
   * Get user posts with caching
   */
  async getUserPosts(userId: string, options: RequestOptions = {}) {
    return this.get(`/users/${userId}/posts`, {
      cacheTTL: 90000, // Cache for 1.5 minutes (increased from 45 seconds)
      ...options
    })
  }

  /**
   * Get current user profile
   */
  async getCurrentUserProfile(options: RequestOptions = {}): Promise<any> {
    return this.get('/users/me/profile', {
      cacheTTL: 300000, // Cache for 5 minutes (increased from 1 minute)
      ...options
    })
  }

  /**
   * Get notifications with optimized caching
   */
  async getNotifications(options: RequestOptions = {}) {
    return this.get('/notifications', {
      cacheTTL: 30000, // Cache for 30 seconds (notifications are more dynamic)
      ...options
    })
  }

  // Batch get user profiles (DEPRECATED - Use getUserProfile for now)
  /*
  async getBatchUserProfiles(userIds: string[], options: RequestOptions = {}) {
    return this.post('/users/batch-profiles', { user_ids: userIds }, {
      cacheTTL: 300000, // Cache for 5 minutes
      ...options
    })
  }
  */

  /**
   * Batch get follow statuses
   */
  async getBatchFollowStatuses(userIds: string[], options: RequestOptions = {}) {
    return this.post('/follows/batch-status', { user_ids: userIds }, {
      cacheTTL: 120000, // Cache for 2 minutes
      ...options
    })
  }
}

// Create singleton instance
export const apiClient = new OptimizedAPIClient()

// Export for debugging
export { OptimizedAPIClient }
