'use client'

import React from 'react'
import { User } from 'lucide-react'
import { getImageUrl } from '@/utils/imageUtils'

interface ProfilePhotoDisplayProps {
  photoUrl?: string | null
  username?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  onClick?: () => void
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8', 
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
  '2xl': 'w-32 h-32'
}

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
  '2xl': 'w-16 h-16'
}

export default function ProfilePhotoDisplay({ 
  photoUrl, 
  username, 
  size = 'md', 
  className = '',
  onClick 
}: ProfilePhotoDisplayProps) {
  const [imageError, setImageError] = React.useState(false)
  const [imageLoaded, setImageLoaded] = React.useState(false)
  
  const sizeClass = sizeClasses[size]
  const iconSize = iconSizes[size]
  
  const baseClasses = `
    ${sizeClass} 
    rounded-full 
    object-cover 
    border-2 
    border-white 
    shadow-sm
    ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
    ${className}
  `

  const imageUrl = getImageUrl(photoUrl)
  
  // Reset error state when photoUrl changes
  React.useEffect(() => {
    if (imageUrl) {
      setImageError(false)
      setImageLoaded(false)
    }
  }, [imageUrl])

  const handleImageError = () => {
    setImageError(true)
    setImageLoaded(false)
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }
  
  if (imageUrl && !imageError) {
    return (
      <img
        src={imageUrl}
        alt={username ? `${username}'s profile` : 'Profile photo'}
        className={baseClasses}
        onClick={onClick}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    )
  }

  // Default avatar with gradient background (shown when no image or error)
  return (
    <div
      className={`
        ${baseClasses}
        bg-gradient-to-br 
        from-purple-100 
        to-purple-200 
        flex 
        items-center 
        justify-center
      `}
      onClick={onClick}
    >
      <User className={`${iconSize} text-purple-400`} />
    </div>
  )
}