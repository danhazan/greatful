'use client'

import React from 'react'
import { createTouchHandlers } from '@/utils/hapticFeedback'
import ProfilePhotoDisplay from './ProfilePhotoDisplay'
import { UserSearchResult } from '@/types/userSearch'

/**
 * Canonical user-search result row.
 * Navbar search is the visual source of truth.
 * Do not duplicate this row markup in feature-specific dropdowns.
 */
interface UserSearchResultItemProps {
  user: UserSearchResult
  index: number
  isSelected: boolean
  onSelect: (user: UserSearchResult) => void
  onMouseEnter: (index: number) => void
  setItemRef: (index: number) => (el: HTMLElement | null) => void
  getAriaLabel?: (user: UserSearchResult) => string
}

export default function UserSearchResultItem({
  user,
  index,
  isSelected,
  onSelect,
  onMouseEnter,
  setItemRef,
  getAriaLabel,
}: UserSearchResultItemProps) {
  const ariaLabel = getAriaLabel
    ? getAriaLabel(user)
    : `Go to ${user.displayName || user.username}'s profile${user.bio ? `. ${user.bio}` : ''}`

  return (
    <button
      key={user.id}
      ref={setItemRef(index)}
      type="button"
      role="option"
      aria-selected={isSelected}
      className={`w-full px-3 py-3 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none transition-colors min-h-[56px] sm:min-h-[48px] touch-manipulation active:bg-purple-100 select-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${isSelected ? 'bg-purple-50' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault()
      }}
      onClick={(e) => {
        e.preventDefault()
        onSelect(user)
      }}
      onMouseEnter={() => onMouseEnter(index)}
      aria-label={ariaLabel}
      {...createTouchHandlers(undefined, 'light')}
    >
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <ProfilePhotoDisplay
            photoUrl={user.profileImageUrl}
            username={user.username}
            size="sm"
            className="border-0 shadow-none"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {user.displayName || user.username}
          </div>
          <div className="text-xs text-gray-500 truncate">
            @{user.username}
          </div>
          {user.bio && (
            <div className="text-xs text-gray-400 truncate mt-0.5">
              {user.bio}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
