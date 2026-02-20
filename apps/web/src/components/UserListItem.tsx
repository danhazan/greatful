'use client'

import React from 'react'
import ProfilePhotoDisplay from './ProfilePhotoDisplay'
import { formatTimeAgo } from '@/utils/timeAgo'

interface UserListItemProps {
  user: {
    id: string | number
    name: string
    username?: string
    profileImageUrl?: string
    image?: string // legacy fallback
    bio?: string
    createdAt?: string
  }
  rightElement?: React.ReactNode
  onClick?: () => void
  showTimestamp?: boolean
  className?: string
  role?: string
  tabIndex?: number
  ariaLabel?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export default function UserListItem({
  user,
  rightElement,
  onClick,
  showTimestamp = false,
  className = '',
  role,
  tabIndex,
  ariaLabel,
  onKeyDown
}: UserListItemProps) {
  return (
    <div
      className={`flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer ${className}`}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {/* User Avatar */}
      <div className="flex-shrink-0">
        <ProfilePhotoDisplay
          photoUrl={user.image}
          username={user.name}
          size="sm"
          className="border-0 shadow-none"
        />
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {user.name}
        </p>
        {showTimestamp && user.createdAt ? (
          <p className="text-xs text-gray-500">
            {formatTimeAgo(user.createdAt)}
          </p>
        ) : user.username && user.username !== user.name ? (
          <p className="text-xs text-gray-500">
            @{user.username}
          </p>
        ) : user.bio ? (
          <p className="text-xs text-gray-500 truncate">
            {user.bio}
          </p>
        ) : null}
      </div>

      {/* Right Element (Follow button, emoji, etc.) */}
      {rightElement && (
        <div className="flex-shrink-0">
          {rightElement}
        </div>
      )}
    </div>
  )
}