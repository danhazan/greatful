"use client"

import { FeedFilterMode } from "@/utils/feedFilterState"

interface FilterModeButtonsProps {
  selectedMode: FeedFilterMode
  onChange: (mode: FeedFilterMode) => void
  size?: 'sm' | 'md'
  compact?: boolean
}

export default function FilterModeButtons({
  selectedMode,
  onChange,
  size = 'md',
  compact = false,
}: FilterModeButtonsProps) {
  const cls = compact
    ? 'px-3 py-1.5 text-xs font-medium rounded-md'
    : size === 'sm'
    ? 'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium'
    : 'flex-1 rounded-lg px-3 py-2 text-sm font-medium'

  return (
    <div className="flex gap-2">
      {(['off', 'boost', 'required'] as FeedFilterMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`${cls} transition-colors ${
            selectedMode === mode
              ? mode === 'required'
                ? 'bg-purple-600 text-white'
                : mode === 'boost'
                ? 'bg-purple-200 text-purple-800'
                : 'bg-gray-200 text-gray-800'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {mode === 'off' ? 'Off' : mode === 'boost' ? 'Mostly' : 'Only'}
        </button>
      ))}
    </div>
  )
}
