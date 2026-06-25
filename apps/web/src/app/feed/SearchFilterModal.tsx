"use client"

import { useState, useCallback, useRef } from "react"
import {
  FeedFilterMode,
  SearchFeedFilters,
} from "@/utils/feedFilterState"
import { UserSearchResult } from '@/types/userSearch'
import BaseFilterModal from "./BaseFilterModal"
import FilterModeButtons from "./FilterModeButtons"

const MAX_AUTHORS = 50

interface SearchFilterModalProps {
  search: SearchFeedFilters
  onChange: (search: SearchFeedFilters) => void
  onClose: () => void
  onDismiss: () => void
  onClear: () => void
  onApply: () => void
  isApplyDisabled: boolean
  position: { x: number; y: number }
  authorProfiles: Record<number, { username: string; name: string }>
}

export default function SearchFilterModal({
  search,
  onChange,
  onClose,
  onDismiss,
  onClear,
  onApply,
  isApplyDisabled,
  position,
  authorProfiles,
}: SearchFilterModalProps) {
  const [keywordText, setKeywordText] = useState(search.keyword.text)
  const [keywordMode, setKeywordMode] = useState<FeedFilterMode>(search.keyword.mode)
  const [authorMode, setAuthorMode] = useState<FeedFilterMode>(search.authors.mode)
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>(search.authors.users)

  const handleKeywordModeChange = useCallback((mode: FeedFilterMode) => {
    setKeywordMode(mode)
    onChange({
      authors: { mode: authorMode, users: selectedUsers },
      keyword: { mode, text: keywordText },
    })
  }, [authorMode, selectedUsers, keywordText, onChange])

  const handleAuthorModeChange = useCallback((mode: FeedFilterMode) => {
    setAuthorMode(mode)
    onChange({
      authors: { mode, users: selectedUsers },
      keyword: { mode: keywordMode, text: keywordText },
    })
  }, [selectedUsers, keywordMode, keywordText, onChange])

  const addAuthor = useCallback((user: UserSearchResult) => {
    setSelectedUsers(prev => {
      if (prev.some(u => u.id === user.id)) return prev
      if (prev.length >= MAX_AUTHORS) return prev
      const next = [...prev, user]
      onChange({
        authors: { mode: authorMode, users: next },
        keyword: { mode: keywordMode, text: keywordText },
      })
      return next
    })
  }, [authorMode, keywordMode, keywordText, onChange])

  const removeAuthor = useCallback((userId: number) => {
    setSelectedUsers(prev => {
      const next = prev.filter(u => u.id !== userId)
      onChange({
        authors: { mode: authorMode, users: next },
        keyword: { mode: keywordMode, text: keywordText },
      })
      return next
    })
  }, [authorMode, keywordMode, keywordText, onChange])

  const handleApply = useCallback(() => {
    onApply()
  }, [onApply])

  const handleClear = useCallback(() => {
    setKeywordText('')
    setKeywordMode('off')
    setAuthorMode('off')
    setSelectedUsers([])
    onClear()
  }, [onClear])

  const isClearDisabled = keywordMode === 'off' && authorMode === 'off' && !keywordText.trim() && selectedUsers.length === 0
  const atLimit = selectedUsers.length >= MAX_AUTHORS

  return (
    <BaseFilterModal
      title="Search Filter"
      onClose={onClose}
      onDismiss={onDismiss}
      onClear={handleClear}
      onApply={handleApply}
      isClearDisabled={isClearDisabled}
      isApplyDisabled={isApplyDisabled}
      position={position}
    >
      <div className="p-4 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Keyword</label>
          <FilterModeButtons
            selectedMode={keywordMode}
            onChange={handleKeywordModeChange}
            size="sm"
          />
          <input
            type="text"
            value={keywordText}
            onChange={(e) => {
              const text = e.target.value
              setKeywordText(text)
              onChange({
                authors: { mode: authorMode, users: selectedUsers },
                keyword: { mode: keywordMode, text },
              })
            }}
            placeholder="Search posts..."
            maxLength={200}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Authors</label>
          <FilterModeButtons
            selectedMode={authorMode}
            onChange={handleAuthorModeChange}
            size="sm"
          />

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => {
                const profile = authorProfiles[user.id]
                const displayName = user.username || profile?.username || `User #${user.id}`
                return (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full"
                  >
                    {displayName}
                    <button
                      type="button"
                      onClick={() => removeAuthor(user.id)}
                      className="text-purple-500 hover:text-purple-700"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {atLimit && (
            <p className="text-xs text-amber-600">Maximum {MAX_AUTHORS} authors</p>
          )}

          <SimpleAuthorSearch onSelect={addAuthor} disabled={atLimit} />
        </div>
      </div>
    </BaseFilterModal>
  )
}

function SimpleAuthorSearch({
  onSelect,
  disabled,
}: {
  onSelect: (user: UserSearchResult) => void
  disabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { apiClient } = await import('@/utils/apiClient')
        const res = await apiClient.get(`/users/search?q=${encodeURIComponent(value.trim())}`) as any
        const users = res?.data || res || []
        setResults(Array.isArray(users) ? users.map((u: any) => ({ id: Number(u.id), username: u.username, name: u.displayName || u.name })) : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search users..."
        disabled={disabled}
        maxLength={100}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
      />
      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="animate-spin h-4 w-4 border-b-2 border-purple-600 rounded-full" />
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                onSelect(user)
                setQuery('')
                setResults([])
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 text-gray-700"
            >
              {user.username || `User #${user.id}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
