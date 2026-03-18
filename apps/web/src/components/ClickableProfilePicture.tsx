"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { validProfileId } from "@/utils/idGuards"

interface ClickableProfilePictureProps {
  userId?: string | number
  username?: string
  imageUrl?: string | null
  displayName?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

/**
 * Clickable profile picture component that navigates to user profile.
 * Uses Next.js Link for SPA navigation with a static href.
 */
export default function ClickableProfilePicture({ 
  userId, 
  username, 
  imageUrl,
  displayName,
  size = 'medium',
  className,
  onClick 
}: ClickableProfilePictureProps) {
  const [imageError, setImageError] = useState(false)

  // Reset image error when URL changes
  useEffect(() => {
    setImageError(false)
  }, [imageUrl])

  // Size configurations
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-10 h-10', 
    large: 'w-12 h-12'
  }

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  }

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

  const handleImageError = () => {
    setImageError(true)
  }

  // Don't render link if we have no profile destination
  if (!userId && !username) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center ${className || ''}`}>
        <span className={`text-gray-400 ${textSizeClasses[size]} font-medium`}>?</span>
      </div>
    )
  }

  const fallbackName = displayName || username || `User ${userId}`
  const fallbackInitial = fallbackName.charAt(0).toUpperCase()

  // Inner content — image or letter avatar
  const renderContent = () => {
    if (imageUrl && !imageError) {
      return (
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-100 ${className || ''}`}>
          <img
            src={imageUrl}
            alt={fallbackName}
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        </div>
      )
    }

    return (
      <div className={`${sizeClasses[size]} rounded-full bg-purple-100 flex items-center justify-center ${className || ''}`}>
        <span className={`text-purple-600 ${textSizeClasses[size]} font-medium`}>
          {fallbackInitial}
        </span>
      </div>
    )
  }

  // If no valid href, render non-linked content
  if (!profileHref) {
    return renderContent()
  }

  return (
    <Link
      href={profileHref}
      onClick={onClick}
      className="cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all rounded-full inline-block"
      aria-label={`View ${fallbackName}'s profile`}
    >
      {renderContent()}
    </Link>
  )
}