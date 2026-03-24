import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { PostPrivacy } from '@/types/post'
import { UserSearchResult } from '@/types/userSearch'
import { apiClient } from '@/utils/apiClient'
import { normalizeToUserSearchResult, dedupeUsersById } from '@/utils/userDataMapping'

export type PrivacyLevel = 'public' | 'private' | 'custom'
export type PrivacyRule = 'followers' | 'following' | 'specific_users'

interface UsePostPrivacyStateResult {
  privacyLevel?: PrivacyLevel
  privacyRules: PrivacyRule[]
  specificUsers: UserSearchResult[]
  setPrivacyLevel: (level: PrivacyLevel) => void
  setPrivacyRules: (rules: PrivacyRule[]) => void
  setSpecificUsers: (users: UserSearchResult[]) => void
  hasValidCustomAudience: boolean
  buildPayload: () => {
    privacy_level: PrivacyLevel
    rules: PrivacyRule[]
    specific_users: number[]
  }
}

export function usePostPrivacyState(initialPrivacy: PostPrivacy): UsePostPrivacyStateResult {
  const [privacyLevel, setPrivacyLevelState] = useState<PrivacyLevel | undefined>(
    initialPrivacy.privacyLevel
  )
  const [privacyRules, setPrivacyRulesState] = useState<PrivacyRule[]>(
    (initialPrivacy.privacyRules as PrivacyRule[]) || []
  )
  const [specificUsers, setSpecificUsersState] = useState<UserSearchResult[]>(
    Array.isArray(initialPrivacy.specificUsers) && typeof initialPrivacy.specificUsers[0] === 'object' 
      ? (initialPrivacy.specificUsers as unknown as UserSearchResult[])
      : []
  )
  const hasHydratedRef = useRef(false)

  useEffect(() => {
    let isActive = true
    setPrivacyLevelState(initialPrivacy.privacyLevel)
    setPrivacyRulesState((initialPrivacy.privacyRules as PrivacyRule[]) || [])

    const handleInitialUsers = async () => {
      const initialUsers = initialPrivacy.specificUsers || []
      
      // Skip if already hydrated for this instance
      if (hasHydratedRef.current) {
        return
      }
      
      if (initialUsers.length === 0) {
        if (isActive) setSpecificUsersState([])
        return
      }

      // Check if they are already UserSearchResult objects (e.g. from new drafts)
      if (typeof initialUsers[0] === 'object' && initialUsers[0] !== null) {
        if (isActive) {
          setSpecificUsersState(initialUsers as unknown as UserSearchResult[])
          hasHydratedRef.current = true
        }
        return
      }

      // Otherwise, they are raw IDs (from backend post payload or legacy drafts)
      const ids = initialUsers as number[]
      
      try {
        const promises = ids.map(id => 
          apiClient.getUserProfile(id.toString())
            .then(normalizeToUserSearchResult)
            .catch(() => null)
        )
        
        const results = await Promise.all(promises)
        
        if (isActive) {
          const validUsers = results.filter((u): u is UserSearchResult => u !== null)
          
          // Merge with any users selected during the fetch, preserving existing selections
          setSpecificUsersState(prev => dedupeUsersById([...prev, ...validUsers]))
          hasHydratedRef.current = true
        }
      } catch (err) {
        console.error('Failed to hydrate specific users', err)
      }
    }

    handleInitialUsers()
    return () => { isActive = false }
  }, [initialPrivacy.privacyLevel, initialPrivacy.privacyRules, initialPrivacy.specificUsers])

  const setPrivacyLevel = useCallback(
    (level: PrivacyLevel) => {
      setPrivacyLevelState(level)
      if (level !== 'custom') {
        setPrivacyRulesState([])
        setSpecificUsersState([])
      }
    },
    []
  )

  const setPrivacyRules = useCallback((rules: PrivacyRule[]) => {
    setPrivacyRulesState(rules)
  }, [])

  const setSpecificUsers = useCallback((users: UserSearchResult[]) => {
    setSpecificUsersState(dedupeUsersById(users))
  }, [])

  useEffect(() => {
    if (privacyLevel !== 'custom') {
      return
    }
    const hasSpecific = specificUsers.length > 0
    setPrivacyRulesState((prev) => {
      const withoutSpecific = prev.filter((rule) => rule !== 'specific_users')
      if (hasSpecific) {
        return [...withoutSpecific, 'specific_users']
      }
      return withoutSpecific
    })
  }, [privacyLevel, specificUsers])

  const hasValidCustomAudience = useMemo(() => {
    if (privacyLevel !== 'custom') return true
    const hasFollowers = privacyRules.includes('followers')
    const hasFollowing = privacyRules.includes('following')
    const hasSpecificUsers = specificUsers.length > 0
    return hasFollowers || hasFollowing || hasSpecificUsers
  }, [privacyLevel, privacyRules, specificUsers])

  const buildPayload = useCallback(() => {
    return {
      privacy_level: (privacyLevel ?? 'public') as PrivacyLevel,
      rules: privacyRules,
      specific_users: specificUsers.map(u => u.id),
    }
  }, [privacyLevel, privacyRules, specificUsers])

  return {
    privacyLevel,
    privacyRules,
    specificUsers,
    setPrivacyLevel,
    setPrivacyRules,
    setSpecificUsers,
    hasValidCustomAudience,
    buildPayload,
  }
}
