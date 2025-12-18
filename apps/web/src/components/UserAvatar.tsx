"use client"

import { useState } from "react"
import { getImageUrl } from "@/utils/imageUtils"

interface UserAvatarProps {
  user: {
    id: string | number
    name: string
    display_name?: string
    username: string  // Required - all users have usernames
    profile_image_url?: string
    profile_photo_filename?: string
    image?: string  // For compatibility with UserContext
  }
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showTooltip?: boolean
  onClick?: () => void
}

export default function UserAvatar({ 
  user, 
  size = 'md', 
  className = '', 
  showTooltip = false,
  onClick 
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false)
  
  // Size mappings
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-12 w-12 text-lg'
  }
  
  // Get display name or fallback to name
  const displayName = user.display_name || user.name || 'User'
  const username = user.username  // Username is always present
  
  // Get profile image URL - use same approach as ClickableProfilePicture
  // Support both image (from UserContext) and profile_image_url (direct API)
  // Use getImageUrl to handle relative URLs from the backend
  const rawImageUrl = user.image || user.profile_image_url
  const profileImageUrl = getImageUrl(rawImageUrl)
  
  // Generate initials for fallback
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') {
      return 'U'
    }
    
    const words = name.trim().split(/\s+/)
    if (words.length === 1) {
      // Single word: take first two characters
      return words[0].slice(0, 2).toUpperCase()
    } else {
      // Multiple words: take first character of first two words
      return words.slice(0, 2)
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
    }
  }
  
  const initials = getInitials(displayName)
  
  // Handle image load error
  const handleImageError = () => {
    setImageError(true)
  }
  
  const avatarContent = profileImageUrl && !imageError ? (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-100`}>
      <img
        src={profileImageUrl}
        alt={`${displayName}'s profile picture`}
        className="w-full h-full object-cover object-center"
        referrerPolicy="no-referrer"
        onError={handleImageError}
      />
    </div>
  ) : (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-purple-600 text-white font-medium flex items-center justify-center`}
      aria-label={`${displayName}'s avatar`}
    >
      {initials}
    </div>
  )
  
  const baseClasses = `inline-flex items-center justify-center ${className}`
  const interactiveClasses = onClick ? 'cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-full' : ''
  
  if (showTooltip) {
    return (
      <div className="relative group">
        <button
          onClick={onClick}
          className={`${baseClasses} ${interactiveClasses}`}
          aria-label={`${displayName}'s profile`}
        >
          {avatarContent}
        </button>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
          @{username}
        </div>
      </div>
    )
  }
  
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} ${interactiveClasses}`}
        aria-label={`${displayName}'s profile`}
      >
        {avatarContent}
      </button>
    )
  }
  
  return (
    <div className={baseClasses}>
      {avatarContent}
    </div>
  )
}