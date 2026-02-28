'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { createTouchHandlers } from '@/utils/hapticFeedback'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { getCompleteInputStyling } from '@/utils/inputStyles'
import { useUserSearch } from '@/hooks/useUserSearch'
import { UserSearchDropdown } from '@/components/user-search'
import { UserSearchResult } from '@/types/userSearch'

interface UserSearchBarProps {
  placeholder?: string
  className?: string
  isMobile?: boolean
}

export default function UserSearchBar({
  placeholder = "Search users...",
  className = '',
  isMobile = false
}: UserSearchBarProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const portalContainerRef = useRef<HTMLElement | null>(null)

  const { users, loading, hasSearched, resetSearch } = useUserSearch({
    query: searchQuery,
    isOpen: true,
  })

  // Create portal container on mount for mobile search
  useEffect(() => {
    if (isMobile && !portalContainerRef.current) {
      const el = document.createElement('div')
      el.setAttribute('data-portal', 'mobile-search')
      el.style.position = 'fixed'
      el.style.top = '0'
      el.style.left = '0'
      el.style.width = '100%'
      el.style.height = '0'
      el.style.pointerEvents = 'none' // container itself doesn't capture pointer events
      el.style.zIndex = '50'
      portalContainerRef.current = el
      document.body.appendChild(el)
    }
    return () => {
      if (portalContainerRef.current) {
        portalContainerRef.current.remove()
        portalContainerRef.current = null
      }
    }
  }, [isMobile])

  // Close dropdown when query is empty, preserving existing navbar behavior
  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsDropdownOpen(false)
    }
  }, [searchQuery])

  useEffect(() => {
    setSelectedIndex(0)
  }, [users])

  // Handle focus when expanded (better than setTimeout)
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      // Small delay to allow portal to mount and styles to apply
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isExpanded])

  const handleUserSelect = useCallback((user: UserSearchResult) => {
    // Navigate to user profile
    router.push(`/profile/${user.id}`)
    setIsDropdownOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
    resetSearch()
    inputRef.current?.blur()
  }, [router, resetSearch])

  const handleClose = useCallback(() => {
    setIsDropdownOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
    resetSearch()
    setIsExpanded(false)
    inputRef.current?.blur()
  }, [resetSearch])

  // Handle keyboard navigation with scrolling
  const { setItemRef } = useKeyboardNavigation({
    isOpen: isDropdownOpen,
    itemCount: users.length,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelect: () => {
      if (users[selectedIndex]) {
        handleUserSelect(users[selectedIndex])
      }
    },
    onClose: handleClose,
    scrollBehavior: 'smooth'
  })

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        handleClose()
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, handleClose])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)

    if (value.trim()) {
      setIsDropdownOpen(true)
    }
  }

  const handleInputFocus = () => {
    setIsExpanded(true)
    if (searchQuery.trim()) {
      setIsDropdownOpen(true)
    }
  }

  const handleInputBlur = () => {
    // Don't close dropdown immediately to allow for clicks
    // In tests, the :hover pseudo-class doesn't work, so we need a longer delay
    setTimeout(() => {
      if (!dropdownRef.current?.matches(':hover')) {
        // Only close if not interacting with dropdown
        setIsDropdownOpen(false)
        // Collapse mobile search if no query
        if (isMobile && !searchQuery.trim()) {
          setIsExpanded(false)
        }
      }
    }, 300)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setIsDropdownOpen(false)
    setSelectedIndex(0)
    resetSearch()
    if (isMobile) {
      setIsExpanded(false)
      inputRef.current?.blur()
    } else {
      inputRef.current?.focus()
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        {/* Mobile mode: Icon that expands to full input */}
        {isMobile ? (
          !isExpanded ? (
            /* Collapsed state: Icon button right-aligned */
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 border border-gray-300 rounded-md bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                aria-label="Search for users"
                title="Search users"
              >
                <Search className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          ) : (
            /* Expanded state: Render via portal to escape navbar stacking context */
            portalContainerRef.current ? createPortal(
              <div className="sm:hidden" style={{ pointerEvents: 'auto' }}>
                <div
                  className="fixed top-[60px] left-4 right-4 mx-auto z-50"
                  role="search"
                  aria-label="Mobile user search"
                >
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="Search users..."
                      className={`block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-colors min-h-[44px] touch-manipulation shadow-xl ${getCompleteInputStyling().className}`}
                      style={{ ...getCompleteInputStyling().style, backgroundColor: 'white' }}
                      aria-label="Search for users"
                      aria-expanded={isDropdownOpen}
                      aria-haspopup="listbox"
                      aria-autocomplete="list"
                      role="combobox"
                      aria-controls="mobile-search-results"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("")
                        setIsExpanded(false)
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors min-w-[44px] min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
                      aria-label="Close search"
                      title="Close search"
                      {...createTouchHandlers(undefined, 'light')}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Search Results Dropdown - also portal-level */}
                  {isDropdownOpen && (
                    <UserSearchDropdown
                      id="mobile-search-results"
                      dropdownRef={dropdownRef}
                      className="mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto"
                      users={users}
                      loading={loading}
                      hasSearched={hasSearched}
                      searchQuery={searchQuery}
                      selectedIndex={selectedIndex}
                      onSelect={handleUserSelect}
                      onIndexChange={setSelectedIndex}
                      setItemRef={setItemRef}
                    />
                  )}
                </div>
              </div>,
              portalContainerRef.current
            ) : null
          )
        ) : (
          /* Desktop mode: Full search bar */
          <>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={placeholder}
              className={`block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-colors h-9 touch-manipulation ${getCompleteInputStyling().className}`}
              style={{ ...getCompleteInputStyling().style, backgroundColor: 'white' }}
              aria-label="Search for users"
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              role="combobox"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors min-w-[32px] min-h-[32px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
                aria-label="Clear search"
                title="Clear search"
                {...createTouchHandlers(undefined, 'light')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Search Results Dropdown - Desktop only (mobile handles its own in portal) */}
      {!isMobile && isDropdownOpen && (
        <UserSearchDropdown
          dropdownRef={dropdownRef}
          className="absolute top-full mt-1 w-full max-w-sm bg-white rounded-md shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto"
          users={users}
          loading={loading}
          hasSearched={hasSearched}
          searchQuery={searchQuery}
          selectedIndex={selectedIndex}
          onSelect={handleUserSelect}
          onIndexChange={setSelectedIndex}
          setItemRef={setItemRef}
        />
      )}
    </div>
  )
}
