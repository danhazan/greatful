"use client"

import { useEffect, useRef, useState } from "react"

interface MinimalEmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onEmojiSelect: (emoji: string) => void
  position?: { x: number, y: number }
}

// Minimal emoji groups similar to Facebook's picker
const EMOJI_GROUPS = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔']
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '💍', '💎']
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏']
  },
  {
    name: 'Nature',
    emojis: ['🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌿', '🍀', '🌱', '🌳', '🌲', '🌴', '🌵', '🌾', '🌈', '☀️', '🌙', '⭐', '🌟', '💫', '✨', '🔥', '💧', '🌊']
  },
  {
    name: 'Celebration',
    emojis: ['🎉', '🎊', '🥳', '🎈', '🎁', '🎀', '🎂', '🍰', '🧁', '🥂', '🍾', '🎆', '🎇', '🎪', '🎭', '🎨', '🎵', '🎶', '🎼', '🏆', '🥇', '🎯', '🎲', '🎮']
  }
]

// Get recently used emojis from localStorage
const getRecentlyUsedEmojis = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const recent = localStorage.getItem('grateful_recent_emojis')
    return recent ? JSON.parse(recent) : []
  } catch {
    return []
  }
}

// Save emoji to recently used
const saveRecentlyUsedEmoji = (emoji: string) => {
  if (typeof window === 'undefined') return
  try {
    const recent = getRecentlyUsedEmojis()
    const filtered = recent.filter(e => e !== emoji)
    const updated = [emoji, ...filtered].slice(0, 16) // Keep max 16 recent emojis
    localStorage.setItem('grateful_recent_emojis', JSON.stringify(updated))
  } catch {
    // Ignore localStorage errors
  }
}

export default function MinimalEmojiPicker({
  isOpen,
  onClose,
  onEmojiSelect,
  position = { x: 0, y: 0 }
}: MinimalEmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [recentEmojis, setRecentEmojis] = useState<string[]>([])

  // Load recently used emojis when component mounts
  useEffect(() => {
    if (isOpen) {
      setRecentEmojis(getRecentlyUsedEmojis())
    }
  }, [isOpen])

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    saveRecentlyUsedEmoji(emoji)
    setRecentEmojis(getRecentlyUsedEmojis()) // Update recent emojis immediately
    onEmojiSelect(emoji)
  }

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50" onClick={onClose} />
      
      {/* Emoji Picker - positioned above emoji button, half height */}
      <div
        ref={pickerRef}
        className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: Math.max(16, position.y - 154), // Position above the button (increased for taller picker)
          width: 'min(calc(100vw - 32px), 672px)', // Same as max-w-2xl (672px) with 16px padding on each side
          maxHeight: '141px', // 10% increase from 128px (max-h-32)
        }}
      >
        {/* Scrollable content */}
        <div className="overflow-y-auto p-2" style={{ maxHeight: '141px' }}>
          {/* Recently Used Section */}
          {recentEmojis.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-600 mb-1 px-1 select-none">
                Recently Used
              </div>
              <div className="grid grid-cols-8 gap-1">
                {recentEmojis.slice(0, 16).map((emoji, index) => (
                  <button
                    key={`recent-${emoji}-${index}`}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleEmojiSelect(emoji)
                    }}
                    className="w-6 h-6 rounded hover:bg-gray-100 transition-colors text-sm flex items-center justify-center hover:scale-110"
                    title={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji Groups */}
          {EMOJI_GROUPS.map((group) => (
            <div key={group.name} className="mb-2">
              <div className="text-xs font-medium text-gray-600 mb-1 px-1 select-none">
                {group.name}
              </div>
              <div className="grid grid-cols-8 gap-1">
                {group.emojis.slice(0, 16).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleEmojiSelect(emoji)
                    }}
                    className="w-6 h-6 rounded hover:bg-gray-100 transition-colors text-sm flex items-center justify-center hover:scale-110"
                    title={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}