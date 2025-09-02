"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
 * Clickable profile picture component that navigates to user profile
 * Reuses the same navigation logic as ClickableUsername for consistency
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
  const router = useRouter()
  const [imageError, setImageError] = useState(false)

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

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent parent click handlers from firing
    
    if (onClick) {
      onClick(e)
    }
    
    // Ensure we have either userId or username
    if (!userId && !username) {
      console.warn('ClickableProfilePicture: No userId or username provided')
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

  const handleImageError = () => {
    setImageError(true)
  }

  // Don't render if we have neither userId nor username
  if (!userId && !username) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center ${className || ''}`}>
        <span className={`text-gray-400 ${textSizeClasses[size]} font-medium`}>?</span>
      </div>
    )
  }

  const fallbackName = displayName || username || `User ${userId}`
  const fallbackInitial = fallbackName.charAt(0).toUpperCase()

  // Show profile picture if available and not errored
  if (imageUrl && !imageError) {
    return (
      <div 
        className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all ${className || ''}`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e as any)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`View ${fallbackName}'s profile`}
      >
        <img
          src={imageUrl}
          alt={fallbackName}
          className="w-full h-full object-cover object-center"
          onError={handleImageError}
        />
      </div>
    )
  }

  // Fallback to letter avatar
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-purple-100 flex items-center justify-center cursor-pointer hover:bg-purple-200 transition-colors ${className || ''}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick(e as any)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View ${fallbackName}'s profile`}
    >
      <span className={`text-purple-600 ${textSizeClasses[size]} font-medium`}>
        {fallbackInitial}
      </span>
    </div>
  )
}