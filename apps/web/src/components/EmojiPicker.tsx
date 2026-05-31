"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
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
  triggerRef: React.RefObject<HTMLElement>
  isLoading?: boolean
  compact?: boolean
}

const EMOJI_OPTIONS = getAvailableEmojis()

export default function EmojiPicker({
  isOpen,
  onClose,
  onCancel,
  onEmojiSelect,
  currentReaction,
  triggerRef,
  isLoading = false,
  compact = false
}: EmojiPickerProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const hasPositionedRef = useRef(false)

  const density = compact
    ? {
        cellPadding: 'p-2',
        gap: 'gap-1',
        modalPadding: 'p-2',
        scrollMaxHeight: '180px',
        emojiFontSize: 'text-xl',
      }
    : {
        cellPadding: 'p-3',
        gap: 'gap-2',
        modalPadding: 'p-4',
        scrollMaxHeight: '280px',
        emojiFontSize: 'text-2xl',
      }

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

  useEffect(() => {
    if (isOpen) {
      setSelectedEmoji(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      hasPositionedRef.current = false
    }
  }, [isOpen])

  // Self-position: measure trigger + own DOM, compute position, reveal
  useLayoutEffect(() => {
    if (!isOpen) return
    if (hasPositionedRef.current) return
    if (!triggerRef.current || !modalRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const modalRect = modalRef.current.getBoundingClientRect()

    const MARGIN = 16
    const GAP = 8

    const triggerCenter = triggerRect.left + triggerRect.width / 2
    const left = Math.max(
      MARGIN,
      Math.min(triggerCenter - modalRect.width / 2, window.innerWidth - modalRect.width - MARGIN)
    )

    const spaceBelow = window.innerHeight - triggerRect.bottom - GAP
    const spaceAbove = triggerRect.top - GAP
    let top: number
    if (spaceBelow >= modalRect.height + MARGIN) {
      top = triggerRect.bottom + GAP
    } else if (spaceAbove >= modalRect.height + MARGIN) {
      top = triggerRect.top - modalRect.height - GAP
    } else {
      top = Math.max(
        MARGIN,
        Math.min(triggerRect.bottom + GAP, window.innerHeight - modalRect.height - MARGIN)
      )
    }

    setPosition({ left, top })
    setVisible(true)
    hasPositionedRef.current = true
  }, [isOpen, triggerRef])

  useModal(modalRef, isOpen, onCancel, { enableTabTrap: true })

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const handleEmojiClick = (emojiCode: string) => {
    if (isLoading) return
    if (currentReaction === emojiCode) {
      onCancel()
      return
    }
    triggerHaptic('light')
    setSelectedEmoji(emojiCode)
    onEmojiSelect(emojiCode)
    onClose()
  }

  const handleXButtonClick = () => {
    onCancel()
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-20 z-[80]"
        data-emoji-picker
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      />

      <div
        ref={modalRef}
        data-emoji-picker
        role="dialog"
        aria-modal="true"
        aria-label="Emoji picker"
        className="fixed z-[81] bg-white rounded-lg shadow-lg border border-gray-200"
        style={{
          left: position.left,
          top: position.top,
          visibility: visible ? 'visible' : 'hidden',
          pointerEvents: visible ? 'auto' : 'none',
          padding: compact ? '8px' : '16px',
        }}
        tabIndex={-1}
      >
        <div className="flex justify-end mb-0">
          <button
            onClick={handleXButtonClick}
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md p-1"
            aria-label="Cancel and close emoji picker"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div
          ref={scrollContainerRef}
          data-allow-scroll="true"
          className="overflow-y-auto overflow-x-hidden overscroll-contain p-2"
          style={{
            maxHeight: density.scrollMaxHeight,
            overscrollBehavior: 'contain',
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db transparent'
          }}
        >
          <div
            className={`grid grid-cols-4 ${density.gap}`}
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
                    relative ${density.cellPadding} rounded-lg transition-all duration-200 hover:scale-110 hover:bg-purple-50
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
                  <span className={`block pointer-events-none ${density.emojiFontSize}`}>{option.emoji}</span>
                  {currentReaction === option.code && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
