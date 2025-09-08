"use client"

import { useState, useRef, useEffect } from "react"
import { X, Camera, MapPin, Type, Image as ImageIcon, Zap, Palette, FileText, Sparkles, Brush, Calendar } from "lucide-react"
import { validateImageFile, createImagePreview, revokeImagePreview } from "@/utils/imageUpload"
import { extractMentions } from "@/utils/mentionUtils"
import { htmlToPlainText } from "@/utils/htmlUtils"
import { useToast } from "@/contexts/ToastContext"
import MentionAutocomplete from "./MentionAutocomplete"
import LocationModal from "./LocationModal"
import RichTextEditor, { RichTextEditorRef } from "./RichTextEditor"
import PostStyleSelector, { PostStyle, POST_STYLES } from "./PostStyleSelector"

// UserInfo type defined locally
interface UserInfo {
  id: number
  username: string
  profile_image_url?: string
  bio?: string
}

// Location result type from LocationAutocomplete
interface LocationResult {
  display_name: string
  lat: number
  lon: number
  place_id?: string
  address: {
    city?: string
    state?: string
    country?: string
    country_code?: string
  }
  importance?: number
  type?: string
}

interface Post {
  id: string
  content: string
  postStyle?: PostStyle
  post_style?: PostStyle
  location?: string
  location_data?: LocationResult
  imageUrl?: string
  postType: "daily" | "photo" | "spontaneous"
  createdAt?: string
  updatedAt?: string
}

interface EditPostModalProps {
  isOpen: boolean
  onClose: () => void
  post: Post
  onSubmit: (postData: {
    content: string
    postStyle?: PostStyle
    location?: string
    location_data?: LocationResult
    mentions?: string[]
  }) => void
}

// Character limits for automatic type detection
const CHARACTER_LIMITS = {
  daily: 5000,      // enforced for any text post
  photo: 0,         // image-only
  spontaneous: 200  // keep for reference/metadata only — DO NOT enforce this limit
}

// Post type information for display purposes
const POST_TYPE_INFO = {
  daily: {
    name: 'Daily Gratitude',
    description: 'Longer reflective content',
    prominence: '3x larger display'
  },
  photo: {
    name: 'Photo Gratitude', 
    description: 'Image with caption',
    prominence: '2x boost display'
  },
  spontaneous: {
    name: 'Spontaneous Text',
    description: 'Quick appreciation note',
    prominence: 'Compact display'
  }
}

export default function EditPostModal({ isOpen, onClose, post, onSubmit }: EditPostModalProps) {
  const { showSuccess, showError, showLoading, hideToast } = useToast()
  const [postData, setPostData] = useState<{
    content: string
    location?: string
    location_data?: LocationResult
  }>({
    content: post.content || '',
    location: post.location || '',
    location_data: post.location_data
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const richTextEditorRef = useRef<RichTextEditorRef>(null)

  // Rich text and styling state (always enabled)
  // Convert HTML content to plain text for editing
  const [richContent, setRichContent] = useState(htmlToPlainText(post.content || ''))
  const [formattedContent, setFormattedContent] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<PostStyle>(
    post.postStyle || post.post_style || POST_STYLES[0]
  )
  const [showBackgrounds, setShowBackgrounds] = useState(false)
  const [backgroundsPosition, setBackgroundsPosition] = useState({ x: 0, y: 0 })

  // Mention autocomplete state
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 })
  const [currentMentionStart, setCurrentMentionStart] = useState(-1)

  // Location state
  const [showLocationModal, setShowLocationModal] = useState(false)

  // BEFORE: analyzeContent returned {type, limit} and UI used limit to enforce input. 
  // AFTER: analyzeContent returns predicted type only (for display), and we compute maxChars separately.
  const analyzeContent = (content: string, hasImage: boolean) => {
    const trimmed = content.trim()
    const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(w => w.length > 0).length
    
    if (hasImage && wordCount === 0) {
      return { type: 'photo' as const } // image only
    }
    
    // Predicted spontaneous if very short; this is only a UI hint
    if (!hasImage && wordCount < 20) {
      return { type: 'spontaneous' as const }
    }
    
    // Otherwise predicted as daily (longer text)
    return { type: 'daily' as const }
  }

  const hasImage = Boolean(post.imageUrl)
  
  // Always use rich content for analysis
  const contentForAnalysis = richContent || postData.content
  const trimmed = contentForAnalysis.trim()
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(w => w.length > 0).length
  
  // predicted type only for display
  const predicted = analyzeContent(contentForAnalysis, hasImage)
  
  // Input max: photo-only -> 0, else text -> 5000
  const maxChars = (hasImage && wordCount === 0) ? CHARACTER_LIMITS.photo : CHARACTER_LIMITS.daily
  const currentPostTypeInfo = POST_TYPE_INFO[predicted.type]

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        const target = event.target as Element
        
        // ✅ Ignore clicks inside LocationModal if open
        if (showLocationModal && target.closest('[data-location-modal]')) {
          return
        }
        
        // ✅ Ignore clicks inside mention autocomplete dropdown
        if (target.closest('[data-mention-autocomplete]')) {
          return
        }

        // ✅ Ignore clicks inside background selector if open
        if (showBackgrounds && (target.closest('.background-selector') || target.closest('[data-backgrounds-modal]'))) {
          return
        }

        // ✅ Ignore clicks inside rich text editor modals (color pickers, etc.)
        if (target.closest('.rich-text-toolbar') || target.closest('[data-rich-text-modal]')) {
          return
        }
        
        // Otherwise close post modal
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, showLocationModal, showBackgrounds])

  // Handle escape key and mention autocomplete navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // If mention autocomplete is open, let it handle navigation keys
      if (showMentionAutocomplete && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        return // Let MentionAutocomplete handle these
      }
      
      if (event.key === 'Escape') {
        if (showMentionAutocomplete) {
          handleMentionClose()
        } else {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, showMentionAutocomplete])

  // Reset form when modal opens/closes or post changes
  useEffect(() => {
    if (isOpen) {
      setPostData({
        content: post.content || '',
        location: post.location || '',
        location_data: post.location_data
      })
      setRichContent(post.content || '')
      setSelectedStyle(post.postStyle || post.post_style || POST_STYLES[0])
      setError('')
      setIsSubmitting(false)
      
      // Focus on content editor after a short delay
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 100)
    }
  }, [isOpen, post])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting) return
    
    const finalContent = formattedContent || richContent || postData.content
    
    if (!finalContent.trim()) {
      setError('Please enter some content for your post')
      return
    }

    // Validate content length
    if (finalContent.length > maxChars) {
      setError(`Content is too long. Maximum ${maxChars} characters allowed for ${predicted.type} posts.`)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Extract mentions from content
      const mentionMatches = extractMentions(finalContent)
      const mentions = mentionMatches.map(match => match.username)

      const submitData = {
        content: finalContent,
        postStyle: selectedStyle,
        location: postData.location,
        location_data: postData.location_data,
        mentions
      }

      await onSubmit(submitData)
      
      // Reset form on successful submission
      setPostData({ content: '', location: '' })
      setRichContent('')
      setSelectedStyle(POST_STYLES[0])
      
    } catch (error) {
      console.error('Error updating post:', error)
      setError('Failed to update post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mention handling functions
  const handleMentionTrigger = (query: string, position: { x: number, y: number }, cursorPosition?: number) => {
    setMentionQuery(query)
    setMentionPosition(position)
    setCurrentMentionStart(cursorPosition || -1)
    setShowMentionAutocomplete(true)
  }

  const handleMentionSelect = (user: UserInfo) => {
    if (currentMentionStart >= 0 && richTextEditorRef.current) {
      const currentContent = richContent || postData.content
      
      // Find the start of the mention (the @ symbol)
      // currentMentionStart is the cursor position, we need to find the @ before it
      const textBeforeCursor = currentContent.slice(0, currentMentionStart)
      const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\-\.\?\!\+]*)$/)
      
      if (mentionMatch) {
        const mentionStartPos = currentMentionStart - mentionMatch[0].length
        const mentionEndPos = currentMentionStart
        
        // Use the RichTextEditor's insertMention method to handle the replacement properly
        richTextEditorRef.current.insertMention(user.username, mentionStartPos, mentionEndPos)
      }
    }
    handleMentionClose()
  }

  const handleMentionClose = () => {
    setShowMentionAutocomplete(false)
    setMentionQuery('')
    setCurrentMentionStart(-1)
  }

  // Location handling functions
  const handleLocationSelect = (location: LocationResult | null) => {
    if (location) {
      setPostData(prev => ({
        ...prev,
        location: location.display_name,
        location_data: location
      }))
    }
    setShowLocationModal(false)
  }

  const handleLocationClear = () => {
    setPostData(prev => ({
      ...prev,
      location: '',
      location_data: undefined
    }))
  }

  // Background selector functions
  const handleBackgroundsClick = (event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    setBackgroundsPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    })
    setShowBackgrounds(true)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div 
          ref={modalRef}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Post</h2>
                <p className="text-sm text-gray-500">Update your gratitude post</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">




              {/* Rich Text Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <RichTextEditor
                  ref={richTextEditorRef}
                  value={richContent}
                  onChange={(plainText, formattedText) => {
                    setRichContent(plainText)
                    setFormattedContent(formattedText)
                  }}
                  onMentionTrigger={handleMentionTrigger}
                  onMentionHide={handleMentionClose}
                  selectedStyle={selectedStyle}
                  onStyleChange={setSelectedStyle}
                  placeholder="What are you grateful for today?"
                  maxLength={maxChars}
                />
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-3">
                  {/* Background Styles */}
                  <button
                    type="button"
                    onClick={handleBackgroundsClick}
                    className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Palette className="h-4 w-4" />
                    <span className="text-sm font-medium">Style</span>
                  </button>

                  {/* Location */}
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                      postData.location 
                        ? 'text-purple-600 bg-purple-50' 
                        : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                    }`}
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {postData.location ? 'Location Added' : 'Location'}
                    </span>
                  </button>
                </div>

                {/* Character Count */}
                <div className="text-sm text-gray-500">
                  {richContent.length}/{maxChars === 0 ? '∞' : maxChars}
                </div>
              </div>

              {/* Location Display */}
              {postData.location && (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">{postData.location}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLocationClear}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !richContent.trim()}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isSubmitting ? 'Updating...' : 'Update Post'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Mention Autocomplete */}
      <MentionAutocomplete
        isOpen={showMentionAutocomplete}
        searchQuery={mentionQuery}
        position={mentionPosition}
        onUserSelect={handleMentionSelect}
        onClose={handleMentionClose}
      />

      {/* Location Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelect={handleLocationSelect}
        initialValue={postData.location || ""}
      />

      {/* Background Selector */}
      <PostStyleSelector
        isOpen={showBackgrounds}
        onClose={() => setShowBackgrounds(false)}
        selectedStyle={selectedStyle}
        onStyleChange={setSelectedStyle}
        position={backgroundsPosition}
      />
    </>
  )
}