"use client"

import { useEffect, useRef, useState } from "react"
import { X, Loader2 } from "lucide-react"
import { getAvailableEmojis } from "@/utils/emojiMapping"
import { createTouchHandlers } from "@/utils/hapticFeedback"
import { useToast } from "@/contexts/ToastContext"

interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onEmojiSelect: (emojiCode: string) => void
  currentReaction?: string
  position?: { x: number, y: number }
  isLoading?: boolean
}

// Get emoji options from utility
const EMOJI_OPTIONS = getAvailableEmojis()

export default function EmojiPicker({ 
  isOpen, 
  onClose, 
  onEmojiSelect, 
  currentReaction,
  position = { x: 0, y: 0 },
  isLoading = false
}: EmojiPickerProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const { showError } = useToast()

  // Reset selected emoji when modal opens/closes and pre-select purple heart if it's the current reaction
  useEffect(() => {
    if (isOpen) {
      setSelectedEmoji(null)
      // Purple heart (first option) is pre-selected when opened from heart click
      // It will be highlighted by the currentReaction prop if user already has heart reaction
    }
  }, [isOpen])

  // Handle click outside and scroll to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleScroll = () => {
      onClose()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('scroll', handleScroll, true) // Use capture to catch all scroll events
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isOpen, onClose])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key >= '1' && event.key <= '8') {
        event.preventDefault()
        const index = parseInt(event.key) - 1
        if (EMOJI_OPTIONS[index]) {
          onEmojiSelect(EMOJI_OPTIONS[index].code)
        }
      } else if (event.key === 'Tab') {
        // Allow tab navigation within modal
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
          
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    if (isOpen) {
      // Focus the modal when it opens
      if (modalRef.current) {
        modalRef.current.focus()
      }
      document.addEventListener('keydown', handleKeyDown, true)
      return () => document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClose, onEmojiSelect])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900 bg-opacity-20 z-40" />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emoji-picker-title"
        aria-describedby="emoji-picker-description"
        className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[280px] sm:min-w-[320px]"
        style={{
          left: Math.max(16, Math.min(position.x - 140, window.innerWidth - 296)),
          bottom: Math.max(16, window.innerHeight - position.y + 24), // Position above button with proper spacing to avoid covering
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 id="emoji-picker-title" className="text-sm font-semibold text-gray-900">
            {currentReaction ? 'Change reaction' : 'React with'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md p-1"
            aria-label="Close emoji picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Emoji Grid */}
        <div 
          className="grid grid-cols-4 gap-2 sm:gap-3"
          role="grid"
          aria-label="Emoji reactions"
        >
          {EMOJI_OPTIONS.map((option, index) => (
            <button
              key={option.code}
              onClick={(e) => {
                // Prevent double-tap zoom on mobile
                e.preventDefault()
                if (isLoading) return
                
                // If clicking on the same emoji that's currently selected, close the modal
                if (currentReaction === option.code) {
                  onClose()
                  return
                }
                
                // If clicking on a different emoji while one is already selected, allow the change
                // Reset any previous selection first
                setSelectedEmoji(null)
                // Set new selection after a brief delay to show the change
                setTimeout(() => {
                  setSelectedEmoji(option.code)
                  onEmojiSelect(option.code)
                }, 50)
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
              title={`${option.label} (${index + 1})`}
              aria-label={`React with ${option.label}. Press ${index + 1} key as shortcut.${currentReaction === option.code ? ' Currently selected.' : ''}`}
              aria-pressed={currentReaction === option.code}
              role="gridcell"
              {...createTouchHandlers(undefined, 'medium')}
            >
              <span className="text-2xl sm:text-3xl block pointer-events-none">{option.emoji}</span>
              {currentReaction === option.code && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p id="emoji-picker-description" className="text-xs text-gray-500 text-center">
            Use number keys 1-8 or click to react. Press Escape to close.
          </p>
        </div>
      </div>
    </>
  )
}