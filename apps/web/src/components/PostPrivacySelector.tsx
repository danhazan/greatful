"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { apiClient } from "@/utils/apiClient"
import PostPrivacyBadge from "./PostPrivacyBadge"
import UserMultiSelect, { UserMultiSelectUser } from "./UserMultiSelect"
import { getPostAudience } from "@/utils/privacyUtils"
import { PrivacyLevel, PrivacyRule } from "@/hooks/usePostPrivacyState"

const CUSTOM_PRIVACY_RULES: Array<{ id: PrivacyRule; label: string; description: string }> = [
  { id: 'followers', label: 'Followers', description: 'Users who follow you' },
  { id: 'following', label: 'Following', description: 'Users you follow' },
  { id: 'specific_users', label: 'Users', description: 'Only selected users' },
]

interface PostPrivacySelectorProps {
  privacyLevel?: PrivacyLevel
  privacyRules: PrivacyRule[]
  specificUserIds: number[]
  onPrivacyLevelChange: (level: PrivacyLevel) => void
  onPrivacyRulesChange: (rules: PrivacyRule[]) => void
  onSpecificUserIdsChange: (ids: number[]) => void
}

export default function PostPrivacySelector({
  privacyLevel = 'public',
  privacyRules,
  specificUserIds,
  onPrivacyLevelChange,
  onPrivacyRulesChange,
  onSpecificUserIdsChange,
}: PostPrivacySelectorProps) {
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false)
  const [showCustomPrivacyModal, setShowCustomPrivacyModal] = useState(false)
  const [customPrivacyError, setCustomPrivacyError] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<UserMultiSelectUser[]>([])
  const resolvedUsersRef = useRef<Map<number, UserMultiSelectUser>>(new Map())

  const privacyAudience = getPostAudience({
    privacyLevel,
    privacyRules,
    specificUsersCount: specificUserIds.length,
  })

  useEffect(() => {
    let isActive = true

    const hydrateUsers = async () => {
      if (!specificUserIds.length) {
        setSelectedUsers([])
        return
      }

      const unresolvedIds = specificUserIds.filter((id) => !resolvedUsersRef.current.has(id))
      if (unresolvedIds.length > 0) {
        try {
          const response = await apiClient.getBatchUserProfiles(unresolvedIds.map(String))
          const profiles = response?.data || response
          if (Array.isArray(profiles)) {
            profiles.forEach((profile: any) => {
              if (!profile?.id) return
              const userId = Number(profile.id)
              resolvedUsersRef.current.set(userId, {
                id: userId,
                username: profile.username ?? `user${userId}`,
                displayName: profile.displayName ?? profile.name ?? profile.username,
                profileImageUrl: profile.profileImageUrl ?? profile.image ?? null,
              })
            })
          }
        } catch (error) {
          // Fall through to unresolved placeholders below.
        }
      }

      if (!isActive) return

      const users = specificUserIds.map((id) => {
        return (
          resolvedUsersRef.current.get(id) ?? {
            id,
            username: `user${id}`,
            unresolved: true,
          }
        )
      })
      setSelectedUsers(users)
    }

    hydrateUsers()
    return () => {
      isActive = false
    }
  }, [specificUserIds])

  const handlePrivacyLevelSelect = (level: PrivacyLevel) => {
    onPrivacyLevelChange(level)
    setShowPrivacyMenu(false)
    setCustomPrivacyError('')

    if (level === 'custom') {
      setShowCustomPrivacyModal(true)
    }

    if (level !== 'custom') {
      onPrivacyRulesChange([])
      onSpecificUserIdsChange([])
    }
  }

  const handleToggleCustomRule = (rule: PrivacyRule) => {
    if (rule === 'specific_users') {
      setCustomPrivacyError('')
      const enabled = privacyRules.includes('specific_users')
      if (enabled) {
        onPrivacyRulesChange(privacyRules.filter((r) => r !== rule))
        onSpecificUserIdsChange([])
      } else {
        onPrivacyRulesChange([...privacyRules, rule])
      }
      return
    }

    onPrivacyRulesChange(
      privacyRules.includes(rule)
        ? privacyRules.filter((r) => r !== rule)
        : [...privacyRules, rule]
    )
    setCustomPrivacyError('')
  }

  const handleSpecificUsersChange = (users: UserMultiSelectUser[]) => {
    setSelectedUsers(users)
    onSpecificUserIdsChange(users.map((user) => user.id))
    setCustomPrivacyError('')
  }

  const hasFollowersOrFollowing =
    privacyRules.includes('followers') || privacyRules.includes('following')
  const hasSpecificUsers = specificUserIds.length > 0

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPrivacyMenu((prev) => !prev)}
          aria-label={privacyAudience.ariaLabel}
          title={privacyAudience.label}
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-purple-300 hover:text-purple-700 transition-colors"
        >
          <PostPrivacyBadge
            privacyLevel={privacyLevel}
            privacyRules={privacyRules}
            specificUsersCount={specificUserIds.length}
            showLabel
            hideLabelOnMobile
            className="gap-2"
          />
          <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
        </button>
      </div>

      {showPrivacyMenu && (
        <div className="absolute right-0 mt-2 w-52 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          <button
            type="button"
            onClick={() => handlePrivacyLevelSelect('public')}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-purple-50"
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => handlePrivacyLevelSelect('custom')}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-purple-50"
          >
            Custom
          </button>
          <button
            type="button"
            onClick={() => handlePrivacyLevelSelect('private')}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-purple-50"
          >
            Private
          </button>
        </div>
      )}

      {showCustomPrivacyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-custom-privacy-modal>
          <div
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={() => setShowCustomPrivacyModal(false)}
          />
          <div
            className="relative z-10 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            data-custom-privacy-modal
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Custom Audience</h3>
              <button
                type="button"
                onClick={() => setShowCustomPrivacyModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close custom privacy modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {CUSTOM_PRIVACY_RULES.map((rule) => (
                <label
                  key={rule.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-purple-300"
                >
                  <input
                    type="checkbox"
                    checked={privacyRules.includes(rule.id)}
                    onChange={() => handleToggleCustomRule(rule.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{rule.label}</p>
                    <p className="text-xs text-gray-500">{rule.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {privacyRules.includes('specific_users') && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Select users</p>
                <UserMultiSelect
                  selectedUsers={selectedUsers}
                  onChange={handleSpecificUsersChange}
                  placeholder="Search and add users..."
                />
              </div>
            )}

            {customPrivacyError && (
              <p className="mt-3 text-sm text-red-600">{customPrivacyError}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCustomPrivacyModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hasFollowersOrFollowing && !hasSpecificUsers) {
                    setCustomPrivacyError('Select at least one audience rule before saving.')
                    return
                  }
                  setCustomPrivacyError('')
                  setShowCustomPrivacyModal(false)
                }}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
