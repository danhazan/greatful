'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { useUserSearch } from '@/hooks/useUserSearch'
import { getTextAlignmentClass, getDirectionAttribute } from '@/utils/rtlUtils'
import { UserSearchDropdown } from '@/components/user-search'
import { UserSearchResult } from '@/types/userSearch'

interface UserInfo {
  id: number
  username: string
  profileImageUrl?: string
  profile_image_url?: string
  bio?: string
}

interface MentionAutocompleteProps {
  isOpen: boolean
  searchQuery: string
  onUserSelect: (user: UserInfo) => void
  onClose: () => void
  position: { x: number; y: number }
  className?: string
}

export default function MentionAutocomplete({
  isOpen,
  searchQuery,
  onUserSelect,
  onClose,
  position,
  className = ''
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const normalizeMentionQuery = useCallback((query: string) => query.replace('@', ''), [])

  const { users, loading, hasSearched } = useUserSearch({
    query: searchQuery,
    isOpen,
    normalizeQuery: normalizeMentionQuery,
  })

  useEffect(() => {
    setSelectedIndex(0)
  }, [users])

  // Handle keyboard navigation with scrolling
  const { setItemRef } = useKeyboardNavigation({
    isOpen,
    itemCount: users.length,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelect: () => {
      if (users[selectedIndex]) {
        handleUserSelect(users[selectedIndex])
      }
    },
    onClose,
    scrollBehavior: 'smooth'
  })

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleUserSelect = (user: UserSearchResult) => {
    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      profileImageUrl: user.profileImageUrl || undefined,
      profile_image_url: user.profileImageUrl || undefined,
      bio: user.bio
    }
    onUserSelect(userInfo)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <UserSearchDropdown
      dropdownRef={dropdownRef}
      dataMentionAutocomplete={true}
      className={`absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs w-64 sm:w-80 max-h-60 sm:max-h-72 overflow-y-auto custom-scrollbar touch-manipulation ${className} ${getTextAlignmentClass(searchQuery)}`}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'manipulation',
      }}
      dir={getDirectionAttribute(searchQuery)}
      users={users}
      loading={loading}
      hasSearched={hasSearched}
      searchQuery={searchQuery}
      selectedIndex={selectedIndex}
      onSelect={handleUserSelect}
      onIndexChange={setSelectedIndex}
      setItemRef={setItemRef}
    />
  )
}
