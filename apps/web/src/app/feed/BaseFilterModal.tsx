"use client"

import { useRef, useEffect, type ReactNode } from "react"

interface BaseFilterModalProps {
  title: string
  onClose: () => void
  onDismiss: () => void
  onClear: () => void
  onApply: () => void
  isClearDisabled: boolean
  isApplyDisabled: boolean
  position: { x: number; y: number }
  children: ReactNode
}

export default function BaseFilterModal({
  title,
  onClose,
  onDismiss,
  onClear,
  onApply,
  isClearDisabled,
  isApplyDisabled,
  position,
  children,
}: BaseFilterModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onDismiss])

  return (
    <div
      ref={modalRef}
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[calc(100vw-1.5rem)] sm:max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              disabled={isClearDisabled}
              className={`text-sm px-2 py-1 rounded transition-colors ${
                isClearDisabled
                  ? 'text-gray-400 cursor-default'
                  : 'text-purple-600 hover:text-purple-800 hover:bg-purple-50'
              }`}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={isApplyDisabled}
              className="text-sm font-bold px-2 py-1 rounded transition-colors bg-transparent disabled:text-gray-400 disabled:cursor-default text-purple-600 hover:text-purple-800 hover:bg-purple-50"
            >
              Apply
            </button>
          </div>
        </div>

        {children}

        <div className="flex items-center justify-end p-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onApply}
            disabled={isApplyDisabled}
            className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
