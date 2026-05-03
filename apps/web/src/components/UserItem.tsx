/**
 * IMPORTANT:
 * This is the single source of truth for all user row interactions.
 * Do not reintroduce custom user row implementations elsewhere.
 * Standardizes: Layout, A11y, Haptics, and Type Safety.
 */
import React from 'react'
import Link from 'next/link'
import UserAvatar from './UserAvatar'
import { UserSearchResult } from '@/types/userSearch'
import { triggerHaptic } from '@/utils/hapticFeedback'
import { formatTimeAgo } from '@/utils/timeAgo'

/**
 * Discriminated union for UserItem interaction modes.
 * Ensures the correct props are provided for each visual/behavioral intent.
 */
type BaseItemProps = {
  user: UserSearchResult
  className?: string
  size?: 'xs' | 'sm' | 'md'
  compact?: boolean
  showTimestamp?: boolean
  rightElement?: React.ReactNode
  ariaLabel?: string
  // List/Dropdown Integration Props
  index?: number
  isSelected?: boolean
  setItemRef?: (index: number) => (el: HTMLElement | null) => void
  onMouseEnter?: (index: number) => void
}

type NavigationProps = BaseItemProps & {
  mode: 'navigation'
  href: string
  onClick?: (e: React.MouseEvent) => void
}

type SelectionProps = BaseItemProps & {
  mode: 'selection'
  onClick: (user: UserSearchResult) => void
}

type StaticProps = BaseItemProps & {
  mode: 'static'
  onClick?: () => void
}

export type UserItemProps = NavigationProps | SelectionProps | StaticProps

/**
 * 1. UserItemLayout
 * Purely visual component. Ensures identical spacing and alignment across all modes.
 */
const UserItemLayout = ({
  user,
  size = 'md',
  showTimestamp = false,
  rightElement
}: BaseItemProps) => {
  return (
    <div className={`flex items-center space-x-3 w-full text-left ${size === 'xs' ? 'space-x-2' : 'space-x-3'}`}>
      <div className="flex-shrink-0">
        <UserAvatar
          user={user}
          size={size}
          className="border-0 shadow-none"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {user.displayName || user.username}
        </div>
        
        {/* Subtitle logic: Timestamp > Username > Bio */}
        {showTimestamp && user.createdAt ? (
          <div className="text-xs text-gray-500">
            {formatTimeAgo(user.createdAt)}
          </div>
        ) : user.username && (user.displayName || user.username) !== `@${user.username}` ? (
          <div className="text-xs text-gray-500 truncate">
            @{user.username}
          </div>
        ) : user.bio ? (
          <div className="text-xs text-gray-400 truncate mt-0.5">
            {user.bio}
          </div>
        ) : null}
      </div>
      
      {rightElement && (
        <div className="flex-shrink-0">
          {rightElement}
        </div>
      )}
    </div>
  )
}

/**
 * 2. UserItemNavigation (Wrapper for <Link>)
 */
const UserItemNavigation = ({
  user,
  href,
  onClick,
  className = '',
  isSelected,
  index,
  setItemRef,
  onMouseEnter,
  ...baseProps
}: NavigationProps) => {
  const baseClassName = `block w-full ${baseProps.compact ? 'px-0 py-1' : 'px-3 py-3'} no-underline text-inherit transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${isSelected ? 'bg-purple-50' : 'hover:bg-purple-50'} ${className}`
  
  return (
    <Link
      href={href}
      ref={setItemRef && index !== undefined ? (setItemRef(index) as any) : undefined}
      className={baseClassName}
      onClick={(e) => {
        triggerHaptic('light')
        // Explicitly side-effects ONLY. Do NOT call preventDefault().
        if (onClick) {
          onClick(e)
        }
      }}
      onMouseEnter={() => onMouseEnter && index !== undefined && onMouseEnter(index)}
      aria-label={baseProps.ariaLabel || `Go to ${user.displayName || user.username}'s profile`}
    >
      <UserItemLayout user={user} {...baseProps} />
    </Link>
  )
}

/**
 * 3. UserItemSelection (Wrapper for <button role="option">)
 */
const UserItemSelection = ({
  user,
  onClick,
  isSelected,
  index,
  setItemRef,
  onMouseEnter,
  className = '',
  ...baseProps
}: SelectionProps) => {
  const baseClassName = `block w-full ${baseProps.compact ? 'px-1 py-1' : 'px-3 py-3'} text-left transition-colors ${baseProps.compact ? 'min-h-0' : 'min-h-[56px] sm:min-h-[48px]'} touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${isSelected ? 'bg-purple-50' : 'hover:bg-purple-50'} ${className}`

  return (
    <button
      type="button"
      ref={setItemRef && index !== undefined ? setItemRef(index) : undefined}
      role="option"
      aria-selected={isSelected}
      className={baseClassName}
      onMouseDown={(e) => {
        // Prevent focus stealing from input in dropdown contexts
        e.preventDefault()
      }}
      onClick={() => {
        triggerHaptic('light')
        onClick(user)
      }}
      onMouseEnter={() => onMouseEnter && index !== undefined && onMouseEnter(index)}
      aria-label={baseProps.ariaLabel || `Select ${user.displayName || user.username}`}
    >
      <UserItemLayout user={user} {...baseProps} />
    </button>
  )
}

/**
 * 4. UserItemStatic (Wrapper for <div> or <button>)
 */
const UserItemStatic = ({
  user,
  onClick,
  className = '',
  ...baseProps
}: StaticProps) => {
  const baseClassName = `block w-full ${baseProps.compact ? 'px-0 py-0.5' : 'px-3 py-3'} transition-colors ${onClick ? 'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset' : ''} ${className}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light')
          onClick()
        }}
        className={baseClassName}
        aria-label={`Action for ${user.displayName || user.username}`}
      >
        <UserItemLayout user={user} {...baseProps} />
      </button>
    )
  }

  return (
    <div className={baseClassName}>
      <UserItemLayout user={user} {...baseProps} />
    </div>
  )
}

/**
 * Unified UserItem Component
 * dispatches to correct internal wrapper based on 'mode'
 */
export default function UserItem(props: UserItemProps) {
  // Use discrimination logic for dispatching
  switch (props.mode) {
    case 'navigation':
      return <UserItemNavigation {...props} />
    case 'selection':
      return <UserItemSelection {...props} />
    case 'static':
      return <UserItemStatic {...props} />
    default:
      // Safety exhaustion check for JS consumers
      console.warn('UserItem: Missing or invalid mode.')
      return null
  }
}
