'use client'

import React from 'react'
import Link from 'next/link'
import { createTouchHandlers } from '@/utils/hapticFeedback'
import ProfilePhotoDisplay from './ProfilePhotoDisplay'
import { UserSearchResult } from '@/types/userSearch'

/**
 * Canonical user-search result row.
 * Navbar search is the visual source of truth.
 * Do not duplicate this row markup in feature-specific dropdowns.
 */
type BaseItemProps = {
  user: UserSearchResult
  index: number
  isSelected: boolean
  onMouseEnter: (index: number) => void
  setItemRef: (index: number) => (el: HTMLElement | null) => void
  getAriaLabel?: (user: UserSearchResult) => string
}

export type UserSearchResultItemProps = BaseItemProps & (
  | {
      mode: 'navigation'
      href: string
      onClick?: (e: React.MouseEvent) => void
    }
  | {
      mode: 'selection'
      href?: never
      onClick: (user: UserSearchResult) => void
    }
)

export default function UserSearchResultItem(props: UserSearchResultItemProps) {
  const {
    user,
    index,
    isSelected,
    mode,
    onMouseEnter,
    setItemRef,
    getAriaLabel,
  } = props

  // Runtime dev warnings
  if (process.env.NODE_ENV !== 'production') {
    if (mode === 'selection' && 'href' in props && props.href !== undefined) {
      console.warn('UserSearchResultItem: href is not allowed in selection mode')
    }
  }
  const ariaLabel = getAriaLabel
    ? getAriaLabel(user)
    : mode === 'navigation'
      ? `Go to ${user.displayName || user.username}'s profile${user.bio ? `. ${user.bio}` : ''}`
      : `Select ${user.displayName || user.username}`

  const baseClassName = `block w-full px-3 py-3 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none transition-colors min-h-[56px] sm:min-h-[48px] touch-manipulation active:bg-purple-100 focus:ring-2 focus:ring-purple-500 focus:ring-inset no-underline text-inherit ${isSelected ? 'bg-purple-50' : ''}`

  const renderContent = () => (
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
  )

  if (props.mode === 'selection') {
    return (
      <button
        type="button"
        key={user.id}
        ref={setItemRef(index)}
        role="option"
        aria-selected={isSelected}
        className={baseClassName}
        onMouseDown={(e) => {
          e.preventDefault()
        }}
        onClick={(e) => {
          props.onClick(user)
        }}
        onMouseEnter={() => onMouseEnter(index)}
        aria-label={ariaLabel}
        {...createTouchHandlers(undefined, 'light')}
      >
        {renderContent()}
      </button>
    )
  }

  return (
    <Link
      key={user.id}
      ref={setItemRef(index)}
      href={props.href}
      className={baseClassName}
      onClick={(e) => {
        if (props.onClick) {
          props.onClick(e)
        }
      }}
      onMouseEnter={() => onMouseEnter(index)}
      aria-label={ariaLabel}
      {...createTouchHandlers(undefined, 'light')}
    >
      {renderContent()}
    </Link>
  )
}
