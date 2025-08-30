'use client'

import React, { useState, useEffect, useRef } from 'react'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { isAuthenticated, getAccessToken } from '@/utils/auth'
import { createTouchHandlers } from '@/utils/hapticFeedback'
import { useToast } from '@/contexts/ToastContext'

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
  const [isFollowing, setIsFollowing] = useState(initialFollowState)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const { showSuccess, showError, showLoading, hideToast, updateToast } = useToast()

  // Size classes with minimum touch targets - reduced by 50%
  const sizeClasses = {
    xxs: 'px-0.5 py-0.25 text-xs min-w-[22px] min-h-[22px]',
    xs: 'px-1 py-0.5 text-xs min-w-[22px] min-h-[22px]',
    sm: 'px-1.5 py-1 text-xs min-w-[22px] min-h-[22px]',
    md: 'px-2 py-1 text-xs min-w-[22px] min-h-[22px]',
    lg: 'px-3 py-1.5 text-sm min-w-[22px] min-h-[22px]'
  }

  // Variant classes
  const getVariantClasses = (following: boolean) => {
    if (following) {
      return {
        primary: 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300',
        secondary: 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300',
        outline: 'bg-transparent text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
      }
    } else {
      return {
        primary: 'bg-purple-600 text-white border border-purple-600 hover:bg-purple-700 hover:border-purple-700',
        secondary: 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200 hover:border-purple-400',
        outline: 'bg-transparent text-purple-600 border border-purple-600 hover:bg-purple-50'
      }
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

  // Fetch initial follow status
  useEffect(() => {
    const fetchFollowStatus = async () => {
      try {
        const token = getAccessToken()
        if (!token) return

        const response = await fetch(`/api/follows/${userId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (response && response.ok) {
          const result = await response.json()
          if (result.success) {
            const status: FollowStatus = result.data
            setIsFollowing(status.is_following)
          }
        }
      } catch (error) {
        console.error('Error fetching follow status:', error)
      }
    }

    fetchFollowStatus()
  }, [userId])

  const handleFollowToggle = async () => {
    const token = getAccessToken()
    if (!token) {
      showError('Authentication Required', 'Please log in to follow users')
      return
    }

    const originalFollowState = isFollowing
    const newFollowState = !isFollowing
    const action = newFollowState ? 'follow' : 'unfollow'

    // Optimistic update
    setIsFollowing(newFollowState)
    onFollowChange?.(newFollowState)
    setIsLoading(true)
    setError(null)

    // Show loading toast
    const loadingToastId = showLoading(
      `${action === 'follow' ? 'Following' : 'Unfollowing'} user...`,
      'Please wait'
    )

    try {
      const method = originalFollowState ? 'DELETE' : 'POST'
      const response = await fetch(`/api/follows/${userId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (response && response.ok && result.success) {
        // Success - update toast
        hideToast(loadingToastId)
        showSuccess(
          `User ${action === 'follow' ? 'followed' : 'unfollowed'}!`,
          `You ${action === 'follow' ? 'are now following' : 'unfollowed'} this user`
        )
      } else {
        // Rollback optimistic update
        setIsFollowing(originalFollowState)
        onFollowChange?.(originalFollowState)

        // Handle specific error cases
        hideToast(loadingToastId)
        
        let errorMessage = 'Failed to update follow status'
        if (response && response.status === 401) {
          errorMessage = 'Please log in to follow users'
        } else if (response && response.status === 404) {
          errorMessage = 'User not found'
        } else if (response && response.status === 409) {
          errorMessage = 'Follow relationship already exists'
        } else if (response && response.status === 422) {
          errorMessage = 'Cannot follow yourself'
        } else if (result?.error?.message) {
          errorMessage = result.error.message
        }

        showError('Follow Failed', errorMessage, {
          label: 'Retry',
          onClick: () => handleFollowToggle()
        })
      }
    } catch (error) {
      // Rollback optimistic update
      setIsFollowing(originalFollowState)
      onFollowChange?.(originalFollowState)
      
      console.error('Follow toggle error:', error)
      hideToast(loadingToastId)
      showError(
        'Network Error', 
        'Please check your connection and try again',
        {
          label: 'Retry',
          onClick: () => handleFollowToggle()
        }
      )
    } finally {
      setIsLoading(false)
    }
  }

  const buttonText = isFollowing ? 'Following' : 'Follow'
  const Icon = isFollowing ? UserMinus : UserPlus
  const variantClasses = getVariantClasses(isFollowing)[variant]

  return (
    <div className="relative">
      <button
        onClick={handleFollowToggle}
        disabled={isLoading}
        className={`
          inline-flex items-center justify-center gap-2 
          font-medium rounded-lg transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
          touch-manipulation select-none
          active:scale-95 active:shadow-inner
          ${sizeClasses[size]}
          ${variantClasses}
          ${className}
        `}
        aria-label={isFollowing ? `Unfollow user ${userId}` : `Follow user ${userId}`}
        {...createTouchHandlers(undefined, 'light')}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Icon className="w-3 h-3" />
        )}
        <span className="whitespace-nowrap">{isLoading ? 'Loading...' : buttonText}</span>
      </button>

      {error && (
        <div 
          ref={errorRef}
          className="absolute top-full left-0 mt-1 p-2 bg-red-100 border border-red-300 rounded-md shadow-sm z-10 min-w-max"
        >
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}