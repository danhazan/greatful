'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { stateSyncUtils } from '@/utils/stateSynchronization'
import { apiClient } from '@/utils/apiClient'

interface User {
  id: string
  name: string
  username: string  // Required - all users have usernames
  email: string
  image?: string
  display_name?: string
}

interface UserProfile {
  id: string
  name: string
  username: string
  email: string
  image?: string
  display_name?: string
  follower_count?: number
  following_count?: number
  posts_count?: number
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
type StateEvent = 
  | { type: 'USER_PROFILE_UPDATE'; payload: UserStateUpdate }
  | { type: 'FOLLOW_STATE_UPDATE'; payload: FollowStateUpdate }
  | { type: 'CURRENT_USER_UPDATE'; payload: Partial<User> }

interface UserContextType {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
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
  
  // Event subscription for components
  subscribeToStateUpdates: (callback: (event: StateEvent) => void) => () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userProfiles, setUserProfiles] = useState<{ [userId: string]: UserProfile }>({})
  const [followStates, setFollowStates] = useState<FollowState>({})
  const [stateEventListeners, setStateEventListeners] = useState<Set<(event: StateEvent) => void>>(new Set())

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

  // Subscribe to state updates
  const subscribeToStateUpdates = useCallback((callback: (event: StateEvent) => void) => {
    setStateEventListeners(prev => {
      const newSet = new Set(prev)
      newSet.add(callback)
      return newSet
    })
    
    // Return unsubscribe function
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
        id: userId // Ensure ID is preserved
      } as UserProfile
    }))

    // Emit state update event (internal)
    emitStateEvent({
      type: 'USER_PROFILE_UPDATE',
      payload: { userId, updates }
    })

    // Emit global state sync event
    stateSyncUtils.updateUserProfile(userId, updates)

    // If updating current user, also update current user state
    if (currentUser && currentUser.id === userId) {
      const currentUserUpdates: Partial<User> = {}
      if (updates.display_name !== undefined) currentUserUpdates.name = updates.display_name
      if (updates.username !== undefined) currentUserUpdates.username = updates.username
      if (updates.email !== undefined) currentUserUpdates.email = updates.email
      if (updates.image !== undefined) currentUserUpdates.image = updates.image
      
      if (Object.keys(currentUserUpdates).length > 0) {
        setCurrentUser(prev => prev ? { ...prev, ...currentUserUpdates } : null)
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

    // Emit state update event (internal)
    emitStateEvent({
      type: 'FOLLOW_STATE_UPDATE',
      payload: { userId, isFollowing }
    })

    // Emit global state sync event
    stateSyncUtils.updateFollowState(userId, isFollowing)
  }, [emitStateEvent])

  // Update current user
  const updateCurrentUser = useCallback((updates: Partial<User>) => {
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null)
    
    // Emit state update event
    emitStateEvent({
      type: 'CURRENT_USER_UPDATE',
      payload: updates
    })

    // Also update user profile if it exists
    if (currentUser) {
      const profileUpdates: Partial<UserProfile> = {}
      if (updates.name !== undefined) profileUpdates.display_name = updates.name
      if (updates.username !== undefined) profileUpdates.username = updates.username
      if (updates.email !== undefined) profileUpdates.email = updates.email
      if (updates.image !== undefined) profileUpdates.image = updates.image
      
      if (Object.keys(profileUpdates).length > 0) {
        updateUserProfile(currentUser.id, profileUpdates)
      }
    }
  }, [currentUser, updateUserProfile])

  // Get user profile
  const getUserProfile = useCallback((userId: string): UserProfile | null => {
    return userProfiles[userId] || null
  }, [userProfiles])

  // Get follow state
  const getFollowState = useCallback((userId: string): boolean => {
    return followStates[userId] || false
  }, [followStates])

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Only access localStorage on client-side
        if (typeof window === 'undefined') {
          setIsLoading(false)
          return
        }

        const token = localStorage.getItem('access_token')
        if (!token) {
          setCurrentUser(null)
          setIsLoading(false)
          return
        }

        console.log('[UserContext] Loading user profile...')

        // Validate token and fetch user data using optimized API client with deduplication
        const userData = await apiClient.getCurrentUserProfile()
          
        // Safely handle user data and ensure id exists before converting
        if (userData && userData.id) {
          const user: User = {
            id: userData.id.toString(),
            name: userData.display_name || userData.name || userData.username,
            username: userData.username,
            email: userData.email,
            image: userData.profile_image_url,
            display_name: userData.display_name
          }
          
          setCurrentUser(user)
          console.log('[UserContext] User profile loaded')
          
          // Also store in user profiles for consistency
          const userProfile: UserProfile = {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            image: user.image,
            display_name: userData.display_name,
            follower_count: userData.follower_count,
            following_count: userData.following_count,
            posts_count: userData.posts_count
          }
          
          setUserProfiles(prev => ({
            ...prev,
            [user.id]: userProfile
          }))
        } else {
          // Invalid user data, remove token
          localStorage.removeItem('access_token')
          setCurrentUser(null)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        setCurrentUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const value: UserContextType = {
    currentUser,
    setCurrentUser,
    isLoading,
    userProfiles,
    followStates,
    updateUserProfile,
    updateFollowState,
    updateCurrentUser,
    getUserProfile,
    getFollowState,
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