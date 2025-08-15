"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { getAvailableEmojis } from "@/utils/emojiMapping"

interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onEmojiSelect: (emojiCode: string) => void
  currentReaction?: string
  position?: { x: number, y: number }
}

// Get emoji options from utility
const EMOJI_OPTIONS = getAvailableEmojis()

export default function EmojiPicker({ 
  isOpen, 
  onClose, 
  onEmojiSelect, 
  currentReaction,
  position = { x: 0, y: 0 }
}: EmojiPickerProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
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
      <div className="fixed inset-0 bg-black bg-opacity-25 z-40" />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[280px]"
        style={{
          left: Math.max(16, Math.min(position.x - 140, window.innerWidth - 296)),
          top: Math.max(16, position.y - 160),
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">React with</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close emoji picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Emoji Grid */}
        <div className="grid grid-cols-4 gap-2">
          {EMOJI_OPTIONS.map((option, index) => (
            <button
              key={option.code}
              onClick={() => onEmojiSelect(option.code)}
              className={`
                relative p-3 rounded-lg transition-all duration-200 hover:scale-110 hover:bg-purple-50
                ${currentReaction === option.code 
                  ? 'bg-purple-100 ring-2 ring-purple-500 ring-offset-1' 
                  : 'hover:bg-gray-50'
                }
              `}
              title={`${option.label} (${index + 1})`}
              aria-label={`React with ${option.label}`}
            >
              <span className="text-2xl block">{option.emoji}</span>
              {currentReaction === option.code && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Use number keys 1-8 or click to react
          </p>
        </div>
      </div>
    </>
  )
}