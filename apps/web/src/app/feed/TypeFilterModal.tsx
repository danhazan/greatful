"use client"

import { useCallback } from "react"
import {
  FeedFilterMode,
  TypeFilterKey,
  TYPE_FILTERS,
  TypeFilterOption,
} from "@/utils/feedFilterState"
import { User, Heart, Users, Globe, Image } from "lucide-react"
import BaseFilterModal from "./BaseFilterModal"
import FilterModeButtons from "./FilterModeButtons"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  Heart,
  Users,
  Globe,
  Image,
}

interface TypeFilterModalProps {
  type: Record<TypeFilterKey, FeedFilterMode>
  onChange: (type: Record<TypeFilterKey, FeedFilterMode>) => void
  onClose: () => void
  onDismiss: () => void
  onClear: () => void
  onApply: () => void
  isApplyDisabled: boolean
  position: { x: number; y: number }
}

export default function TypeFilterModal({
  type,
  onChange,
  onClose,
  onDismiss,
  onClear,
  onApply,
  isApplyDisabled,
  position,
}: TypeFilterModalProps) {
  const isClearDisabled = Object.values(type).every(m => m === 'off')

  const setMode = useCallback((key: TypeFilterKey, mode: FeedFilterMode) => {
    const next = { ...type, [key]: mode }
    onChange(next)
  }, [type, onChange])

  return (
    <BaseFilterModal
      title="Type Filter"
      onClose={onClose}
      onDismiss={onDismiss}
      onClear={onClear}
      onApply={onApply}
      isClearDisabled={isClearDisabled}
      isApplyDisabled={isApplyDisabled}
      position={position}
    >
      <div className="p-4 space-y-3">
        {TYPE_FILTERS.map((item: TypeFilterOption) => {
          const mode = type[item.key]
          const IconComponent = ICON_MAP[item.icon]
          return (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                {IconComponent && <IconComponent className="h-4 w-4 text-gray-500" />}
                <span className="text-sm font-medium text-gray-900">{item.label}</span>
              </div>
              <FilterModeButtons
                selectedMode={mode}
                onChange={(m) => setMode(item.key, m)}
                size="sm"
                compact
              />
            </div>
          )
        })}
      </div>
    </BaseFilterModal>
  )
}
