'use client'

import React from 'react'
import { UserSearchResult } from '@/types/userSearch'
import UserItem from './UserItem'

// Shared dropdown body for all user-search surfaces.
// Row rendering must flow through UserItem only.
type BaseDropdownProps = {
  users: UserSearchResult[]
  loading: boolean
  hasSearched: boolean
  searchQuery: string
  selectedIndex: number
  onIndexChange: (index: number) => void
  setItemRef: (index: number) => (el: HTMLElement | null) => void
  dropdownRef?: React.Ref<HTMLDivElement>
  id?: string
  className: string
  style?: React.CSSProperties
  dir?: React.HTMLAttributes<HTMLDivElement>['dir']
  dataMentionAutocomplete?: boolean
  getResultAriaLabel?: (user: UserSearchResult) => string
}

export type UserSearchDropdownProps = BaseDropdownProps & (
  | {
      mode: 'navigation'
      onSelect?: (user: UserSearchResult) => void
    }
  | {
      mode: 'selection'
      onSelect: (user: UserSearchResult) => void
    }
)

export default function UserSearchDropdown(props: UserSearchDropdownProps) {
  const {
    mode,
    users,
    loading,
    hasSearched,
    searchQuery,
    selectedIndex,
    onIndexChange,
    setItemRef,
    dropdownRef,
    id,
    className,
    style,
    dir,
    dataMentionAutocomplete = false,
    getResultAriaLabel,
  } = props
  return (
    <div
      id={id}
      ref={dropdownRef}
      className={className}
      style={style}
      role="listbox"
      aria-label="User search results"
      dir={dir}
      {...(dataMentionAutocomplete ? { 'data-mention-autocomplete': true } : {})}
    >
      {loading && (
        <div className="p-3 text-center text-gray-500 text-sm" role="status" aria-live="polite">
          <div className="animate-spin inline-block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full mr-2" aria-hidden="true"></div>
          Searching...
        </div>
      )}

      {!loading && hasSearched && users.length === 0 && searchQuery && (
        <div className="p-3 text-center text-gray-500 text-sm" role="status" aria-live="polite">
          No users found for &quot;{searchQuery}&quot;
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="py-1" role="group" aria-label="Search results">
          {users.map((user, index) => (
            props.mode === 'navigation' ? (
              <UserItem
                key={user.id}
                mode="navigation"
                user={user}
                index={index}
                isSelected={index === selectedIndex}
                href={`/profile/${user.id}`}
                onClick={props.onSelect ? () => props.onSelect?.(user) : undefined}
                onMouseEnter={onIndexChange}
                ariaLabel={getResultAriaLabel ? getResultAriaLabel(user) : undefined}
              />
            ) : (
              <UserItem
                key={user.id}
                mode="selection"
                user={user}
                index={index}
                isSelected={index === selectedIndex}
                onClick={() => props.onSelect(user)}
                setItemRef={setItemRef}
                ariaLabel={getResultAriaLabel ? getResultAriaLabel(user) : undefined}
              />
            )
          ))}
        </div>
      )}

      {!loading && hasSearched && !searchQuery && (
        <div className="p-3 text-center text-gray-500 text-sm" role="status">
          Type to search for users...
        </div>
      )}
    </div>
  )
}
