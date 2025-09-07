"use client"

import { useState, useRef, useEffect } from "react"
import { Bold, Italic, Underline, Type, Palette, Smile } from "lucide-react"
import EnhancedEmojiPicker from "./EnhancedEmojiPicker"

interface RichTextEditorProps {
  value: string
  onChange: (value: string, formattedValue: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
  onMentionTrigger?: (query: string, position: { x: number, y: number }) => void
  selectedStyle?: any
  onStyleChange?: (style: any) => void
}

interface TextFormat {
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  backgroundColor: string
  fontSize: 'small' | 'medium' | 'large'
}

const DEFAULT_FORMAT: TextFormat = {
  bold: false,
  italic: false,
  underline: false,
  color: '#374151', // gray-700
  backgroundColor: 'transparent',
  fontSize: 'medium'
}

const TEXT_COLORS = [
  { name: 'Default', value: '#374151' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Green', value: '#059669' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Pink', value: '#DB2777' },
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Yellow', value: '#D97706' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Lime', value: '#84CC16' }
]

const BACKGROUND_COLORS = [
  { name: 'None', value: 'transparent' },
  { name: 'Light Purple', value: '#F3F4F6' },
  { name: 'Light Blue', value: '#EFF6FF' },
  { name: 'Light Green', value: '#ECFDF5' },
  { name: 'Light Orange', value: '#FFF7ED' },
  { name: 'Light Pink', value: '#FDF2F8' },
  { name: 'Light Yellow', value: '#FEFCE8' },
  { name: 'Light Gray', value: '#F9FAFB' },
  { name: 'Light Red', value: '#FEF2F2' },
  { name: 'Light Indigo', value: '#EEF2FF' },
  { name: 'Light Teal', value: '#F0FDFA' },
  { name: 'Light Cyan', value: '#ECFEFF' },
  { name: 'Light Rose', value: '#FFF1F2' },
  { name: 'Light Violet', value: '#F5F3FF' },
  { name: 'Light Amber', value: '#FFFBEB' },
  { name: 'Light Lime', value: '#F7FEE7' }
]

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "What are you grateful for?",
  maxLength = 5000,
  className = "",
  onMentionTrigger,
  selectedStyle,
  onStyleChange
}: RichTextEditorProps) {
  const [currentFormat, setCurrentFormat] = useState<TextFormat>(DEFAULT_FORMAT)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const applyFormat = (formatType: keyof TextFormat, formatValue: any) => {
    const newFormat = { ...currentFormat, [formatType]: formatValue }
    setCurrentFormat(newFormat)
    
    // Just update the visual formatting state - don't modify the text content
    // The formatting will be applied via CSS styles to the textarea
  }

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.substring(0, start) + emoji + value.substring(end)
    
    onChange(newValue, newValue)
    
    // Position cursor after emoji
    setTimeout(() => {
      const newPosition = start + emoji.length
      textarea.setSelectionRange(newPosition, newPosition)
      textarea.focus()
    }, 0)
    
    // Don't close the emoji picker - let user select multiple emojis
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPosition = e.target.selectionStart || 0
    
    onChange(newValue, newValue)
    
    // Check for mention trigger
    if (onMentionTrigger) {
      const textBeforeCursor = newValue.slice(0, cursorPosition)
      const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\-\.\?\!\+]*)$/)
      
      if (mentionMatch) {
        const rect = textareaRef.current?.getBoundingClientRect()
        if (rect) {
          const x = rect.left + 16
          const y = rect.bottom + 8
          onMentionTrigger(mentionMatch[1] || '', { x, y })
        }
      }
    }
  }

  const getTextareaStyle = () => {
    return {
      color: currentFormat.color,
      backgroundColor: currentFormat.backgroundColor,
      fontWeight: currentFormat.bold ? 'bold' : 'normal',
      fontStyle: currentFormat.italic ? 'italic' : 'normal',
      textDecoration: currentFormat.underline ? 'underline' : 'none',
      fontSize: currentFormat.fontSize === 'small' ? '14px' : 
                currentFormat.fontSize === 'large' ? '18px' : '16px'
    }
  }

  return (
    <div ref={editorRef} className={`relative ${className}`}>
      {/* Formatting Toolbar */}
      <div className="flex items-center space-x-2 p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        {/* Text Formatting */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              applyFormat('bold', !currentFormat.bold)
            }}
            className={`p-2 rounded hover:bg-gray-200 transition-colors ${
              currentFormat.bold ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
            }`}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              applyFormat('italic', !currentFormat.italic)
            }}
            className={`p-2 rounded hover:bg-gray-200 transition-colors ${
              currentFormat.italic ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
            }`}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              applyFormat('underline', !currentFormat.underline)
            }}
            className={`p-2 rounded hover:bg-gray-200 transition-colors ${
              currentFormat.underline ? 'bg-purple-100 text-purple-700' : 'text-gray-600'
            }`}
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Font Size */}
        <select
          value={currentFormat.fontSize}
          onChange={(e) => applyFormat('fontSize', e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>

        <div className="w-px h-6 bg-gray-300" />

        {/* Color Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
            }}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Text Color"
          >
            <Type className="h-4 w-4" />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50" data-rich-text-modal>
              <div className="grid grid-cols-6 gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      applyFormat('color', color.value)
                      setShowColorPicker(false)
                    }}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Background Color Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowBackgroundPicker(!showBackgroundPicker)
            }}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Background Color"
          >
            <Palette className="h-4 w-4" />
          </button>
          {showBackgroundPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50" data-rich-text-modal>
              <div className="grid grid-cols-6 gap-1">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      applyFormat('backgroundColor', color.value)
                      setShowBackgroundPicker(false)
                    }}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color.value === 'transparent' ? '#ffffff' : color.value,
                      border: color.value === 'transparent' ? '2px dashed #d1d5db' : '1px solid #d1d5db'
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Emoji Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setEmojiPickerPosition({ x: rect.left, y: rect.bottom + 8 })
              setShowEmojiPicker(!showEmojiPicker)
            }}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Add Emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        placeholder={placeholder}
        maxLength={maxLength}
        style={getTextareaStyle()}
        className="w-full h-32 p-4 border-0 rounded-b-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none transition-colors"
      />

      {/* Click outside handlers */}
      {(showColorPicker || showBackgroundPicker) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowColorPicker(false)
            setShowBackgroundPicker(false)
          }}
        />
      )}

      {/* Enhanced Emoji Picker */}
      <EnhancedEmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={insertEmoji}
        position={emojiPickerPosition}
      />
    </div>
  )
}