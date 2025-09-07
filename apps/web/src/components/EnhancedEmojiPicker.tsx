"use client"

import { useState } from "react"
import { Search, Heart, Smile, Sun, Star, Sparkles } from "lucide-react"

interface EnhancedEmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onEmojiSelect: (emoji: string) => void
  position: { x: number, y: number }
  className?: string
}

// Comprehensive emoji categories for gratitude posts
const EMOJI_CATEGORIES = {
  gratitude: {
    name: 'Gratitude',
    icon: Heart,
    emojis: ['🙏', '💜', '❤️', '💖', '💕', '💗', '💓', '💝', '🤍', '🧡', '💛', '💚', '💙', '🤎', '🖤', '♥️', '💘', '💌']
  },
  happiness: {
    name: 'Happiness',
    icon: Smile,
    emojis: ['😊', '😄', '😃', '😀', '😁', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪']
  },
  celebration: {
    name: 'Celebration',
    icon: Sparkles,
    emojis: ['🎉', '🎊', '🥳', '🎈', '🎁', '🎀', '🎂', '🍰', '🧁', '🥂', '🍾', '🎆', '🎇', '✨', '🌟', '⭐', '💫', '🔥']
  },
  nature: {
    name: 'Nature',
    icon: Sun,
    emojis: ['🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌿', '🍀', '🌱', '🌳', '🌲', '🌴', '🌵', '🌾', '🌈', '☀️', '🌙', '⭐']
  },
  people: {
    name: 'People',
    icon: Star,
    emojis: ['👨‍👩‍👧‍👦', '👪', '👫', '👬', '👭', '🤝', '👏', '🙌', '👍', '👌', '✌️', '🤞', '🤟', '🤘', '👊', '✊', '🤲', '🫶']
  },
  activities: {
    name: 'Activities',
    icon: Sparkles,
    emojis: ['🏃‍♀️', '🏃‍♂️', '🚶‍♀️', '🚶‍♂️', '🧘‍♀️', '🧘‍♂️', '🏋️‍♀️', '🏋️‍♂️', '🤸‍♀️', '🤸‍♂️', '🏊‍♀️', '🏊‍♂️', '🚴‍♀️', '🚴‍♂️', '🎨', '🎭', '🎪', '🎸']
  },
  food: {
    name: 'Food',
    icon: Heart,
    emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🥭', '🍑', '🥝', '🍅', '🥑', '🌽', '🥕', '🥒']
  },
  symbols: {
    name: 'Symbols',
    icon: Star,
    emojis: ['💪', '🔥', '⚡', '💎', '🏆', '🥇', '🎯', '🎪', '🎭', '🎨', '🎵', '🎶', '🎼', '🔔', '🕊️', '🦋', '🌟', '✨']
  }
}

// Most commonly used gratitude emojis for quick access
const QUICK_ACCESS_EMOJIS = ['🙏', '💜', '❤️', '😊', '🌟', '✨', '🎉', '🥰', '🌸', '🌈', '☀️', '🔥', '👏', '🙌', '💪', '🦋']

export default function EnhancedEmojiPicker({
  isOpen,
  onClose,
  onEmojiSelect,
  position,
  className = ""
}: EnhancedEmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState('gratitude')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredEmojis, setFilteredEmojis] = useState<string[]>([])

  if (!isOpen) return null

  // Filter emojis based on search query
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setFilteredEmojis([])
      return
    }

    const allEmojis = Object.values(EMOJI_CATEGORIES).flatMap(category => category.emojis)
    // Simple search - in a real app, you'd want emoji name/keyword mapping
    setFilteredEmojis(allEmojis.slice(0, 24)) // Limit results
  }

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji)
    // Don't close the picker - let user select multiple emojis
  }

  const currentEmojis = searchQuery.trim() 
    ? filteredEmojis 
    : EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES]?.emojis || []

  // Calculate position to keep picker in viewport
  const pickerStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320), // 320px is picker width
    top: Math.min(position.y, window.innerHeight - 400), // 400px is picker height
    zIndex: 1060 // Higher than other modals
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        style={{ pointerEvents: 'auto' }}
      />

      {/* Emoji Picker */}
      <div
        style={pickerStyle}
        className={`bg-white border border-gray-200 rounded-xl shadow-xl w-80 h-96 flex flex-col emoji-picker ${className}`}
        data-emoji-picker
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Add Emoji</h3>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search emojis..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Quick Access (when not searching) */}
        {!searchQuery.trim() && (
          <div className="p-3 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-600 mb-2">Quick Access</div>
            <div className="grid grid-cols-8 gap-1">
              {QUICK_ACCESS_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleEmojiClick(emoji)
                  }}
                  className="w-8 h-8 rounded hover:bg-gray-100 transition-colors text-lg flex items-center justify-center"
                  title={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Tabs (when not searching) */}
        {!searchQuery.trim() && (
          <div className="flex overflow-x-auto border-b border-gray-100">
            {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => {
              const IconComponent = category.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setActiveCategory(key)
                  }}
                  className={`flex-shrink-0 flex items-center space-x-1 px-3 py-2 text-xs font-medium transition-colors ${
                    activeCategory === key
                      ? 'text-purple-700 border-b-2 border-purple-500 bg-purple-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <IconComponent className="h-3 w-3" />
                  <span>{category.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Emoji Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {searchQuery.trim() && (
            <div className="text-xs font-medium text-gray-600 mb-2">
              Search Results ({filteredEmojis.length})
            </div>
          )}
          
          <div className="grid grid-cols-8 gap-1">
            {currentEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleEmojiClick(emoji)
                }}
                className="w-8 h-8 rounded hover:bg-gray-100 transition-colors text-lg flex items-center justify-center hover:scale-110"
                title={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {currentEmojis.length === 0 && searchQuery.trim() && (
            <div className="text-center py-8 text-gray-500">
              <Smile className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No emojis found</p>
              <p className="text-xs">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Click an emoji to add it to your post
          </p>
        </div>
      </div>
    </>
  )
}