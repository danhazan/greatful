import { useCallback, useEffect, useRef, useState } from 'react'
import { UserSearchResult } from '@/types/userSearch'

interface UseUserSearchOptions {
  query: string
  isOpen?: boolean
  limit?: number
  debounceMs?: number
  minQueryLength?: number
  normalizeQuery?: (query: string) => string
}

const identityQuery = (value: string) => value

function normalizeSearchResults(data: any): UserSearchResult[] {
  const rawResults = data?.success && Array.isArray(data.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : []

  return rawResults
    .filter((user: any) => user?.id && user?.username)
    .map((user: any) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.display_name || user.name || user.username,
      profileImageUrl: user.profileImageUrl || user.profile_image_url || user.image || null,
      bio: user.bio,
    }))
}

/**
 * Shared user-search state and fetching logic for all user-search dropdowns.
 * Keep debounce/loading semantics aligned with navbar search behavior.
 */
export function useUserSearch({
  query,
  isOpen = true,
  limit = 10,
  debounceMs = 300,
  minQueryLength = 1,
  normalizeQuery = identityQuery,
}: UseUserSearchOptions) {
  const [users, setUsers] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const resetSearch = useCallback(() => {
    setUsers([])
    setLoading(false)
    setHasSearched(false)
  }, [])

  const executeSearch = useCallback(async (cleanQuery: string) => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        console.error('No auth token found')
        setUsers([])
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
          limit,
        }),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()
      setUsers(normalizeSearchResults(data))
    } catch (error) {
      console.error('User search error:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!isOpen) {
      resetSearch()
      return
    }

    const cleanQuery = normalizeQuery(query).trim()

    if (!cleanQuery || cleanQuery.length < minQueryLength) {
      setUsers([])
      setLoading(false)
      setHasSearched(true)
      return
    }

    setLoading(true)
    setHasSearched(false)

    searchTimeoutRef.current = setTimeout(async () => {
      await executeSearch(cleanQuery)
      setHasSearched(true)
    }, debounceMs)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, isOpen, debounceMs, minQueryLength, normalizeQuery, executeSearch, resetSearch])

  return {
    users,
    loading,
    hasSearched,
    resetSearch,
  }
}
