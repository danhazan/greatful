"use client"

import { useCallback } from "react"
import {
  FeedFilterMode,
  TypeFilterKey,
  TYPE_FILTERS,
  TYPE_FILTER_OR_KEYS,
  TYPE_FILTER_AND_KEYS,
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

function FilterItem({ item, mode, onModeChange }: {
  item: TypeFilterOption
  mode: FeedFilterMode
  onModeChange: (key: TypeFilterKey, mode: FeedFilterMode) => void
}) {
  const IconComponent = ICON_MAP[item.icon]
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2">
        {IconComponent && <IconComponent className="h-4 w-4 text-gray-500" />}
        <span className="text-sm font-medium text-gray-900">{item.label}</span>
      </div>
      <FilterModeButtons
        selectedMode={mode}
        onChange={(m) => onModeChange(item.key, m)}
        size="sm"
        compact
      />
    </div>
  )
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

  const orItems = TYPE_FILTERS.filter(item => TYPE_FILTER_OR_KEYS.includes(item.key))
  const andItems = TYPE_FILTERS.filter(item => TYPE_FILTER_AND_KEYS.includes(item.key))

  return (
    <BaseFilterModal
      title="Posts type"
      onClose={onClose}
      onDismiss={onDismiss}
      onClear={onClear}
      onApply={onApply}
      isClearDisabled={isClearDisabled}
      isApplyDisabled={isApplyDisabled}
      position={position}
    >
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Match ANY of</p>
          <div className="space-y-2">
            {orItems.map((item) => (
              <FilterItem key={item.key} item={item} mode={type[item.key]} onModeChange={setMode} />
            ))}
          </div>
        </div>

        <hr className="border-gray-200" />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Always require</p>
          <div className="space-y-2">
            {andItems.map((item) => (
              <FilterItem key={item.key} item={item} mode={type[item.key]} onModeChange={setMode} />
            ))}
          </div>
        </div>
      </div>
    </BaseFilterModal>
  )
}
