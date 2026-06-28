"use client"

import { useState, useCallback } from "react"
import { FeedFilterMode, DateFeedFilters } from "@/utils/feedFilterState"
import {
  DateFilterPreset,
  DATE_FILTER_PRESETS,
  getPresetDates,
} from "@/utils/dateFilterUtils"
import { FEED_CONFIG } from "@/config/feed"
import { useLocale } from "@/hooks/useLocale"
import { getPresetLabel, getValidationMessage, formatISODateNumeric } from "@/utils/dateFilterLocale"
import BaseFilterModal from "./BaseFilterModal"
import FilterModeButtons from "./FilterModeButtons"
import LocaleDateInput from "./LocaleDateInput"



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
  const locale = useLocale()
  const [selectedMode, setSelectedMode] = useState<FeedFilterMode>(date.mode)
  const [activePreset, setActivePreset] = useState<DateFilterPreset | null>(date.preset ?? null)

  const [localStart, setLocalStart] = useState(date.localRange?.start ?? '')
  const [localEnd, setLocalEnd] = useState(date.localRange?.end ?? '')

  const handleModeChange = useCallback((mode: FeedFilterMode) => {
    setSelectedMode(mode)
    if (mode === 'off') {
      setActivePreset(null)
      onChange({ mode: 'off' })
      setLocalStart('')
      setLocalEnd('')
    } else {
      onChange({
        mode,
        localRange: { start: localStart || '', end: localEnd || '' },
        preset: activePreset ?? undefined,
      })
    }
  }, [localStart, localEnd, activePreset, onChange])

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
      preset,
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

  const today = new Date().toISOString().split('T')[0]
  const hasDates = Boolean(localStart && localEnd)
  const isStartAfterEnd = Boolean(localStart && localEnd && localStart > localEnd)
  const isBelowMinDate = Boolean(
    (localStart && localStart < FEED_CONFIG.MIN_DATE) ||
    (localEnd && localEnd < FEED_CONFIG.MIN_DATE)
  )
  const isAfterToday = Boolean(localEnd && localEnd > today)
  const isApplyBtnDisabled =
    isApplyDisabled ||
    (selectedMode !== 'off' && (!hasDates || isStartAfterEnd || isBelowMinDate || isAfterToday))

  return (
    <BaseFilterModal
      title="Filter by date"
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
          <LocaleDateInput
            value={localStart}
            min={FEED_CONFIG.MIN_DATE}
            max={today}
            onChange={(iso) => {
              setLocalStart(iso)
              setActivePreset(null)
              if (selectedMode !== 'off') {
                onChange({
                  mode: selectedMode,
                  localRange: { start: iso, end: localEnd },
                })
              }
            }}
          />
          <span className="text-gray-400 text-sm">—</span>
          <LocaleDateInput
            value={localEnd}
            min={FEED_CONFIG.MIN_DATE}
            max={today}
            onChange={(iso) => {
              setLocalEnd(iso)
              setActivePreset(null)
              if (selectedMode !== 'off') {
                onChange({
                  mode: selectedMode,
                  localRange: { start: localStart, end: iso },
                })
              }
            }}
          />
        </div>

        {selectedMode !== 'off' && (isStartAfterEnd || isBelowMinDate || isAfterToday) && (
          <div className="text-xs text-red-500 text-center">
            {isStartAfterEnd && <p>{getValidationMessage('start_after_end', locale)}</p>}
            {isBelowMinDate && <p>{getValidationMessage('below_min_date', locale, { minDate: formatISODateNumeric(FEED_CONFIG.MIN_DATE, locale) })}</p>}
            {isAfterToday && <p>{getValidationMessage('future_date', locale)}</p>}
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
              {getPresetLabel(preset.key, locale)}
            </button>
          ))}
        </div>
      </div>
    </BaseFilterModal>
  )
}
