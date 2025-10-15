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

// Optimized cache settings - longer durations to reduce API calls
const lastFetchTime = new Map<string, number>()
const CACHE_DURATION = 120000 // 2 minutes (increased from 30 seconds)

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

    // The request deduplicator will handle duplicate requests automatically
    // No need to check manually as it's handled in the API client

    setIsLoading(true)
    setError(null)

    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      // Use Promise.allSettled to fetch both profile and follow status concurrently
      // This reduces the number of sequential API calls
      const promises = []
      
      // Fetch user profile only if not cached or stale
      if (!hasProfile || !lastFetch || (now - lastFetch) >= CACHE_DURATION) {
        promises.push(
          apiClient.getUserProfile(targetUserId).then(profile => ({ type: 'profile', data: profile }))
        )
      }

      // Fetch follow status only if not cached or stale
      if (!hasFollowState || !lastFetch || (now - lastFetch) >= CACHE_DURATION) {
        promises.push(
          apiClient.getFollowStatus(targetUserId).then(followData => ({ type: 'follow', data: followData }))
        )
      }

      if (promises.length > 0) {
        const results = await Promise.allSettled(promises)
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const { type, data } = result.value
            
            if (type === 'profile') {
              // Update context state with correct field mapping
              updateUserProfile(targetUserId, {
                id: targetUserId,
                name: data.display_name || data.name || data.username,
                username: data.username,
                email: data.email,
                image: data.profile_image_url || data.image,
                display_name: data.display_name,
                follower_count: data.followers_count || data.follower_count || 0,
                following_count: data.following_count || data.following_count || 0,
                posts_count: data.posts_count || 0
              })
              setLocalUserProfile(data)
            } else if (type === 'follow') {
              const isFollowing = data?.is_following || false
              updateFollowState(targetUserId, isFollowing)
              setLocalFollowState(isFollowing)
            }
          } else {
            console.warn(`Failed to fetch ${result.reason}:`, result.reason)
          }
        })
        
        // Update last fetch time only if we actually made requests
        lastFetchTime.set(cacheKey, now)
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data'
      setError(errorMessage)
      console.error('Error fetching user data:', err)
    } finally {
      setIsLoading(false)
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