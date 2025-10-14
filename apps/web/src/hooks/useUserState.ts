'use client'

import { useEffect, useCallback, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { getAccessToken } from '@/utils/auth'

interface UseUserStateOptions {
  userId?: string
  autoFetch?: boolean
}

interface UserStateHook {
  userProfile: any | null
  followState: boolean
  isLoading: boolean
  error: string | null
  
  // Actions with optimistic updates
  updateProfile: (updates: any) => Promise<void>
  toggleFollow: () => Promise<void>
  refreshUserData: () => Promise<void>
}

// Cache to prevent duplicate API calls
const fetchingCache = new Map<string, Promise<any>>()
const lastFetchTime = new Map<string, number>()
const CACHE_DURATION = 30000 // 30 seconds

export function useUserState(options: UseUserStateOptions = {}): UserStateHook {
  const { userId, autoFetch = true } = options
  const {
    getUserProfile,
    getFollowState,
    updateUserProfile,
    updateFollowState,
    subscribeToStateUpdates
  } = useUser()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localUserProfile, setLocalUserProfile] = useState<any | null>(null)
  const [localFollowState, setLocalFollowState] = useState(false)

  // Get current state from context
  const userProfile = userId ? getUserProfile(userId) || localUserProfile : null
  const followState = userId ? getFollowState(userId) : localFollowState

  // Check if we have cached data
  const getCachedData = useCallback(() => {
    if (!userId) return { hasProfile: false, hasFollowState: false }
    
    const cachedProfile = getUserProfile(userId)
    const cachedFollowState = getFollowState(userId)
    
    if (cachedProfile) {
      setLocalUserProfile(cachedProfile)
      setIsLoading(false)
    }
    
    if (cachedFollowState !== undefined) {
      setLocalFollowState(cachedFollowState)
    }
    
    return { hasProfile: !!cachedProfile, hasFollowState: cachedFollowState !== undefined }
  }, [userId, getUserProfile, getFollowState])

  // Fetch user data from API with caching
  const fetchUserData = useCallback(async (targetUserId: string) => {
    if (!targetUserId) return

    // Check cache first
    const { hasProfile, hasFollowState } = getCachedData()
    const cacheKey = `${targetUserId}`
    const lastFetch = lastFetchTime.get(cacheKey)
    const now = Date.now()
    
    // If we have recent cached data, don't fetch again
    if (hasProfile && hasFollowState && lastFetch && (now - lastFetch) < CACHE_DURATION) {
      setIsLoading(false)
      return
    }

    // Check if we're already fetching this user's data
    if (fetchingCache.has(cacheKey)) {
      try {
        await fetchingCache.get(cacheKey)
        getCachedData()
        setIsLoading(false)
        return
      } catch (err) {
        // If the cached promise failed, continue with new fetch
      }
    }

    setIsLoading(true)
    setError(null)

    // Create fetch promise and cache it
    const fetchPromise = (async () => {
      try {
        const token = getAccessToken()
        if (!token) {
          throw new Error('Authentication required')
        }

        // Fetch user profile only if not cached or stale
        if (!hasProfile || !lastFetch || (now - lastFetch) >= CACHE_DURATION) {
          const profileResponse = await fetch(`/api/users/${targetUserId}/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (profileResponse && profileResponse.ok) {
            const profileData = await profileResponse.json()
            const profile = profileData.data || profileData

            // Update context state
            updateUserProfile(targetUserId, {
              id: targetUserId,
              name: profile.display_name || profile.name || profile.username,
              username: profile.username,
              email: profile.email,
              image: profile.profile_image_url || profile.image,
              display_name: profile.display_name,
              follower_count: profile.follower_count,
              following_count: profile.following_count,
              posts_count: profile.posts_count
            })

            setLocalUserProfile(profile)
          }
        }

        // Fetch follow status only if not cached or stale
        if (!hasFollowState || !lastFetch || (now - lastFetch) >= CACHE_DURATION) {
          const followResponse = await fetch(`/api/follows/${targetUserId}/status`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (followResponse && followResponse.ok) {
            const followData = await followResponse.json()
            const isFollowing = followData.data?.is_following || false

            // Update context state
            updateFollowState(targetUserId, isFollowing)
            setLocalFollowState(isFollowing)
          }
        }
        
        // Update last fetch time
        lastFetchTime.set(cacheKey, now)
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data'
        setError(errorMessage)
        console.error('Error fetching user data:', err)
        throw err
      }
    })()

    fetchingCache.set(cacheKey, fetchPromise)
    
    try {
      await fetchPromise
    } finally {
      setIsLoading(false)
      fetchingCache.delete(cacheKey)
    }
  }, [updateUserProfile, updateFollowState, getCachedData])

  // Auto-fetch user data when userId changes
  useEffect(() => {
    if (userId && autoFetch) {
      // Don't throw error immediately if no token, just set error state
      const token = getAccessToken()
      if (!token) {
        setError('Authentication required')
        setIsLoading(false)
        return
      }
      fetchUserData(userId)
    }
  }, [userId, autoFetch, fetchUserData])

  // Subscribe to state updates for real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToStateUpdates((event) => {
      if (!userId) return

      switch (event.type) {
        case 'USER_PROFILE_UPDATE':
          if (event.payload.userId === userId) {
            setLocalUserProfile((prev: any) => prev ? { ...prev, ...event.payload.updates } : null)
          }
          break
        case 'FOLLOW_STATE_UPDATE':
          if (event.payload.userId === userId) {
            setLocalFollowState(event.payload.isFollowing)
          }
          break
      }
    })

    return unsubscribe
  }, [userId, subscribeToStateUpdates])

  // Update profile with optimistic updates and API call
  const updateProfile = useCallback(async (updates: any) => {
    if (!userId) return

    // Optimistic update
    updateUserProfile(userId, updates)
    setLocalUserProfile((prev: any) => prev ? { ...prev, ...updates } : null)

    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      const result = await response.json()
      const updatedProfile = result.data || result

      // Update with server response
      updateUserProfile(userId, {
        id: userId,
        name: updatedProfile.display_name || updatedProfile.name || updatedProfile.username,
        username: updatedProfile.username,
        email: updatedProfile.email,
        image: updatedProfile.profile_image_url || updatedProfile.image,
        display_name: updatedProfile.display_name,
        follower_count: updatedProfile.follower_count,
        following_count: updatedProfile.following_count,
        posts_count: updatedProfile.posts_count
      })

      setLocalUserProfile(updatedProfile)
    } catch (err) {
      // Rollback optimistic update on error
      await fetchUserData(userId)
      throw err
    }
  }, [userId, updateUserProfile, fetchUserData])

  // Toggle follow state with optimistic updates and API call
  const toggleFollow = useCallback(async () => {
    if (!userId) return

    const currentFollowState = followState
    const newFollowState = !currentFollowState

    // Optimistic update
    updateFollowState(userId, newFollowState)
    setLocalFollowState(newFollowState)

    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      const method = currentFollowState ? 'DELETE' : 'POST'
      const response = await fetch(`/api/follows/${userId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to ${currentFollowState ? 'unfollow' : 'follow'} user`)
      }

      // Optionally refresh user data to get updated follower counts
      await fetchUserData(userId)
    } catch (err) {
      // Rollback optimistic update on error
      updateFollowState(userId, currentFollowState)
      setLocalFollowState(currentFollowState)
      throw err
    }
  }, [userId, followState, updateFollowState, fetchUserData])

  // Refresh user data
  const refreshUserData = useCallback(async () => {
    if (userId) {
      await fetchUserData(userId)
    }
  }, [userId, fetchUserData])

  return {
    userProfile,
    followState,
    isLoading,
    error,
    updateProfile,
    toggleFollow,
    refreshUserData
  }
}