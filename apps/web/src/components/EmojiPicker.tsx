"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { getAvailableEmojis } from "@/utils/emojiMapping"
import { triggerHaptic } from "@/utils/hapticFeedback"
import { useModal } from "@/hooks/useModal"

interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onCancel: () => void
  onEmojiSelect: (emojiCode: string) => void
  currentReaction?: string | null
  position?: { x: number, y: number }
  isLoading?: boolean
  anchor?: 'bottom' | 'top'
}

// Get emoji options from utility - now includes 56 emojis across 7 rows
const EMOJI_OPTIONS = getAvailableEmojis()

export default function EmojiPicker({
  isOpen,
  onClose,
  onCancel,
  onEmojiSelect,
  currentReaction,
  position = { x: 0, y: 0 },
  isLoading = false,
  anchor = 'bottom'
}: EmojiPickerProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)

  // Mobile Edge Case: Disambiguate tap vs scroll to prevent rogue clicks.
  // We use `onClick` as the primary, safe trigger for selection and haptics,
  // but some rogue browsers fire `click` immediately after `touchMove`.
  // We track touch explicitly on the container to safely drop these rogue clicks
  // without re-introducing complex custom touch handlers everywhere.
  const isScrollingRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0 })

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
    isScrollingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x)
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y)
    if (dx > 10 || dy > 10) {
      isScrollingRef.current = true
    }
  }

  // Reset selected emoji when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedEmoji(null)
    }
  }, [isOpen])

  useModal(modalRef, isOpen, onCancel, { enableTabTrap: true })

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  // Handle emoji selection - immediately sends reaction and closes
  const handleEmojiClick = (emojiCode: string) => {
    if (isLoading) return

    // If clicking on the same emoji that's currently selected, just cancel
    if (currentReaction === emojiCode) {
      onCancel()
      return
    }

    // Select the emoji, send to backend, and close
    triggerHaptic('light')
    setSelectedEmoji(emojiCode)
    onEmojiSelect(emojiCode)
    onClose()
  }

  // Handle X button click - cancel without sending reaction
  const handleXButtonClick = () => {
    onCancel()
  }

  return createPortal(
    <>
      {/* Backdrop - blocks interaction with background */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-20 z-[80]"
        data-emoji-picker
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        data-emoji-picker
        role="dialog"
        aria-modal="true"
        aria-labelledby="emoji-picker-title"
        className="fixed z-[81] bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-[320px] max-w-[calc(100vw-32px)]"
        style={{
          left: position.x,
          ...(anchor === 'top'
            ? { top: position.y }
            : { bottom: window.innerHeight - position.y }),
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 id="emoji-picker-title" className="text-sm font-semibold text-gray-900">
            {currentReaction ? 'Change reaction' : 'React with'}
          </h3>
          <button
            onClick={handleXButtonClick}
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md p-1"
            aria-label="Cancel and close emoji picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Emoji Grid Container */}
        <div
          ref={scrollContainerRef}
          data-allow-scroll="true"
          className="max-h-[280px] overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{
            // Prevent scroll events from propagating to parent
            overscrollBehavior: 'contain',
            // Custom scrollbar styling
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db transparent'
          }}
        >
          <div
            className="grid grid-cols-4 gap-2 sm:gap-3 pr-1"
            role="grid"
            aria-label="Emoji reactions"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            {EMOJI_OPTIONS.map((option) => (
              <div key={option.code} role="gridcell">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (isScrollingRef.current) {
                      isScrollingRef.current = false
                      return
                    }
                    handleEmojiClick(option.code)
                  }}
                  disabled={isLoading}
                  className={`
                    relative p-3 sm:p-4 rounded-lg transition-all duration-200 hover:scale-110 hover:bg-purple-50
                    min-h-[44px] min-w-[44px] flex items-center justify-center
                    touch-manipulation select-none
                    active:scale-95 active:bg-purple-100
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                    ${currentReaction === option.code
                      ? 'bg-purple-100 ring-2 ring-purple-500 ring-offset-1'
                      : 'hover:bg-gray-50 active:bg-purple-50'
                    }
                    ${selectedEmoji === option.code ? 'bg-purple-200' : ''}
                  `}
                  title={option.label}
                  aria-label={`React with ${option.label}.${currentReaction === option.code ? ' Currently selected.' : ''}`}
                  aria-pressed={currentReaction === option.code}
                >
                  <span className="text-2xl sm:text-3xl block pointer-events-none">{option.emoji}</span>
                  {currentReaction === option.code && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer removed - keyboard shortcuts (1-8) and caption removed as redundant */}
      </div>
    </>,
    document.body
  )
}
