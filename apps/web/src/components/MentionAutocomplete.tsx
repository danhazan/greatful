'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createTouchHandlers } from '@/utils/hapticFeedback'
import { getImageUrl } from '@/utils/imageUtils'
import ProfilePhotoDisplay from './ProfilePhotoDisplay'
// UserInfo type defined locally
interface UserInfo {
  id: number
  username: string
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

interface SearchResult {
  id: number
  username: string
  profile_image_url?: string
  bio?: string
}

export default function MentionAutocomplete({
  isOpen,
  searchQuery,
  onUserSelect,
  onClose,
  position,
  className = ''
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Debounced search function
  const debouncedSearch = useCallback(
    async (query: string) => {
      const cleanQuery = query.replace('@', '').trim()
      
      if (!cleanQuery || cleanQuery.length < 1) {
        setUsers([])
        setLoading(false)
        return
      }

      setLoading(true)
      
      try {
        const token = localStorage.getItem('access_token')
        if (!token) {
          console.error('No auth token found')
          setUsers([])
          setLoading(false)
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
    if (!isOpen) {
      setUsers([])
      setHasSearched(false)
      setLoading(false)
      return
    }

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const cleanQuery = searchQuery.replace('@', '').trim()
    
    if (!cleanQuery || cleanQuery.length < 1) {
      setUsers([])
      setLoading(false)
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
  }, [searchQuery, isOpen, debouncedSearch])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || users.length === 0) return

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
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, users, selectedIndex, onClose])

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

  const handleUserSelect = (user: SearchResult) => {
    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      profile_image_url: user.profile_image_url,
      bio: user.bio
    }
    onUserSelect(userInfo)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      ref={dropdownRef}
      data-mention-autocomplete
      role="listbox"
      aria-label="User search results"
      aria-live="polite"
      className={`absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs w-64 sm:w-80 max-h-60 sm:max-h-72 overflow-y-auto custom-scrollbar touch-manipulation ${className}`}
      style={{
        left: position.x,
        top: position.y,
        // Prevent zoom on iOS Safari
        touchAction: 'manipulation',
      }}
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
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className={`w-full px-3 py-3 sm:py-2 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none transition-colors min-h-[48px] touch-manipulation active:bg-purple-100 select-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${
                index === selectedIndex ? 'bg-purple-50' : ''
              }`}
              onClick={(e) => {
                e.preventDefault()
                handleUserSelect(user)
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              aria-label={`Select user ${user.username}${user.bio ? `. ${user.bio}` : ''}`}
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
                    @{user.username}
                  </div>
                  {user.bio && (
                    <div className="text-xs text-gray-500 truncate">
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
  )
}