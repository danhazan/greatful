'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { stateSyncUtils } from '@/utils/stateSynchronization'
import { apiClient } from '@/utils/apiClient'
import * as auth from '@/utils/auth'

export interface User {
  id: string
  name: string
  displayName?: string
  username: string
  email: string
  profileImageUrl?: string
}

export interface UserProfile extends User {
  followerCount?: number
  followingCount?: number
  postsCount?: number
}

interface FollowState {
  [userId: string]: boolean
}

interface UserStateUpdate {
  userId: string
  updates: Partial<UserProfile>
}

interface FollowStateUpdate {
  userId: string
  isFollowing: boolean
}

// Event types for state synchronization
export type StateEvent =
  | { type: 'USER_PROFILE_UPDATE'; payload: UserStateUpdate }
  | { type: 'FOLLOW_STATE_UPDATE'; payload: FollowStateUpdate }
  | { type: 'CURRENT_USER_UPDATE'; payload: Partial<User> }

interface UserContextType {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  loading: boolean
  isLoading: boolean

  // Enhanced state management
  userProfiles: { [userId: string]: UserProfile }
  followStates: FollowState

  // State update methods
  updateUserProfile: (userId: string, updates: Partial<UserProfile>) => void
  updateFollowState: (userId: string, isFollowing: boolean) => void
  updateCurrentUser: (updates: Partial<User>) => void
  getUserProfile: (userId: string) => UserProfile | null
  getFollowState: (userId: string) => boolean

  // Cache management
  markDataAsFresh: (userId: string) => void
  getLastFetchTime: (userId: string) => number | undefined

  // Authentication methods
  logout: () => void
  reloadUser: () => Promise<void>

  // Event subscription for components
  subscribeToStateUpdates: (callback: (event: StateEvent) => void) => () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const currentUserBootstrapPromises = new Map<string, Promise<any>>()
const currentUserBootstrapResults = new Map<string, any>()

function clearOtherCurrentUserBootstrapEntries(activeToken: string) {
  for (const token of Array.from(currentUserBootstrapPromises.keys())) {
    if (token !== activeToken) {
      currentUserBootstrapPromises.delete(token)
    }
  }

  for (const token of Array.from(currentUserBootstrapResults.keys())) {
    if (token !== activeToken) {
      currentUserBootstrapResults.delete(token)
    }
  }
}

function getCurrentUserBootstrap(token: string, options?: { forceRefresh?: boolean }) {
  if (options?.forceRefresh) {
    currentUserBootstrapPromises.delete(token)
    currentUserBootstrapResults.delete(token)
  } else {
    const cachedResult = currentUserBootstrapResults.get(token)
    if (cachedResult) {
      return Promise.resolve(cachedResult)
    }

    const existingPromise = currentUserBootstrapPromises.get(token)
    if (existingPromise) {
      return existingPromise
    }
  }

  const bootstrapPromise = apiClient.getCurrentUserProfile()
    .then((result) => {
      currentUserBootstrapResults.set(token, result)
      return result
    })
    .catch((error) => {
      currentUserBootstrapPromises.delete(token)
      throw error
    })

  currentUserBootstrapPromises.set(token, bootstrapPromise)
  return bootstrapPromise
}

function clearCurrentUserBootstrap(token?: string | null) {
  if (token) {
    currentUserBootstrapPromises.delete(token)
    currentUserBootstrapResults.delete(token)
    return
  }

  currentUserBootstrapPromises.clear()
  currentUserBootstrapResults.clear()
}

export function resetCurrentUserBootstrapForTests() {
  clearCurrentUserBootstrap()
}

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userProfiles, setUserProfiles] = useState<{ [userId: string]: UserProfile }>({})
  const [followStates, setFollowStates] = useState<FollowState>({})
  const [lastFetchTimes, setLastFetchTimes] = useState<{ [userId: string]: number }>({})
  const [stateEventListeners, setStateEventListeners] = useState<Set<(event: StateEvent) => void>>(new Set())
  const [viewerScope, setViewerScope] = useState('anon')
  const currentUserRef = useRef<User | null>(currentUser)
  const isLoadingRef = useRef(isLoading)
  const userProfilesRef = useRef(userProfiles)

  currentUserRef.current = currentUser
  isLoadingRef.current = isLoading
  userProfilesRef.current = userProfiles

  const setCurrentUserWithTrace = useCallback((
    nextUser: User | null | ((previousUser: User | null) => User | null),
    _reason: string
  ) => {
    setCurrentUser((previousUser) => {
      if (typeof nextUser === 'function') {
        return (nextUser as (previousUser: User | null) => User | null)(previousUser)
      }
      return nextUser
    })
  }, [])

  // Event emission helper
  const emitStateEvent = useCallback((event: StateEvent) => {
    stateEventListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in state event listener:', error)
      }
    })
  }, [stateEventListeners])

  // Load user function
  const loadUser = useCallback(async (options?: { forceRefresh?: boolean }) => {
    try {
      if (typeof window === 'undefined') {
        setIsLoading(false)
        return
      }

      const token = auth.getAccessToken()
      if (!token) {
        clearCurrentUserBootstrap()
        setCurrentUserWithTrace(null, 'loadUser:noToken')
        setIsLoading(false)
        return
      }

      clearOtherCurrentUserBootstrapEntries(token)

      // Reuse the same bootstrap request across Strict Mode remounts and concurrent consumers.
      const userData = await getCurrentUserBootstrap(token, options) as any

      if (userData && userData.id) {
        const user: User = {
          id: userData.id.toString(),
          name: userData.displayName || userData.name || userData.username,
          displayName: userData.displayName,
          username: userData.username,
          email: userData.email,
          profileImageUrl: userData.profileImageUrl
        }

        setCurrentUserWithTrace(user, 'loadUser:profileFetchSuccess')

        // Also store in user profiles for consistency
        const userProfile: UserProfile = {
          ...user,
          followerCount: userData.followerCount,
          followingCount: userData.followingCount,
          postsCount: userData.postsCount
        }

        setUserProfiles(prev => ({
          ...prev,
          [user.id]: userProfile
        }))
      } else {
        auth.logout()
        clearCurrentUserBootstrap(token)
        setCurrentUserWithTrace(null, 'loadUser:nullUserData')
      }
    } catch (error) {
      console.error('[UserContext] loadUser error', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('401')) {
        auth.logout()
      }
      clearCurrentUserBootstrap(auth.getAccessToken())
      setCurrentUserWithTrace(null, 'loadUser:catch')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Subscribe to state updates
  const subscribeToStateUpdates = useCallback((callback: (event: StateEvent) => void) => {
    setStateEventListeners(prev => {
      const newSet = new Set(prev)
      newSet.add(callback)
      return newSet
    })

    return () => {
      setStateEventListeners(prev => {
        const newSet = new Set(prev)
        newSet.delete(callback)
        return newSet
      })
    }
  }, [])

  // Update user profile with optimistic updates and event emission
  const updateUserProfile = useCallback((userId: string, updates: Partial<UserProfile>) => {
    setUserProfiles(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        ...updates,
        id: userId
      } as UserProfile
    }))

    emitStateEvent({
      type: 'USER_PROFILE_UPDATE',
      payload: { userId, updates }
    })

    // Emit global state sync event
    stateSyncUtils.updateUserProfile(userId, updates)

    // If updating current user, also update current user state
    if (currentUser && currentUser.id === userId) {
      const currentUserUpdates: Partial<User> = {}
      if (updates.displayName !== undefined) currentUserUpdates.displayName = updates.displayName
      if (updates.name !== undefined) currentUserUpdates.name = updates.name
      if (updates.username !== undefined) currentUserUpdates.username = updates.username
      if (updates.email !== undefined) currentUserUpdates.email = updates.email
      if (updates.profileImageUrl !== undefined) currentUserUpdates.profileImageUrl = updates.profileImageUrl

      if (Object.keys(currentUserUpdates).length > 0) {
        setCurrentUserWithTrace(prev => prev ? { ...prev, ...currentUserUpdates } : null, 'updateUserProfile:currentUserUpdates')
        emitStateEvent({
          type: 'CURRENT_USER_UPDATE',
          payload: currentUserUpdates
        })
      }
    }
  }, [currentUser, emitStateEvent])

  // Update follow state with optimistic updates and event emission
  const updateFollowState = useCallback((userId: string, isFollowing: boolean) => {
    setFollowStates(prev => ({
      ...prev,
      [userId]: isFollowing
    }))

    emitStateEvent({
      type: 'FOLLOW_STATE_UPDATE',
      payload: { userId, isFollowing }
    })

    stateSyncUtils.updateFollowState(userId, isFollowing)
  }, [emitStateEvent])

  // Update current user
  const updateCurrentUser = useCallback((updates: Partial<User>) => {
    setCurrentUserWithTrace(prev => prev ? { ...prev, ...updates } : null, 'updateCurrentUser')

    emitStateEvent({
      type: 'CURRENT_USER_UPDATE',
      payload: updates
    })

    if (currentUser) {
      const profileUpdates: Partial<UserProfile> = {}
      if (updates.displayName !== undefined) profileUpdates.displayName = updates.displayName
      if (updates.name !== undefined) profileUpdates.name = updates.name
      if (updates.username !== undefined) profileUpdates.username = updates.username
      if (updates.email !== undefined) profileUpdates.email = updates.email
      if (updates.profileImageUrl !== undefined) profileUpdates.profileImageUrl = updates.profileImageUrl

      if (Object.keys(profileUpdates).length > 0) {
        updateUserProfile(currentUser.id, profileUpdates)
      }
    }
  }, [currentUser, updateUserProfile, emitStateEvent])

  // Get user profile
  const getUserProfile = useCallback((userId: string): UserProfile | null => {
    return userProfiles[userId] || null
  }, [userProfiles])

  // Get follow state
  const getFollowState = useCallback((userId: string): boolean => {
    return followStates[userId] || false
  }, [followStates])

  // Mark data as fresh
  const markDataAsFresh = useCallback((userId: string) => {
    setLastFetchTimes(prev => ({
      ...prev,
      [userId]: Date.now()
    }))
  }, [])

  // Get last fetch time
  const getLastFetchTime = useCallback((userId: string): number | undefined => {
    return lastFetchTimes[userId]
  }, [lastFetchTimes])

  // Comprehensive logout function
  const logout = useCallback(() => {
    clearCurrentUserBootstrap(auth.getAccessToken())
    auth.logout()
    setCurrentUserWithTrace(null, 'logout')
    setUserProfiles({})
    setFollowStates({})
    setLastFetchTimes({})
    setViewerScope('anon')
    apiClient.clearCache()
    emitStateEvent({
      type: 'CURRENT_USER_UPDATE',
      payload: { id: '', name: '', username: '', email: '' }
    })
  }, [emitStateEvent])

  useEffect(() => {
    const nextScope = currentUser ? `user:${currentUser.id}` : 'anon'
    if (viewerScope === nextScope) return

    setViewerScope(nextScope)
    setUserProfiles({})
    setFollowStates({})
    setLastFetchTimes({})
    apiClient.setViewerScope(nextScope)
  }, [currentUser, viewerScope])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const value: UserContextType = {
    currentUser,
    setCurrentUser: (nextUser) => setCurrentUserWithTrace(nextUser, 'contextValue:setCurrentUser'),
    loading: isLoading,
    isLoading,
    userProfiles,
    followStates,
    updateUserProfile,
    updateFollowState,
    updateCurrentUser,
    getUserProfile,
    getFollowState,
    markDataAsFresh,
    getLastFetchTime,
    logout,
    reloadUser: () => loadUser({ forceRefresh: true }),
    subscribeToStateUpdates
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
