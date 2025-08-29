'use client'

import React, { useState, useEffect, useRef } from 'react'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { isAuthenticated, getAccessToken } from '@/utils/auth'

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

  // Size classes
  const sizeClasses = {
    xxs: 'px-1 py-0.5 text-xs',
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
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
      setError('Please log in to follow users')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const method = isFollowing ? 'DELETE' : 'POST'
      const response = await fetch(`/api/follows/${userId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (response && response.ok && result.success) {
        // Optimistic update
        const newFollowState = !isFollowing
        setIsFollowing(newFollowState)
        onFollowChange?.(newFollowState)
      } else {
        // Handle specific error cases
        if (response && response.status === 401) {
          setError('Please log in to follow users')
        } else if (response && response.status === 404) {
          setError('User not found')
        } else if (response && response.status === 409) {
          setError('Follow relationship already exists')
        } else if (response && response.status === 422) {
          setError('Cannot follow yourself')
        } else {
          setError(result?.error?.message || 'Failed to update follow status')
        }
      }
    } catch (error) {
      console.error('Follow toggle error:', error)
      setError('Network error. Please try again.')
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
          ${sizeClasses[size]}
          ${variantClasses}
          ${className}
        `}
        aria-label={isFollowing ? `Unfollow user ${userId}` : `Follow user ${userId}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Icon className="w-4 h-4" />
        )}
        <span>{isLoading ? 'Loading...' : buttonText}</span>
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