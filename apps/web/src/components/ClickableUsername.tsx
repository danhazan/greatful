"use client"

import Link from "next/link"
import { validProfileId } from "@/utils/idGuards"

interface ClickableUsernameProps {
  userId?: string | number
  username?: string
  displayName?: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

/**
 * Clickable username component that navigates to user profile.
 * Uses Next.js Link for SPA navigation with a static href.
 */
export default function ClickableUsername({ 
  userId, 
  username, 
  displayName,
  className = "font-medium text-purple-600 hover:text-purple-700 cursor-pointer transition-colors",
  onClick 
}: ClickableUsernameProps) {
  // Build static href — always available at render time
  const getProfileHref = (): string | null => {
    if (userId && validProfileId(userId)) {
      return `/profile/${userId}`
    }
    if (username) {
      return `/profile/${username}`
    }
    if (userId) {
      return `/profile/${userId}`
    }
    return null
  }

  const profileHref = getProfileHref()

  // Don't render link if we have no profile destination
  if (!userId && !username) {
    return <span className={className}>Unknown User</span>
  }

  const nameToDisplay = displayName || username || `User ${userId}`

  if (!profileHref) {
    return <span className={className}>{nameToDisplay}</span>
  }

  return (
    <Link 
      href={profileHref}
      className={className}
      onClick={onClick}
      aria-label={`View ${nameToDisplay}'s profile`}
    >
      {nameToDisplay}
    </Link>
  )
}