'use client'

import React from 'react'
import { Edit3 } from 'lucide-react'
import ProfilePhotoDisplay from './ProfilePhotoDisplay'

interface ProfileImageSectionProps {
  photoUrl?: string | null
  username?: string
  displayName?: string
  isOwnProfile?: boolean
  onPhotoClick?: () => void
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

/**
 * Shared profile image section component used across profile pages
 * Ensures consistent behavior and styling between self-profile and user profile pages
 */
export default function ProfileImageSection({
  photoUrl,
  username,
  displayName,
  isOwnProfile = false,
  onPhotoClick,
  size = '2xl',
  className = ''
}: ProfileImageSectionProps) {
  const displayText = displayName || username || 'User'

  return (
    <div className={`flex-shrink-0 relative ${className}`}>
      <ProfilePhotoDisplay
        photoUrl={photoUrl}
        username={displayText}
        size={size}
        className="border-4 border-purple-100"
        onClick={onPhotoClick}
      />
      
      {/* Edit button for own profile */}
      {isOwnProfile && onPhotoClick && (
        <button
          onClick={onPhotoClick}
          className="absolute -bottom-1 -right-1 bg-purple-600 text-white p-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
          title="Change profile photo"
        >
          <Edit3 className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}