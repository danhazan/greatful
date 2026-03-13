"use client"

import { useMemo, useState } from "react"
import { getPostPrivacyRuleFlags } from "@/utils/privacyUtils"
import ProfilePhotoDisplay from "@/components/ProfilePhotoDisplay"
import { PostPrivacy } from "@/types/post"
import { UserMultiSelectUser } from "@/components/UserMultiSelect"

interface PostVisibilityPreviewProps {
  postPrivacy: PostPrivacy
  specificUsers?: UserMultiSelectUser[]
  maxUsers?: number
  allowExpand?: boolean
  showTitle?: boolean
  className?: string
}

export default function PostVisibilityPreview({
  postPrivacy,
  specificUsers,
  maxUsers = 10,
  allowExpand = true,
  showTitle = true,
  className = "",
}: PostVisibilityPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const specificUserIds = useMemo(
    () => postPrivacy.specificUsers ?? [],
    [postPrivacy.specificUsers]
  )
  const resolvedUsers = useMemo(() => {
    if (!specificUsers) return []
    return specificUsers
  }, [specificUsers])

  const {
    privacyLevel,
    includesFollowers,
    includesFollowing,
    includesSpecificUsers,
  } = getPostPrivacyRuleFlags({
    privacyLevel: postPrivacy.privacyLevel,
    privacyRules: postPrivacy.privacyRules,
    specificUsers: postPrivacy.specificUsers,
  })

  if (privacyLevel === 'public') {
    return (
      <div className={`text-sm text-gray-700 ${className}`.trim()}>
        Everyone can see this post
      </div>
    )
  }

  if (privacyLevel === 'private') {
    return (
      <div className={`text-sm text-gray-700 ${className}`.trim()}>
        Only you can see this post
      </div>
    )
  }

  const maxVisible = allowExpand && !isExpanded ? Math.min(maxUsers, resolvedUsers.length) : resolvedUsers.length
  const visibleUsers = resolvedUsers.slice(0, maxVisible)
  const hiddenCount = resolvedUsers.length - visibleUsers.length
  const hasAnyRule = includesFollowers || includesFollowing || includesSpecificUsers

  return (
    <div
      className={`box-border w-max max-w-[min(320px,90vw)] break-words text-sm text-gray-700 [contain:layout] ${className}`.trim()}
    >
      {showTitle && <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Visible to:</div>}
      <ul className="space-y-2">
        {!hasAnyRule && <li className="text-sm text-gray-700">Custom audience</li>}
        {includesFollowers && <li className="text-sm text-gray-700">Your followers</li>}
        {includesFollowing && <li className="text-sm text-gray-700">People you follow</li>}
        {includesSpecificUsers && resolvedUsers.length === 0 && (
          <li className="text-sm text-gray-700">Selected users</li>
        )}
        {includesSpecificUsers && resolvedUsers.length > 0 && (
          <>
            {visibleUsers.map((user) => {
              const displayName = user.displayName || user.username
              return (
                <li key={user.id} className="flex items-center gap-2">
                  <ProfilePhotoDisplay
                    photoUrl={user.profileImageUrl ?? null}
                    username={user.username}
                    size="xs"
                    className="border-none shadow-none"
                  />
                  <span className="text-sm text-gray-700">
                    {displayName ? displayName : `@${user.username}`}
                  </span>
                </li>
              )
            })}
            {hiddenCount > 0 && (
              <li className="text-sm text-gray-500">+ {hiddenCount} more</li>
            )}
          </>
        )}
      </ul>
      {allowExpand && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="mt-2 text-xs font-medium text-purple-600 hover:text-purple-700"
        >
          Show all users
        </button>
      )}
    </div>
  )
}
