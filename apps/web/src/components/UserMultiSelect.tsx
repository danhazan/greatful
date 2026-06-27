'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModalPortalRefs } from '@/hooks/useModalPortalRefs'
import { X } from 'lucide-react'
import { useFloating, FloatingPortal, autoUpdate, flip, offset, shift, size } from '@floating-ui/react'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { useClickOutside } from "@/hooks/useClickOutside"
import { useUserSearch } from '@/hooks/useUserSearch'
import { UserSearchDropdown } from '@/components/user-search'
import { UserSearchResult } from '@/types/userSearch'
import { getCompleteInputStyling } from '@/utils/inputStyles'

interface UserMultiSelectProps {
  selectedUsers: UserSearchResult[]
  onChange: (users: UserSearchResult[]) => void
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          })
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  })

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

  useClickOutside(containerRef, isOpen, () => setIsOpen(false), [refs.floating])

  // Register the floating portal ref so parent useModal hooks can recognize
  // clicks inside the dropdown as "inside" rather than "outside click".
  const { registerRef } = useModalPortalRefs()
  useEffect(() => {
    const unregister = registerRef(refs.floating)
    return unregister
  }, [registerRef, refs.floating])

  const handleSelect = (user: UserSearchResult) => {
    if (disabled) {
      return
    }
    if (!selectedUsers.find((u) => u.id === user.id)) {
      if (maxSelected && selectedUsers.length >= maxSelected) {
        return
      }
      onChange([...selectedUsers, user])
    }
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
    <div ref={(node) => { containerRef.current = node; refs.setReference(node) }} className="relative">
      <div className={`w-full rounded-lg border px-2 py-2 ${disabled ? 'cursor-not-allowed bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}>
        {selectedUsers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800"
              >
                <span>@{user.username || 'deleted'}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(user.id)}
                  className="text-purple-600 hover:text-purple-800"
                  aria-label={`Remove ${user.username || 'user'}`}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

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
        <FloatingPortal>
          <div ref={refs.setFloating} style={floatingStyles} className="z-50">
            <UserSearchDropdown
              mode="selection"
              id="user-multi-select-results"
              className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
              users={filteredUsers}
              loading={loading}
              hasSearched={hasSearched}
              searchQuery={query}
              selectedIndex={selectedIndex}
              onSelect={handleSelect}
              onIndexChange={setSelectedIndex}
              setItemRef={setItemRef}
            />
          </div>
        </FloatingPortal>
      )}
    </div>
  )
}
