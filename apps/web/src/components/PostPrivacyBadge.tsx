"use client"

import { useEffect, useId, useRef, useState, useMemo } from "react"
import { autoUpdate, flip, offset, shift, useFloating, FloatingPortal } from "@floating-ui/react"
import { Globe, Lock, Users } from "lucide-react"
import { apiClient } from "@/utils/apiClient"
import { getPostAudience } from "@/utils/privacyUtils"
import PostVisibilityPreview from "@/components/PostVisibilityPreview"
import { PostPrivacy } from "@/types/post"
import { UserSearchResult } from "@/types/userSearch"

interface PostPrivacyBadgeProps {
  privacyLevel?: string | null
  privacyRules?: string[] | null
  specificUsers?: number[] | null
  specificUsersCount?: number
  isAuthor?: boolean
  postPrivacy?: PostPrivacy
  specificUsersDetails?: UserSearchResult[]
  showQuickPreview?: boolean
  showLabel?: boolean
  hideLabelOnMobile?: boolean
  className?: string
  labelClassName?: string
}

function areResolvedUsersEqual(left: UserSearchResult[], right: UserSearchResult[]) {
  if (left === right) return true
  if (left.length !== right.length) return false

  return left.every((user, index) => {
    const other = right[index]
    return (
      user.id === other.id &&
      user.username === other.username &&
      user.displayName === other.displayName &&
      user.profileImageUrl === other.profileImageUrl &&
      Boolean((user as { unresolved?: boolean }).unresolved) ===
        Boolean((other as { unresolved?: boolean }).unresolved)
    )
  })
}

export default function PostPrivacyBadge({
  privacyLevel,
  privacyRules,
  specificUsers,
  specificUsersCount,
  isAuthor = false,
  postPrivacy,
  specificUsersDetails,
  showQuickPreview = false,
  showLabel = true,
  hideLabelOnMobile = false,
  className = "",
  labelClassName = "",
}: PostPrivacyBadgeProps) {
  const normalizedPrivacyLevel = useMemo(() => 
    privacyLevel === 'public' || privacyLevel === 'private' || privacyLevel === 'custom'
      ? privacyLevel
      : undefined, [privacyLevel])
  const normalizedPrivacyRules = useMemo(() => Array.isArray(privacyRules) ? privacyRules : [], [privacyRules])
  const normalizedSpecificUsers = useMemo(() => Array.isArray(specificUsers) ? specificUsers : [], [specificUsers])

  const audience = getPostAudience({
    privacyLevel: normalizedPrivacyLevel,
    privacyRules: normalizedPrivacyRules,
    specificUsers: normalizedSpecificUsers,
    specificUsersCount,
  })

  const previewPrivacy: PostPrivacy | null = useMemo(() => {
    return postPrivacy ?? (isAuthor ? {
      privacyLevel: normalizedPrivacyLevel,
      privacyRules: normalizedPrivacyRules,
      specificUsers: normalizedSpecificUsers,
    } : null)
  }, [postPrivacy, isAuthor, normalizedPrivacyLevel, normalizedPrivacyRules, normalizedSpecificUsers])

  const enablePreview = Boolean(isAuthor && previewPrivacy)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [resolvedUsers, setResolvedUsers] = useState<UserSearchResult[]>(specificUsersDetails ?? [])
  const resolvedUsersRef = useRef<Map<number, UserSearchResult>>(new Map())
  const isFetchingRef = useRef(false)
  const hasFetchedRef = useRef(false)
  const lastIdsKeyRef = useRef<string>('')
  const tooltipTimeoutRef = useRef<number | null>(null)
  const longPressTimeoutRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const previewId = useId()
  const tooltipId = useId()

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-end',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  const updateResolvedUsers = useMemo(() => {
    return (nextUsers: UserSearchResult[]) => {
      setResolvedUsers((previousUsers) => {
        return areResolvedUsersEqual(previousUsers, nextUsers) ? previousUsers : nextUsers
      })
    }
  }, [])

  useEffect(() => {
    if (!enablePreview) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      const referenceEl = refs.reference.current as Element | null
      const floatingEl = refs.floating.current as Element | null
      if (referenceEl?.contains(target) || floatingEl?.contains(target)) {
        return
      }
      setIsPreviewOpen(false)
      setShowTooltip(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [enablePreview, refs.reference, refs.floating])

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        window.clearTimeout(tooltipTimeoutRef.current)
      }
      if (longPressTimeoutRef.current) {
        window.clearTimeout(longPressTimeoutRef.current)
      }
    }
  }, [])

  const scheduleTooltip = () => {
    if (!showQuickPreview) return
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current)
    }
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(true)
    }, 150)
  }

  const clearTooltip = () => {
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current)
    }
    setShowTooltip(false)
  }

  const handleClick = () => {
    if (!enablePreview) return
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setIsPreviewOpen((prev) => !prev)
    setShowTooltip(false)
  }

  const handleTouchStart = () => {
    if (!showQuickPreview || !enablePreview) return
    suppressClickRef.current = false
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current)
    }
    longPressTimeoutRef.current = window.setTimeout(() => {
      suppressClickRef.current = true
      setShowTooltip(true)
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current)
    }
    if (suppressClickRef.current) {
      setShowTooltip(false)
    }
  }

  useEffect(() => {
    if (!enablePreview || !previewPrivacy) return

    const specificUserIds = previewPrivacy.specificUsers ?? []
    const idsKey = specificUserIds.join(',')
    if (idsKey !== lastIdsKeyRef.current) {
      lastIdsKeyRef.current = idsKey
      hasFetchedRef.current = false
      isFetchingRef.current = false
      resolvedUsersRef.current.clear()
      if (!specificUsersDetails) {
        updateResolvedUsers([])
      }
    }

    if (specificUsersDetails && specificUsersDetails.length > 0) {
      specificUsersDetails.forEach((user) => resolvedUsersRef.current.set(user.id, user))
      updateResolvedUsers(specificUsersDetails)
      hasFetchedRef.current = true
      return
    }

    if (!specificUserIds.length) {
      updateResolvedUsers([])
      return
    }

    const shouldLoad = showTooltip || isPreviewOpen
    if (!shouldLoad || hasFetchedRef.current || isFetchingRef.current) {
      return
    }

    let isActive = true
    isFetchingRef.current = true

    const fetchProfiles = async () => {
      const unresolvedIds = specificUserIds.filter((id) => !resolvedUsersRef.current.has(id))
      if (unresolvedIds.length === 0) {
        return
      }

      try {
        const promises = unresolvedIds.map(id =>
          apiClient.getUserProfile(id.toString())
            .then(profile => {
              const userId = Number(profile.id)
              resolvedUsersRef.current.set(userId, {
                id: userId,
                username: profile.username ?? `user${userId}`,
                displayName: profile.displayName ?? profile.name ?? profile.username,
                profileImageUrl: profile.profileImageUrl ?? profile.image ?? null,
              })
            })
            .catch(() => null)
        )
        
        await Promise.all(promises)
      } catch (error) {
        // Fall through to unresolved placeholders.
      }
    }

    fetchProfiles().finally(() => {
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
      updateResolvedUsers(users)
      hasFetchedRef.current = true
      isFetchingRef.current = false
    })

    return () => {
      isActive = false
    }
  }, [
    enablePreview,
    previewPrivacy,
    specificUsersDetails,
    showTooltip,
    isPreviewOpen,
    updateResolvedUsers,
  ])

  const iconClassName = "h-4 w-4"
  const icon = audience.iconKind === "public"
    ? <Globe className={`${iconClassName} text-green-600`} data-testid="privacy-icon-public" aria-hidden="true" />
    : audience.iconKind === "private"
      ? <Lock className={`${iconClassName} text-rose-600`} data-testid="privacy-icon-private" aria-hidden="true" />
      : <Users className={`${iconClassName} text-indigo-600`} data-testid="privacy-icon-custom" aria-hidden="true" />

  const badgeContent = (
    <>
      {icon}
      {showLabel && (
        <span className={`${hideLabelOnMobile ? "hidden sm:inline" : ""} ${labelClassName}`.trim()}>
          {audience.label}
        </span>
      )}
    </>
  )

  if (!enablePreview || !previewPrivacy) {
    return (
      <span
        className={`inline-flex items-center gap-2 ${className}`.trim()}
        aria-label={audience.ariaLabel}
        title={audience.label}
      >
        {badgeContent}
      </span>
    )
  }

  const isPopoverOpen = (showQuickPreview && showTooltip) || isPreviewOpen

  return (
    <span className="relative inline-flex">
      <span
        role="button"
        tabIndex={0}
        ref={refs.setReference}
        className={`inline-flex items-center gap-2 bg-transparent p-0 ${className}`.trim()}
        aria-label={audience.ariaLabel}
        title={audience.label}
        aria-expanded={isPreviewOpen}
        aria-controls={previewId}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleClick()
          }
        }}
        onMouseEnter={scheduleTooltip}
        onMouseLeave={clearTooltip}
        onFocus={scheduleTooltip}
        onBlur={clearTooltip}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {badgeContent}
      </span>

      {isPopoverOpen && (
        <FloatingPortal>
          <div
            id={isPreviewOpen ? previewId : tooltipId}
            ref={refs.setFloating}
            style={floatingStyles}
            className={`z-50 rounded-xl border border-gray-200 bg-white shadow-xl ${
              isPreviewOpen ? "p-4" : "p-3"
            }`}
            role={isPreviewOpen ? "dialog" : "tooltip"}
          >
            <PostVisibilityPreview
              postPrivacy={previewPrivacy}
              specificUsers={resolvedUsers}
              maxUsers={isPreviewOpen ? 10 : 3}
              allowExpand={isPreviewOpen}
              showTitle
            />
          </div>
        </FloatingPortal>
      )}
    </span>
  )
}
