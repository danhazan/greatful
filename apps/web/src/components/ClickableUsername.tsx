"use client"

import { useRouter } from "next/navigation"
import { navigateToUserProfile } from "@/utils/notificationLinks"

interface ClickableUsernameProps {
  userId?: string | number
  username?: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

/**
 * Clickable username component that navigates to user profile
 * Used in notifications and other places where usernames should be clickable
 * Shares the same navigation logic as follow notifications
 */
export default function ClickableUsername({ 
  userId, 
  username, 
  className = "font-medium text-purple-600 hover:text-purple-700 cursor-pointer transition-colors",
  onClick 
}: ClickableUsernameProps) {
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent parent click handlers from firing
    
    if (onClick) {
      onClick(e)
    }
    
    // Ensure we have either userId or username
    if (!userId && !username) {
      console.warn('ClickableUsername: No userId or username provided')
      return
    }
    
    // Use shared navigation function for consistency with follow notifications
    await navigateToUserProfile(
      { id: userId, username }, 
      (url: string) => router.push(url),
      { resolveUsername: true }
    )
  }

  // Don't render if we have neither userId nor username
  if (!userId && !username) {
    return <span className={className}>Unknown User</span>
  }

  const displayName = username || `User ${userId}`

  return (
    <span 
      className={className}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick(e as any)
        }
      }}
      aria-label={`View ${displayName}'s profile`}
    >
      {displayName}
    </span>
  )
}