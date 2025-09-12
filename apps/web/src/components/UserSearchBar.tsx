'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { createTouchHandlers } from '@/utils/hapticFeedback'
import ProfilePhotoDisplay from './ProfilePhotoDisplay'

interface UserSearchResult {
  id: number
  username: string
  display_name?: string
  profile_image_url?: string
  bio?: string
}

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
  const [users, setUsers] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Debounced search function
  const debouncedSearch = useCallback(
    async (query: string) => {
      const cleanQuery = query.trim()
      
      if (!cleanQuery || cleanQuery.length < 1) {
        setUsers([])
        setLoading(false)
        setIsDropdownOpen(false)
        return
      }

      setLoading(true)
      setIsDropdownOpen(true)
      
      try {
        const token = localStorage.getItem('access_token')
        if (!token) {
          console.error('No auth token found')
          setUsers([])
          setLoading(false)
          setIsDropdownOpen(false)
          return
        }

        const response = await fetch('/api/users/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: cleanQuery,
            limit: 10
          }),
        })

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.success && Array.isArray(data.data)) {
          setUsers(data.data)
          setSelectedIndex(0) // Reset selection to first item
        } else if (Array.isArray(data)) {
          // Handle direct array response
          setUsers(data)
          setSelectedIndex(0)
        } else {
          setUsers([])
        }
      } catch (error) {
        console.error('User search error:', error)
        setUsers([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Effect to handle debounced search
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const cleanQuery = searchQuery.trim()
    
    if (!cleanQuery || cleanQuery.length < 1) {
      setUsers([])
      setLoading(false)
      setIsDropdownOpen(false)
      setHasSearched(true)
      return
    }

    setLoading(true)
    setHasSearched(false)

    // Set new timeout for debounced search (300ms)
    searchTimeoutRef.current = setTimeout(async () => {
      await debouncedSearch(searchQuery)
      setHasSearched(true)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, debouncedSearch])

  const handleUserSelect = useCallback((user: UserSearchResult) => {
    // Navigate to user profile
    router.push(`/profile/${user.id}`)
    setIsDropdownOpen(false)
    setSearchQuery('')
    setUsers([])
    setSelectedIndex(0)
    setHasSearched(false)
    resultRefs.current = []
    inputRef.current?.blur()
  }, [router])

  const handleClose = useCallback(() => {
    setIsDropdownOpen(false)
    setSearchQuery('')
    setUsers([])
    setSelectedIndex(0)
    setHasSearched(false)
    resultRefs.current = []
    inputRef.current?.blur()
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isDropdownOpen || users.length === 0) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex(prev => (prev + 1) % users.length)
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex(prev => (prev - 1 + users.length) % users.length)
          break
        case 'Enter':
          event.preventDefault()
          if (users[selectedIndex]) {
            handleUserSelect(users[selectedIndex])
          }
          break
        case 'Escape':
          event.preventDefault()
          handleClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDropdownOpen, users, selectedIndex, handleUserSelect, handleClose])

  // Scroll selected item into view when selectedIndex changes
  useEffect(() => {
    if (selectedIndex >= 0 && resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

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
    setIsFocused(true)
    if (searchQuery.trim()) {
      setIsDropdownOpen(true)
    }
  }

  const handleInputBlur = () => {
    setIsFocused(false)
    // Don't close dropdown immediately to allow for clicks
    // In tests, the :hover pseudo-class doesn't work, so we need a longer delay
    setTimeout(() => {
      if (!dropdownRef.current?.matches(':hover')) {
        // Only close if not interacting with dropdown
        setIsDropdownOpen(false)
      }
    }, 300)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setUsers([])
    setIsDropdownOpen(false)
    setSelectedIndex(0)
    setHasSearched(false)
    resultRefs.current = []
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        {/* Mobile compact mode: Icon only */}
        {isMobile && !placeholder ? (
          <div className="flex items-center justify-center w-11 h-11 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors touch-manipulation">
            <button
              type="button"
              onClick={() => {
                inputRef.current?.focus()
                setIsDropdownOpen(true)
              }}
              className="w-full h-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
              aria-label="Search for users"
            >
              <Search className="h-5 w-5 text-gray-400" />
            </button>
            {/* Hidden input for functionality */}
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="absolute opacity-0 pointer-events-none"
              aria-label="Search for users"
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              role="combobox"
            />
          </div>
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
              className={`
                block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md 
                leading-5 bg-white placeholder-gray-500 
                focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                text-sm transition-colors
                ${isMobile ? 'min-h-[44px]' : 'h-9'}
                touch-manipulation
              `}
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
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
                {...createTouchHandlers(undefined, 'light')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className={`z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto ${
            isMobile && !placeholder 
              ? 'fixed top-16 left-1/2 transform -translate-x-1/2 w-64' // Mobile: screen-centered
              : 'absolute w-full left-0' // Desktop: full width, left-aligned
          }`}
          role="listbox"
          aria-label="User search results"
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
                <button
                  key={user.id}
                  ref={(el) => {
                    resultRefs.current[index] = el
                  }}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={`w-full px-3 py-3 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none transition-colors min-h-[48px] touch-manipulation active:bg-purple-100 select-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${
                    index === selectedIndex ? 'bg-purple-50' : ''
                  }`}
                  onMouseDown={(e) => {
                    // Prevent blur from firing when clicking on result
                    e.preventDefault()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    handleUserSelect(user)
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  aria-label={`Go to ${user.display_name || user.username}'s profile${user.bio ? `. ${user.bio}` : ''}`}
                  {...createTouchHandlers(undefined, 'light')}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <ProfilePhotoDisplay
                        photoUrl={user.profile_image_url}
                        username={user.username}
                        size="sm"
                        className="border-0 shadow-none"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user.display_name || user.username}
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
              ))}
            </div>
          )}

          {!loading && hasSearched && !searchQuery && (
            <div className="p-3 text-center text-gray-500 text-sm" role="status">
              Type to search for users...
            </div>
          )}
        </div>
      )}
    </div>
  )
}