import { useCallback, useEffect, useMemo, useState } from 'react'
import { PostPrivacy } from '@/types/post'

export type PrivacyLevel = 'public' | 'private' | 'custom'
export type PrivacyRule = 'followers' | 'following' | 'specific_users'

interface UsePostPrivacyStateResult {
  privacyLevel?: PrivacyLevel
  privacyRules: PrivacyRule[]
  specificUsers: number[]
  setPrivacyLevel: (level: PrivacyLevel) => void
  setPrivacyRules: (rules: PrivacyRule[]) => void
  setSpecificUsers: (ids: number[]) => void
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
  const [specificUsers, setSpecificUsersState] = useState<number[]>(
    initialPrivacy.specificUsers || []
  )

  useEffect(() => {
    setPrivacyLevelState(initialPrivacy.privacyLevel)
    setPrivacyRulesState((initialPrivacy.privacyRules as PrivacyRule[]) || [])
    setSpecificUsersState(initialPrivacy.specificUsers || [])
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

  const setSpecificUsers = useCallback((ids: number[]) => {
    setSpecificUsersState(ids)
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
      specific_users: specificUsers,
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
