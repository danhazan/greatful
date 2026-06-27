"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  FeedFilterMode,
  SearchFeedFilters,
} from "@/utils/feedFilterState"
import { UserSearchResult } from '@/types/userSearch'
import { hydrateUserIds } from '@/utils/userHydration'
import BaseFilterModal from "./BaseFilterModal"
import FilterModeButtons from "./FilterModeButtons"
import UserMultiSelect from "@/components/UserMultiSelect"

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
}: SearchFilterModalProps) {
  const [keywordText, setKeywordText] = useState(search.keyword.text)
  const [keywordMode, setKeywordMode] = useState<FeedFilterMode>(search.keyword.mode)
  const [authorMode, setAuthorMode] = useState<FeedFilterMode>(search.authors.mode)
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>(search.authors.users)
  const hasHydrated = useRef(false)
  const latestDraftRef = useRef({ authorMode, keywordMode, keywordText })

  useEffect(() => {
    latestDraftRef.current = { authorMode, keywordMode, keywordText }
  }, [authorMode, keywordMode, keywordText])

  useEffect(() => {
    const unresolvedIds = selectedUsers
      .filter(u => u.username === null)
      .map(u => u.id)
    if (unresolvedIds.length === 0 || hasHydrated.current) return
    hasHydrated.current = true
    const currentUsers = selectedUsers
    hydrateUserIds(unresolvedIds).then(hydrated => {
      const byId = new Map(hydrated.map(u => [u.id, u]))
      const next = currentUsers.map(u => (u.username === null && byId.has(u.id)) ? byId.get(u.id)! : u)
      setSelectedUsers(next)
      const { authorMode, keywordMode, keywordText } = latestDraftRef.current
      onChange({
        authors: { mode: authorMode, users: next },
        keyword: { mode: keywordMode, text: keywordText },
      })
    })
  }, [selectedUsers]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleUsersChange = useCallback((users: UserSearchResult[]) => {
    setSelectedUsers(users)
    onChange({
      authors: { mode: authorMode, users },
      keyword: { mode: keywordMode, text: keywordText },
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

  return (
    <BaseFilterModal
      title="Search in posts"
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
          <label className="block text-sm font-medium text-gray-700">Keywords</label>
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
            placeholder="Search keywords..."
            maxLength={200}
            disabled={keywordMode === 'off'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Authors</label>
          <FilterModeButtons
            selectedMode={authorMode}
            onChange={handleAuthorModeChange}
            size="sm"
          />

          <UserMultiSelect
            selectedUsers={selectedUsers}
            onChange={handleUsersChange}
            maxSelected={MAX_AUTHORS}
            disabled={authorMode === 'off'}
          />
        </div>
      </div>
    </BaseFilterModal>
  )
}
