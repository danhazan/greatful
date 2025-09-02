"use client"

import { useRouter } from "next/navigation"
import { validProfileId } from "@/utils/idGuards"

interface ClickableUsernameProps {
  userId?: string | number
  username?: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

/**
 * Clickable username component that navigates to user profile
 * Used in notifications and other places where usernames should be clickable
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
    
    // If we have a valid userId, navigate directly
    if (userId && validProfileId(userId)) {
      router.push(`/profile/${userId}`)
      return
    }
    
    // If userId is provided but not valid (might be a username), try to resolve it
    const usernameToResolve = username || (userId && !validProfileId(userId) ? String(userId) : null)
    
    if (usernameToResolve) {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) {
          console.warn('No access token available for username resolution')
          return
        }

        const response = await fetch(`/api/users/by-username/${encodeURIComponent(usernameToResolve)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const userData = await response.json()
          if (userData.data && userData.data.id) {
            router.push(`/profile/${userData.data.id}`)
            return
          }
        }
      } catch (error) {
        console.warn('Failed to resolve username to ID:', error)
      }
    }
    
    console.warn('Unable to navigate to user profile:', { userId, username })
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