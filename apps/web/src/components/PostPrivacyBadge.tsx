"use client"

import { Globe, Lock, Users } from "lucide-react"
import { getPostAudience } from "@/utils/privacyUtils"

interface PostPrivacyBadgeProps {
  privacyLevel?: string | null
  privacyRules?: string[] | null
  specificUsers?: number[] | null
  specificUsersCount?: number
  showLabel?: boolean
  hideLabelOnMobile?: boolean
  className?: string
  labelClassName?: string
}

export default function PostPrivacyBadge({
  privacyLevel,
  privacyRules,
  specificUsers,
  specificUsersCount,
  showLabel = true,
  hideLabelOnMobile = false,
  className = "",
  labelClassName = "",
}: PostPrivacyBadgeProps) {
  const audience = getPostAudience({
    privacyLevel,
    privacyRules,
    specificUsers,
    specificUsersCount,
  })

  const iconClassName = "h-4 w-4"
  const icon = audience.iconKind === "public"
    ? <Globe className={`${iconClassName} text-green-600`} data-testid="privacy-icon-public" aria-hidden="true" />
    : audience.iconKind === "private"
      ? <Lock className={`${iconClassName} text-rose-600`} data-testid="privacy-icon-private" aria-hidden="true" />
      : <Users className={`${iconClassName} text-indigo-600`} data-testid="privacy-icon-custom" aria-hidden="true" />

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label={audience.ariaLabel}
      title={audience.label}
    >
      {icon}
      {showLabel && (
        <span className={`${hideLabelOnMobile ? "hidden sm:inline" : ""} ${labelClassName}`.trim()}>
          {audience.label}
        </span>
      )}
    </span>
  )
}

