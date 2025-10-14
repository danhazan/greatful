'use client'

import React, { useEffect, useCallback, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { getAccessToken } from '@/utils/auth'
import { apiClient } from '@/utils/apiClient'

interface UseUserStateOptions {
  userId?: string
  autoFetch?: boolean
  initialFollowState?: boolean
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
  const { userId, autoFetch = true, initialFollowState = false } = options
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
  const [localFollowState, setLocalFollowState] = useState(initialFollowState)

  // Debug logging to track which users are being processed
  React.useEffect(() => {
    if (userId) {
      console.log('useUserState hook initialized for userId:', userId)
    }
  }, [userId])

  // Get current state from context, with proper fallback to initial state
  const userProfile = userId ? getUserProfile(userId) || localUserProfile : null
  const contextFollowState = userId ? getFollowState(userId) : undefined
  const followState = contextFollowState !== undefined ? contextFollowState : localFollowState

  // Check if we have cached data
  const getCachedData = useCallback(() => {
    if (!userId) return { hasProfile: false, hasFollowState: false }
    
    const cachedProfile = getUserProfile(userId)
    const cachedFollowState = getFollowState(userId)
    
    if (cachedProfile) {
      setLocalUserProfile(cachedProfile)
      setIsLoading(false)
    }
    
    // Only update local state if we have a definitive cached state
    // Don't override initialFollowState with undefined
    if (cachedFollowState !== undefined) {
      setLocalFollowState(cachedFollowState)
    }
    
    return { hasProfile: !!cachedProfile, hasFollowState: cachedFollowState !== undefined }
  }, [userId, getUserProfile, getFollowState])

  // Fetch user data from API with optimized caching
  const fetchUserData = useCallback(async (targetUserId: string) => {
    if (!targetUserId) return

    console.log('useUserState fetchUserData called for userId:', targetUserId)

    // Check cache first
    const { hasProfile, hasFollowState } = getCachedData()
    const cacheKey = `${targetUserId}`
    const lastFetch = lastFetchTime.get(cacheKey)
    const now = Date.now()
    
    // If we have recent cached data, don't fetch again
    if (hasProfile && hasFollowState && lastFetch && (now - lastFetch) < CACHE_DURATION) {
      console.log('Using cached data for userId:', targetUserId)
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
          try {
            const profile: any = await apiClient.getUserProfile(targetUserId)

            // Update context state with correct field mapping
            updateUserProfile(targetUserId, {
              id: targetUserId,
              name: profile.display_name || profile.name || profile.username,
              username: profile.username,
              email: profile.email,
              image: profile.profile_image_url || profile.image,
              display_name: profile.display_name,
              follower_count: profile.followers_count || profile.follower_count || 0,
              following_count: profile.following_count || profile.following_count || 0,
              posts_count: profile.posts_count || 0
            })

            setLocalUserProfile(profile)
          } catch (profileError) {
            console.warn('Failed to fetch user profile:', profileError)
            // Don't fail the entire operation if profile fetch fails
          }
        }

        // Fetch follow status only if not cached or stale
        if (!hasFollowState || !lastFetch || (now - lastFetch) >= CACHE_DURATION) {
          try {
            const followData: any = await apiClient.getFollowStatus(targetUserId)
            const isFollowing = followData?.is_following || false

            // Update context state
            updateFollowState(targetUserId, isFollowing)
            setLocalFollowState(isFollowing)
          } catch (followError) {
            console.warn('Failed to fetch follow status:', followError)
            // Default to false if follow status fetch fails
            updateFollowState(targetUserId, false)
            setLocalFollowState(false)
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
      
      // Check if we already have recent cached data
      const { hasProfile, hasFollowState } = getCachedData()
      const cacheKey = `${userId}`
      const lastFetch = lastFetchTime.get(cacheKey)
      const now = Date.now()
      
      // Only fetch if we don't have cached data or it's stale
      if (!hasProfile || !hasFollowState || !lastFetch || (now - lastFetch) >= CACHE_DURATION) {
        fetchUserData(userId)
      } else {
        // We have cached data, just set loading to false
        setIsLoading(false)
      }
    } else if (!autoFetch) {
      // If autoFetch is disabled, don't show loading state
      setIsLoading(false)
    }
  }, [userId, autoFetch]) // Remove fetchUserData from dependencies to prevent loops

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
    if (!userId || isLoading) return // Prevent multiple simultaneous calls

    const currentFollowState = followState
    const newFollowState = !currentFollowState

    // Set loading state to prevent rapid clicks
    setIsLoading(true)

    // Optimistic update
    updateFollowState(userId, newFollowState)
    setLocalFollowState(newFollowState)

    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      // Use optimized API client with cache invalidation
      await apiClient.toggleFollow(userId, currentFollowState)

      // The API client handles cache invalidation automatically
      // Refresh the user profile to get updated follower count
      setTimeout(() => {
        fetchUserData(userId)
      }, 500) // Small delay to allow backend to update

      // Emit follower count update for profile pages
      try {
        // Don't calculate the new count here - let the ProfilePage calculate it
        // based on its current state to avoid stale data issues
        const event = new CustomEvent('followerCountUpdate', {
          detail: {
            userId: userId,
            isFollowing: newFollowState,
            timestamp: Date.now()
          }
        })
        window.dispatchEvent(event)
      } catch (error) {
        console.error('Error emitting follower count update:', error)
      }

    } catch (err) {
      // Rollback optimistic update on error
      updateFollowState(userId, currentFollowState)
      setLocalFollowState(currentFollowState)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [userId, followState, updateFollowState, isLoading, fetchUserData])

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