'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { isAuthenticated, getAccessToken } from '@/utils/auth'
import { createTouchHandlers } from '@/utils/hapticFeedback'
import { useToast } from '@/contexts/ToastContext'
import { useUserState } from '@/hooks/useUserState'

interface FollowButtonProps {
  userId: number
  initialFollowState?: boolean
  onFollowChange?: (isFollowing: boolean) => void
  className?: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline'
}

interface FollowStatus {
  is_following: boolean
  follow_status?: string
  is_followed_by: boolean
}

export default function FollowButton({
  userId,
  initialFollowState = false,
  onFollowChange,
  className = '',
  size = 'md',
  variant = 'primary'
}: FollowButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const { showSuccess, showError, showLoading, hideToast } = useToast()
  
  // Use centralized state management
  const { followState: isFollowing, toggleFollow, isLoading } = useUserState({
    userId: userId.toString(),
    autoFetch: true
  })

  // Size classes with minimum touch targets and fixed widths for heart-shaped button
  const sizeClasses = {
    xxs: 'px-2 py-0.5 text-xs min-w-[22px] min-h-[20px] w-[90px]',
    xs: 'px-2 py-1 text-xs min-w-[22px] min-h-[22px] w-[90px]',
    sm: 'px-2 py-1 text-xs min-w-[22px] min-h-[22px] w-[100px]',
    md: 'px-3 py-1.5 text-sm min-w-[22px] min-h-[22px] w-[110px]',
    lg: 'px-3 py-2 text-sm min-w-[22px] min-h-[22px] w-[120px]'
  }

  // Heart icon sizes for different button sizes - consistent sizing
  const heartSizes = {
    xxs: 'w-3 h-3',
    xs: 'w-4 h-4',
    sm: 'w-4 h-4',
    md: 'w-4.5 h-4.5',
    lg: 'w-5 h-5'
  }

  // Heart-shaped button styling
  const getHeartButtonClasses = (following: boolean) => {
    if (following) {
      // Filled purple background when following
      return 'bg-purple-600 text-white border-2 border-purple-600 hover:bg-purple-700 hover:border-purple-700'
    } else {
      // Clear background with purple border and text when not following
      return 'bg-transparent text-purple-600 border-2 border-purple-600 hover:bg-purple-50'
    }
  }

  // Handle click outside to close error message
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (errorRef.current && !errorRef.current.contains(event.target as Node)) {
        setError(null)
      }
    }

    if (error) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [error])

  // Notify parent component of follow state changes
  useEffect(() => {
    onFollowChange?.(isFollowing)
  }, [isFollowing, onFollowChange])

  const handleFollowToggle = async () => {
    const token = getAccessToken()
    if (!token) {
      showError('Authentication Required', 'Please log in to follow users')
      return
    }

    const action = isFollowing ? 'unfollow' : 'follow'
    setError(null)

    // Show loading toast
    const loadingToastId = showLoading(
      `${action === 'follow' ? 'Following' : 'Unfollowing'} user...`,
      'Please wait'
    )

    try {
      // Use centralized state management with optimistic updates
      await toggleFollow()
      
      // Success - update toast
      hideToast(loadingToastId)
      showSuccess(
        `User ${action === 'follow' ? 'followed' : 'unfollowed'}!`,
        `You ${action === 'follow' ? 'are now following' : 'unfollowed'} this user`
      )
    } catch (error) {
      // Error handling - rollback is handled by useUserState
      hideToast(loadingToastId)
      
      let errorMessage = 'Failed to update follow status'
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMessage = 'Please log in to follow users'
        } else if (error.message.includes('404')) {
          errorMessage = 'User not found'
        } else if (error.message.includes('409')) {
          errorMessage = 'Follow relationship already exists'
        } else if (error.message.includes('422')) {
          errorMessage = 'Cannot follow yourself'
        } else {
          errorMessage = error.message
        }
      }

      showError('Follow Failed', errorMessage, {
        label: 'Retry',
        onClick: () => handleFollowToggle()
      })
    }
  }

  const buttonText = isFollowing ? 'Following  ' : 'Follow me!'
  const heartButtonClasses = getHeartButtonClasses(isFollowing)

  return (
    <div className="relative">
      <button
        onClick={handleFollowToggle}
        disabled={isLoading}
        className={`
          inline-flex items-center justify-center gap-1.5
          font-medium rounded-full transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
          touch-manipulation select-none
          active:scale-95 active:shadow-inner
          ${sizeClasses[size]}
          ${heartButtonClasses}
          ${className}
        `}
        aria-label={isFollowing ? `Unfollow user ${userId}` : `Follow user ${userId}`}
        aria-pressed={isFollowing}
        aria-describedby={error ? `follow-error-${userId}` : undefined}
        {...createTouchHandlers(undefined, 'light')}
      >
        {isLoading ? (
          <Loader2 className={`${heartSizes[size]} animate-spin`} />
        ) : (
          <Heart 
            className={`${heartSizes[size]} ${!isFollowing ? 'fill-current' : ''} flex-shrink-0`}
            strokeWidth={2}
          />
        )}
        <span className="whitespace-nowrap whitespace-pre text-xs font-medium">{isLoading ? 'Loading...' : buttonText}</span>
      </button>

      {error && (
        <div 
          ref={errorRef}
          id={`follow-error-${userId}`}
          role="alert"
          aria-live="polite"
          className="absolute top-full left-0 mt-1 p-2 bg-red-100 border border-red-300 rounded-md shadow-sm z-10 min-w-max"
        >
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}