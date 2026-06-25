"use client"

import { useState, useCallback } from "react"
import { FeedFilterMode, DateFeedFilters } from "@/utils/feedFilterState"
import {
  DateFilterPreset,
  DATE_FILTER_PRESETS,
  getPresetDates,
} from "@/utils/dateFilterUtils"
import { FEED_CONFIG } from "@/config/feed"
import BaseFilterModal from "./BaseFilterModal"
import FilterModeButtons from "./FilterModeButtons"

export function sanitizeDateInput(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.replace(/[^\d-]/g, '')
  const parts = cleaned.split('-', 3)
  if (parts[0]) parts[0] = parts[0].slice(0, 4)
  if (parts[1]) parts[1] = parts[1].slice(0, 2)
  if (parts[2]) parts[2] = parts[2].slice(0, 2)
  let result = parts[0] || ''
  if (parts.length >= 2) {
    result += (parts[1] !== undefined ? '-' + parts[1] : '')
  }
  if (parts.length >= 3) {
    result += (parts[2] !== undefined ? '-' + parts[2] : '')
  }
  const trailingHyphen = raw.endsWith('-')
  if (trailingHyphen && result.length > 0 && !result.endsWith('-') && parts.length <= 2) {
    result += '-'
  }
  return result
}

interface DateFilterModalProps {
  date: DateFeedFilters
  onChange: (date: DateFeedFilters) => void
  onClose: () => void
  onDismiss: () => void
  onClear: () => void
  onApply: () => void
  isApplyDisabled: boolean
  position: { x: number; y: number }
}

export default function DateFilterModal({
  date,
  onChange,
  onClose,
  onDismiss,
  onClear,
  onApply,
  isApplyDisabled,
  position,
}: DateFilterModalProps) {
  const [selectedMode, setSelectedMode] = useState<FeedFilterMode>(date.mode)
  const [activePreset, setActivePreset] = useState<DateFilterPreset | null>(null)

  const [localStart, setLocalStart] = useState(date.localRange?.start ?? '')
  const [localEnd, setLocalEnd] = useState(date.localRange?.end ?? '')

  const handleModeChange = useCallback((mode: FeedFilterMode) => {
    setSelectedMode(mode)
    setActivePreset(null)
    if (mode === 'off') {
      onChange({ mode: 'off' })
      setLocalStart('')
      setLocalEnd('')
    } else {
      onChange({
        mode,
        localRange: { start: localStart || '', end: localEnd || '' },
      })
    }
  }, [localStart, localEnd, onChange])

  const handlePresetSelect = useCallback((preset: DateFilterPreset) => {
    const dates = getPresetDates(preset)
    if (!dates) return
    setActivePreset(preset)
    setLocalStart(dates.startLocal)
    setLocalEnd(dates.endLocal)
    const mode = selectedMode === 'off' ? 'boost' : selectedMode
    setSelectedMode(mode)
    onChange({
      mode,
      localRange: { start: dates.startLocal, end: dates.endLocal },
    })
  }, [selectedMode, onChange])

  const isClearDisabled = selectedMode === 'off'

  const handleClear = useCallback(() => {
    setSelectedMode('off')
    setActivePreset(null)
    setLocalStart('')
    setLocalEnd('')
    onClear()
  }, [onClear])

  const hasDates = Boolean(localStart && localEnd)
  const isStartAfterEnd = Boolean(localStart && localEnd && localStart > localEnd)
  const isBelowMinDate = Boolean(
    (localStart && localStart < FEED_CONFIG.MIN_DATE) ||
    (localEnd && localEnd < FEED_CONFIG.MIN_DATE)
  )
  const isApplyBtnDisabled =
    isApplyDisabled ||
    (selectedMode !== 'off' && (!hasDates || isStartAfterEnd || isBelowMinDate))

  return (
    <BaseFilterModal
      title="Date Filter"
      onClose={onClose}
      onDismiss={onDismiss}
      onClear={handleClear}
      onApply={onApply}
      isClearDisabled={isClearDisabled}
      isApplyDisabled={isApplyBtnDisabled}
      position={position}
    >
      <div className="p-4 space-y-4">
        <FilterModeButtons selectedMode={selectedMode} onChange={handleModeChange} />

        <div className="flex items-center justify-center gap-2">
          <input
            type="date"
            value={localStart}
            min={FEED_CONFIG.MIN_DATE}
            maxLength={10}
            onChange={(e) => {
              const sanitized = sanitizeDateInput(e.target.value)
              if (sanitized !== e.target.value) {
                e.target.value = sanitized
              }
              setLocalStart(sanitized)
              setActivePreset(null)
              if (selectedMode !== 'off') {
                onChange({
                  mode: selectedMode,
                  localRange: { start: sanitized, end: localEnd },
                })
              }
            }}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm w-auto focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={localEnd}
            min={FEED_CONFIG.MIN_DATE}
            maxLength={10}
            onChange={(e) => {
              const sanitized = sanitizeDateInput(e.target.value)
              if (sanitized !== e.target.value) {
                e.target.value = sanitized
              }
              setLocalEnd(sanitized)
              setActivePreset(null)
              if (selectedMode !== 'off') {
                onChange({
                  mode: selectedMode,
                  localRange: { start: localStart, end: sanitized },
                })
              }
            }}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm w-auto focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {selectedMode !== 'off' && (isStartAfterEnd || isBelowMinDate) && (
          <div className="text-xs text-red-500 text-center">
            {isStartAfterEnd && <p>Start date must be before end date</p>}
            {isBelowMinDate && <p>Date must be on or after {FEED_CONFIG.MIN_DATE}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {DATE_FILTER_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePresetSelect(preset.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePreset === preset.key
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </BaseFilterModal>
  )
}
