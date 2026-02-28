'use client'

import React from 'react'
import { UserSearchResult } from '@/types/userSearch'
import UserSearchResultItem from './UserSearchResultItem'

// Shared dropdown body for all user-search surfaces.
// Row rendering must flow through UserSearchResultItem only.
interface UserSearchDropdownProps {
  users: UserSearchResult[]
  loading: boolean
  hasSearched: boolean
  searchQuery: string
  selectedIndex: number
  onSelect: (user: UserSearchResult) => void
  onIndexChange: (index: number) => void
  setItemRef: (index: number) => (el: HTMLElement | null) => void
  dropdownRef?: React.Ref<HTMLDivElement>
  id?: string
  className: string
  style?: React.CSSProperties
  dir?: React.HTMLAttributes<HTMLDivElement>['dir']
  dataMentionAutocomplete?: boolean
}

export default function UserSearchDropdown({
  users,
  loading,
  hasSearched,
  searchQuery,
  selectedIndex,
  onSelect,
  onIndexChange,
  setItemRef,
  dropdownRef,
  id,
  className,
  style,
  dir,
  dataMentionAutocomplete = false,
}: UserSearchDropdownProps) {
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
          No users found for "{searchQuery}"
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="py-1" role="group" aria-label="Search results">
          {users.map((user, index) => (
            <UserSearchResultItem
              key={user.id}
              user={user}
              index={index}
              isSelected={index === selectedIndex}
              onSelect={onSelect}
              onMouseEnter={onIndexChange}
              setItemRef={setItemRef}
            />
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
