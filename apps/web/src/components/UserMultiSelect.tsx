'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { useUserSearch } from '@/hooks/useUserSearch'
import { UserSearchDropdown } from '@/components/user-search'
import { UserSearchResult } from '@/types/userSearch'
import { getCompleteInputStyling } from '@/utils/inputStyles'

export interface UserMultiSelectUser {
  id: number
  username: string
  displayName?: string
  profileImageUrl?: string | null
  bio?: string
}

interface UserMultiSelectProps {
  selectedUsers: UserMultiSelectUser[]
  onChange: (users: UserMultiSelectUser[]) => void
  placeholder?: string
  maxSelected?: number
  excludeUserIds?: number[]
  disabled?: boolean
}

export default function UserMultiSelect({
  selectedUsers,
  onChange,
  placeholder = 'Search users...',
  maxSelected,
  excludeUserIds = [],
  disabled = false,
}: UserMultiSelectProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { users, loading, hasSearched } = useUserSearch({
    query,
    isOpen: isOpen && !disabled,
    minQueryLength: 1,
  })

  const filteredUsers = useMemo(() => {
    const selectedIds = new Set(selectedUsers.map((user) => user.id))
    const excludedIds = new Set(excludeUserIds)
    return users.filter((user) => !selectedIds.has(user.id) && !excludedIds.has(user.id))
  }, [users, selectedUsers, excludeUserIds])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredUsers])

  const dropdownOpen = isOpen && query.trim().length > 0
  const { setItemRef } = useKeyboardNavigation({
    isOpen: dropdownOpen,
    itemCount: filteredUsers.length,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelect: () => {
      if (filteredUsers[selectedIndex]) {
        handleSelect(filteredUsers[selectedIndex])
      }
    },
    onClose: () => setIsOpen(false),
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (user: UserSearchResult) => {
    if (disabled) {
      return
    }
    if (maxSelected && selectedUsers.length >= maxSelected) {
      return
    }

    onChange([
      ...selectedUsers,
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        bio: user.bio,
      },
    ])
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleRemove = (id: number) => {
    if (disabled) {
      return
    }
    onChange(selectedUsers.filter((user) => user.id !== id))
  }

  const reachedMax = Boolean(maxSelected && selectedUsers.length >= maxSelected)

  return (
    <div ref={containerRef} className="relative">
      <div className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2">
        {selectedUsers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800"
              >
                <span>@{user.username}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(user.id)}
                  className="text-purple-600 hover:text-purple-800"
                  aria-label={`Remove ${user.username}`}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* getCompleteInputStyling() is required here to prevent transparent text bugs on mobile WebKit */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={reachedMax ? `Maximum ${maxSelected} users selected` : placeholder}
          className={`w-full border-none px-2 py-2 text-sm outline-none ${getCompleteInputStyling().className}`}
          style={getCompleteInputStyling().style}
          disabled={disabled || reachedMax}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-autocomplete="list"
          aria-controls="user-multi-select-results"
        />
      </div>

      {dropdownOpen && (
        <UserSearchDropdown
          mode="selection"
          id="user-multi-select-results"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          users={filteredUsers}
          loading={loading}
          hasSearched={hasSearched}
          searchQuery={query}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          onIndexChange={setSelectedIndex}
          setItemRef={setItemRef}
        />
      )}
    </div>
  )
}

