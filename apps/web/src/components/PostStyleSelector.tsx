"use client"

import { Sparkles } from "lucide-react"

export interface PostStyle {
  id: string
  name: string
  backgroundColor: string
  backgroundGradient?: string
  backgroundPattern?: string
  textColor: string
  borderStyle?: string
  fontFamily?: string
  textShadow?: string
}

interface PostStyleSelectorProps {
  selectedStyle: PostStyle
  onStyleChange: (style: PostStyle) => void
  className?: string
  isOpen?: boolean
  onClose?: () => void
  position?: { x: number, y: number }
}

// Predefined gratitude-themed post styles
const POST_STYLES: PostStyle[] = [
  {
    id: 'default',
    name: 'Default',
    backgroundColor: '#ffffff',
    textColor: '#374151'
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    backgroundColor: '#FEF3C7',
    backgroundGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)',
    textColor: '#92400E',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'peaceful-purple',
    name: 'Peaceful Purple',
    backgroundColor: '#F3E8FF',
    backgroundGradient: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 50%, #C084FC 100%)',
    textColor: '#581C87',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'nature-green',
    name: 'Nature Green',
    backgroundColor: '#ECFDF5',
    backgroundGradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 50%, #34D399 100%)',
    textColor: '#065F46',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    backgroundColor: '#EFF6FF',
    backgroundGradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #60A5FA 100%)',
    textColor: '#1E3A8A',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    backgroundColor: '#FDF2F8',
    backgroundGradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 50%, #F472B6 100%)',
    textColor: '#9D174D',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'minimalist-gray',
    name: 'Minimalist',
    backgroundColor: '#F9FAFB',
    textColor: '#374151',
    borderStyle: '2px solid #E5E7EB'
  },
  {
    id: 'elegant-dark',
    name: 'Elegant Dark',
    backgroundColor: '#1F2937',
    textColor: '#F9FAFB',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
  },
  {
    id: 'gratitude-gold',
    name: 'Gratitude Gold',
    backgroundColor: '#FFFBEB',
    backgroundGradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 50%, #FBBF24 100%)',
    textColor: '#92400E',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  }
]

// Font options for posts
const FONT_OPTIONS = [
  { id: 'default', name: 'Default', fontFamily: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif', name: 'Serif', fontFamily: 'Georgia, serif' },
  { id: 'mono', name: 'Monospace', fontFamily: 'Monaco, monospace' },
  { id: 'handwriting', name: 'Handwriting', fontFamily: 'cursive' },
  { id: 'elegant', name: 'Elegant', fontFamily: '"Times New Roman", serif' }
]

export default function PostStyleSelector({
  selectedStyle,
  onStyleChange,
  className = "",
  isOpen = false,
  onClose,
  position = { x: 0, y: 0 }
}: PostStyleSelectorProps) {
  const handleStyleSelect = (style: PostStyle) => {
    onStyleChange(style)
    if (onClose) onClose()
  }

  const handleFontChange = (fontOption: typeof FONT_OPTIONS[0]) => {
    const updatedStyle = {
      ...selectedStyle,
      fontFamily: fontOption.fontFamily
    }
    onStyleChange(updatedStyle)
  }

  const getStylePreview = (style: PostStyle) => {
    const previewStyle: React.CSSProperties = {
      backgroundColor: style.backgroundColor,
      background: style.backgroundGradient || style.backgroundColor,
      color: style.textColor,
      border: style.borderStyle || 'none',
      textShadow: style.textShadow || 'none',
      fontFamily: style.fontFamily || 'inherit'
    }
    return previewStyle
  }

  if (!isOpen) return null

  // Calculate position to keep picker in viewport
  const pickerStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 400), // 400px is picker width
    top: Math.min(position.y, window.innerHeight - 500), // 500px is picker height
    zIndex: 1000
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Background Selector */}
      <div
        style={pickerStyle}
        className={`bg-white border border-gray-200 rounded-xl shadow-xl w-96 max-h-[500px] flex flex-col background-selector ${className}`}
        data-backgrounds-modal
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose Style</h3>
          <p className="text-sm text-gray-600">Select a background style for your post</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Background Styles */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Background Styles</h4>
            <div className="grid grid-cols-2 gap-3">
              {POST_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleStyleSelect(style)}
                  className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                    selectedStyle.id === style.id
                      ? 'border-purple-500 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={getStylePreview(style)}
                >
                  <div className="text-xs font-medium mb-1">{style.name}</div>
                  <div className="text-xs opacity-75">Sample text</div>
                  {selectedStyle.id === style.id && (
                    <div className="absolute top-1 right-1">
                      <Sparkles className="h-3 w-3 text-purple-600" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font Options */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Font Style</h4>
            <div className="space-y-1">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => handleFontChange(font)}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors ${
                    selectedStyle.fontFamily === font.fontFamily
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-700'
                  }`}
                  style={{ fontFamily: font.fontFamily }}
                >
                  <div className="text-sm">{font.name}</div>
                  <div className="text-xs opacity-75">Sample text</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-600 mb-2">Preview:</div>
          <div
            className="px-3 py-2 rounded-lg border text-sm"
            style={getStylePreview(selectedStyle)}
          >
            I'm grateful for this beautiful day...
          </div>
        </div>
      </div>
    </>
  )
}

// Export the PostStyle type and default styles for use in other components
export { POST_STYLES, FONT_OPTIONS }