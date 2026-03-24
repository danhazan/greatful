/**
 * Visual User Identity Primitive.
 * Used for purely presentational avatars across the app.
 * Wraps ProfilePhotoDisplay with user-specific fallback logic (initials).
 */
'use client'

import React from 'react'
import ProfilePhotoDisplay from './ProfilePhotoDisplay'
import { UserSearchResult } from '@/types/userSearch'

interface UserAvatarProps {
  user: Partial<UserSearchResult>
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  onClick?: () => void
  showTooltip?: boolean
}

export default function UserAvatar({
  user,
  size = 'md',
  className = '',
  onClick,
  showTooltip = false
}: UserAvatarProps) {
  const displayName = user.displayName || user.username || 'User'
  const imageUrl = user.profileImageUrl || user.image
  const [imageError, setImageError] = React.useState(false)

  // Size mappings (same as ProfilePhotoDisplay)
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
    '2xl': 'w-32 h-32 text-4xl'
  }

  // Generate initials for fallback
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'U'
    const words = name.trim().split(/\s+/)
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
  }

  const avatarContent = imageUrl && !imageError ? (
    <ProfilePhotoDisplay
      photoUrl={imageUrl}
      username={displayName}
      size={size}
      onClick={onClick}
      onError={() => setImageError(true)}
      className={className}
    />
  ) : (
    <div
      className={`${sizeClasses[size] || sizeClasses.md} rounded-full bg-purple-600 text-white font-semibold flex items-center justify-center border-2 border-white shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
      onClick={onClick}
      aria-label={`${displayName}'s avatar fallback`}
    >
      {getInitials(displayName)}
    </div>
  )

  return (
    <div className={`relative inline-flex group ${className}`}>
      {avatarContent}
      
      {showTooltip && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          @{user.username}
        </div>
      )}
    </div>
  )
}
