"use client"

import { Sparkles } from "lucide-react"
import { getTextColorForBackground, extractPrimaryBackgroundColor } from "@/utils/colorUtils"

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
    textColor: '#374151', // Will be computed based on background
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'peaceful-purple',
    name: 'Peaceful Purple',
    backgroundColor: '#F3E8FF',
    backgroundGradient: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 50%, #C084FC 100%)',
    textColor: '#374151', // Will be computed based on background
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'nature-green',
    name: 'Nature Green',
    backgroundColor: '#ECFDF5',
    backgroundGradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 50%, #34D399 100%)',
    textColor: '#374151', // Will be computed based on background
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    backgroundColor: '#EFF6FF',
    backgroundGradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #60A5FA 100%)',
    textColor: '#374151', // Will be computed based on background
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    backgroundColor: '#FDF2F8',
    backgroundGradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 50%, #F472B6 100%)',
    textColor: '#374151', // Will be computed based on background
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
    textColor: '#F9FAFB', // Keep white for dark background
    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
  },
  {
    id: 'gratitude-gold',
    name: 'Gratitude Gold',
    backgroundColor: '#FFFBEB',
    backgroundGradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 50%, #FBBF24 100%)',
    textColor: '#374151', // Will be computed based on background
    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
  }
]

// Font options removed - keeping only for backward compatibility in exports
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

  // Font change handler removed - no longer needed

  const getStylePreview = (style: PostStyle) => {
    // Extract the primary background color for text color computation
    const primaryBgColor = extractPrimaryBackgroundColor(
      style.backgroundGradient || style.backgroundColor || 'transparent'
    );
    
    // Compute appropriate text color based on background
    const computedTextColor = style.id === 'elegant-dark' 
      ? style.textColor // Keep explicit white for dark theme
      : getTextColorForBackground(primaryBgColor, '#374151');
    
    const previewStyle: React.CSSProperties = {
      backgroundColor: style.backgroundColor,
      background: style.backgroundGradient || style.backgroundColor,
      color: computedTextColor,
      border: style.borderStyle || 'none',
      textShadow: style.textShadow || 'none',
      fontFamily: style.fontFamily || 'inherit'
    }
    return previewStyle
  }

  if (!isOpen) return null

  // Mobile-optimized positioning and sizing
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  
  const pickerStyle: React.CSSProperties = isMobile ? {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1000,
    width: 'calc(100vw - 2rem)', // Full width minus padding
    maxWidth: '400px',
    maxHeight: '80vh'
  } : {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 400), // 400px is picker width
    top: Math.min(position.y, window.innerHeight - 350), // 350px is picker height
    zIndex: 1000
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-30"
        onClick={onClose}
        data-backgrounds-backdrop
      />

      {/* Background Selector */}
      <div
        style={pickerStyle}
        className={`bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col background-selector ${
          isMobile ? 'w-full mx-4' : 'w-96'
        } ${
          isMobile ? 'max-h-[80vh]' : 'max-h-[350px]'
        } ${className}`}
        data-backgrounds-modal
        data-testid="backgrounds-modal"
      >
        {/* Header */}
        <div className={`border-b border-gray-200 ${isMobile ? 'p-4' : 'p-4'}`}>
          <h3 className={`font-semibold text-gray-900 mb-2 ${isMobile ? 'text-xl' : 'text-lg'}`}>
            Choose Style
          </h3>
          <p className="text-sm text-gray-600">Select a background style for your post</p>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-4'}`}>
          {/* Background Styles */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4">Background Styles</h4>
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {POST_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleStyleSelect(style)}
                  className={`relative rounded-lg border-2 transition-all hover:scale-105 active:scale-95 ${
                    isMobile ? 'p-4 min-h-[44px]' : 'p-3'
                  } ${
                    selectedStyle.id === style.id
                      ? 'border-purple-500 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{
                    ...getStylePreview(style),
                    minHeight: isMobile ? '44px' : 'auto', // Ensure 44px minimum touch target
                    touchAction: 'manipulation' // Prevent double-tap zoom on mobile
                  }}
                >
                  <div className={`font-medium mb-1 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                    {style.name}
                  </div>
                  <div className={`opacity-75 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                    Sample text
                  </div>
                  {selectedStyle.id === style.id && (
                    <div className={`absolute ${isMobile ? 'top-2 right-2' : 'top-1 right-1'}`}>
                      <Sparkles className={`text-purple-600 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'}`} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-specific close button */}
        {isMobile && (
          <div className="p-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// Export the PostStyle type and default styles for use in other components
export { POST_STYLES, FONT_OPTIONS }