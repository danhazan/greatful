"use client"

import { useState, useRef, useEffect } from "react"
import { X, Camera, MapPin, Type, Image as ImageIcon, Zap } from "lucide-react"
import { validateImageFile, createImagePreview, revokeImagePreview } from "@/utils/imageUpload"
import { extractMentions } from "@/utils/mentionUtils"
import { useToast } from "@/contexts/ToastContext"
import MentionAutocomplete from "./MentionAutocomplete"
import LocationModal from "./LocationModal"

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

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (postData: {
    content: string
    imageUrl?: string
    location?: string
    location_data?: LocationResult
    imageFile?: File
    mentions?: string[]
  }) => void
}

// Character limits for automatic type detection
const CHARACTER_LIMITS = {
  daily: 5000,  // Generous limit for thoughtful daily gratitudes
  photo: 0,     // Photo gratitude has no text - image only
  spontaneous: 200  // Quick appreciation notes
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

export default function CreatePostModal({ isOpen, onClose, onSubmit }: CreatePostModalProps) {
  const { showSuccess, showError, showLoading, hideToast } = useToast()
  const [postData, setPostData] = useState<{
    content: string
    imageUrl?: string
    location?: string
    location_data?: LocationResult
  }>({
    content: '',
    imageUrl: '',
    location: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mention autocomplete state
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 })
  const [currentMentionStart, setCurrentMentionStart] = useState(-1)

  // Location state
  const [showLocationModal, setShowLocationModal] = useState(false)

  // Analyze content to determine post type and character limit
  const analyzeContent = (content: string, hasImage: boolean) => {
    const trimmedContent = content.trim()
    const wordCount = trimmedContent.split(/\s+/).filter(word => word.length > 0).length
    const charCount = trimmedContent.length
    
    // Simple Rules (matching backend):
    // 1. Photo only (has image, no meaningful text) -> photo gratitude
    // 2. Just text under limit (< 20 words AND < 100 chars, no image) -> spontaneous  
    // 3. All others -> daily gratitude (large text, or text+image)
    
    if (hasImage && wordCount === 0) {
      return { type: 'photo' as const, limit: CHARACTER_LIMITS.photo }
    } else if (!hasImage && wordCount < 20 && charCount < 100) {
      return { type: 'spontaneous' as const, limit: CHARACTER_LIMITS.spontaneous }
    } else {
      return { type: 'daily' as const, limit: CHARACTER_LIMITS.daily }
    }
  }

  const hasImage = Boolean(postData.imageUrl)
  const contentAnalysis = analyzeContent(postData.content, hasImage)
  const detectedType = contentAnalysis.type
  const maxChars = contentAnalysis.limit
  const currentPostTypeInfo = POST_TYPE_INFO[detectedType]

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
        
        // Otherwise close post modal
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, showLocationModal])

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

  // Handle keyboard navigation for drag and drop zone
  const handleDragZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAddPhoto()
    }
  }

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // Load draft from localStorage
  useEffect(() => {
    if (isOpen) {
      const draft = localStorage.getItem('grateful_post_draft')
      if (draft) {
        try {
          const draftData = JSON.parse(draft)
          setPostData(draftData)
        } catch (error) {
          console.error('Error loading draft:', error)
        }
      }
    }
  }, [isOpen])

  // Save draft to localStorage
  useEffect(() => {
    if (postData.content.trim()) {
      localStorage.setItem('grateful_post_draft', JSON.stringify(postData))
    }
  }, [postData])

  // Cleanup blob URLs when modal closes
  useEffect(() => {
    return () => {
      if (postData.imageUrl && postData.imageUrl.startsWith('blob:')) {
        revokeImagePreview(postData.imageUrl)
      }
    }
  }, [postData.imageUrl])

  // Reset drag state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsDragOver(false)
      setDragCounter(0)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!postData.content.trim()) {
      setError('Please write something you\'re grateful for')
      return
    }

    if (postData.content.length > maxChars) {
      setError(`Content is too long. Maximum ${maxChars} characters for ${currentPostTypeInfo.name}`)
      return
    }

    setIsSubmitting(true)

    // Show loading toast
    const loadingToastId = showLoading(
      'Creating post...',
      'Sharing your gratitude'
    )

    try {
      // Extract mentions from content
      const mentions = extractMentions(postData.content.trim())
      const mentionUsernames = mentions.map(m => m.username)

      await onSubmit({
        content: postData.content.trim(),
        imageUrl: postData.imageUrl || undefined,
        location: postData.location || undefined,
        location_data: postData.location_data || undefined,
        imageFile: imageFile || undefined,
        mentions: mentionUsernames.length > 0 ? mentionUsernames : undefined
      })

      // Hide loading toast and show success
      hideToast(loadingToastId)
      showSuccess(
        'Post Created!',
        'Your gratitude has been shared successfully'
      )

      // Clear form and draft on successful submission
      if (postData.imageUrl && postData.imageUrl.startsWith('blob:')) {
        revokeImagePreview(postData.imageUrl)
      }
      setImageFile(null)
      setPostData({
        content: '',
        imageUrl: '',
        location: ''
      })
      setShowLocationModal(false)
      localStorage.removeItem('grateful_post_draft')
      onClose()
    } catch (error: any) {
      // Hide loading toast and show error
      hideToast(loadingToastId)
      const errorMessage = error.message || 'Failed to create post. Please try again.'
      setError(errorMessage)
      showError(
        'Post Failed',
        errorMessage,
        {
          label: 'Retry',
          onClick: () => handleSubmit(e)
        }
      )
    } finally {
      setIsSubmitting(false)
    }
  }



  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  const handleAddPhoto = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleImageUpload(file)
      }
    }
    input.click()
  }

  const handleImageUpload = async (file: File) => {
    // Clear any previous errors
    setError('')

    // Validate the file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Invalid image file')
      return
    }

    try {
      // Create a preview URL for immediate display
      const previewUrl = createImagePreview(file)

      // Store both the file and preview URL
      setImageFile(file)
      setPostData({
        ...postData,
        imageUrl: previewUrl
      })

    } catch (error) {
      console.error('Error handling image:', error)
      setError('Failed to process image. Please try again.')
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => prev + 1)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newCounter = dragCounter - 1
    setDragCounter(newCounter)
    if (newCounter <= 0) {
      setIsDragOver(false)
      setDragCounter(0)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragCounter(0)

    const files = Array.from(e.dataTransfer.files)
    
    if (files.length === 0) {
      setError('No files were dropped')
      return
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length === 0) {
      const fileTypes = files.map(f => f.type).join(', ')
      setError(`Please drop an image file. Received: ${fileTypes || 'unknown file types'}`)
      return
    }

    if (imageFiles.length > 1) {
      setError('Please drop only one image at a time')
      return
    }

    // Handle the first image file (MVP supports single image)
    const file = imageFiles[0]
    handleImageUpload(file)
  }

  const handleRemoveImage = () => {
    // Only revoke blob URLs, not data URLs
    if (postData.imageUrl && postData.imageUrl.startsWith('blob:')) {
      revokeImagePreview(postData.imageUrl)
    }
    setImageFile(null)
    setPostData({
      ...postData,
      imageUrl: ''
    })
  }

  const handleAddLocation = () => {
    setShowLocationModal(true)
  }

  const handleLocationSelect = (location: LocationResult | null) => {
    if (location) {
      setPostData({
        ...postData,
        location: location.display_name,
        location_data: location
      })
    } else {
      setPostData({
        ...postData,
        location: '',
        location_data: undefined
      })
    }
  }

  // Handle mention detection and autocomplete
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    const cursorPosition = e.target.selectionStart || 0
    
    // Allow all changes - mention protection removed for better UX
    setPostData({ ...postData, content: newContent })

    // Check for @ mention at cursor position
    const textBeforeCursor = newContent.slice(0, cursorPosition)
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\-\.\?\!\+]*)$/)
    
    if (mentionMatch) {
      const mentionStart = cursorPosition - mentionMatch[0].length
      const query = mentionMatch[1] || '' // Ensure query is never undefined
      
      // Calculate position below the textarea to avoid blocking content
      const rect = textareaRef.current?.getBoundingClientRect()
      if (rect) {
        // Position the autocomplete below the textarea
        const x = rect.left + 16
        const y = rect.bottom + 8 // 8px gap below textarea
        
        setMentionPosition({ x, y })
      }
      
      setCurrentMentionStart(mentionStart)
      setMentionQuery(query)
      setShowMentionAutocomplete(true)
    } else {
      setShowMentionAutocomplete(false)
      setMentionQuery('')
      setCurrentMentionStart(-1)
    }
  }



  const handleMentionSelect = (user: UserInfo) => {
    if (currentMentionStart >= 0 && textareaRef.current) {
      const textarea = textareaRef.current
      const currentContent = postData.content
      const cursorPosition = textarea.selectionStart
      
      // Replace the partial mention with the selected username
      const beforeMention = currentContent.slice(0, currentMentionStart)
      const afterCursor = currentContent.slice(cursorPosition)
      const newContent = `${beforeMention}@${user.username} ${afterCursor}`
      
      setPostData({ ...postData, content: newContent })
      
      // Set cursor position after the inserted mention
      const newCursorPosition = currentMentionStart + user.username.length + 2 // +2 for @ and space
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(newCursorPosition, newCursorPosition)
      }, 0)
    }
    
    setShowMentionAutocomplete(false)
    setMentionQuery('')
    setCurrentMentionStart(-1)
  }

  const handleMentionClose = () => {
    setShowMentionAutocomplete(false)
    setMentionQuery('')
    setCurrentMentionStart(-1)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40" 
        onClick={(e) => {
          // Don't close if location modal is open
          if (e.target === e.currentTarget && !showLocationModal) {
            onClose()
          }
        }}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          ref={modalRef}
          role="dialog"
          aria-labelledby="modal-title"
          aria-modal="true"
          className={`bg-white rounded-xl shadow-xl border w-full max-w-2xl max-h-[90vh] flex flex-col transition-colors ${
            isDragOver ? 'border-purple-400 shadow-purple-200' : 'border-gray-200'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b transition-colors ${
            isDragOver ? 'border-purple-200 bg-purple-50' : 'border-gray-200'
          }`}>
            <h2 id="modal-title" className="text-xl font-semibold text-gray-900">Share Your Gratitude</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">


              {/* Content Input */}
              <div className="flex-1 p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What are you grateful for?
                </label>
                
                {/* Drag and Drop Zone */}
                <div
                  className={`relative ${isDragOver ? 'pointer-events-none' : ''}`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <textarea
                    ref={textareaRef}
                    value={postData.content}
                    onChange={handleContentChange}
                    className={`w-full h-32 p-4 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-colors ${
                      isDragOver 
                        ? 'border-purple-400 bg-purple-50' 
                        : 'border-gray-300'
                    }`}
                    placeholder={`Share what you're grateful for today... (Use @username to mention someone)`}
                    maxLength={maxChars}
                  />
                  
                  {/* Drag Overlay */}
                  {isDragOver && (
                    <div className="absolute inset-0 bg-purple-100 bg-opacity-90 border-2 border-dashed border-purple-400 rounded-lg flex items-center justify-center z-10">
                      <div className="text-center">
                        <ImageIcon className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                        <p className="text-purple-700 font-medium">Drop image to upload</p>
                        <p className="text-purple-600 text-sm">Supports JPG, PNG, WebP</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs text-gray-500">
                    Auto-detected as {currentPostTypeInfo.name}
                  </div>
                  <div className={`text-sm ${postData.content.length > maxChars * 0.9
                    ? 'text-red-500'
                    : 'text-gray-500'
                    }`}>
                    {postData.content.length}/{maxChars}
                  </div>
                </div>

                {/* Image Preview */}
                {postData.imageUrl && (
                  <div className="mt-4">
                    <div className="relative inline-block group">
                      <img
                        src={postData.imageUrl}
                        alt="Post preview"
                        className="max-w-full h-32 object-cover rounded-lg border border-gray-200 transition-opacity group-hover:opacity-90"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                        title="Remove image"
                        aria-label="Remove uploaded image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {imageFile && (
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                          {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(1)}MB)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Options */}
              <div className="px-6 pb-8">
                {/* Drag and Drop Zone (when no image) */}
                {!postData.imageUrl && (
                  <div
                    className={`mb-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      isDragOver
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={handleAddPhoto}
                    onKeyDown={handleDragZoneKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-label="Upload image by dragging and dropping or clicking to browse"
                  >
                    <ImageIcon className={`h-8 w-8 mx-auto mb-2 ${
                      isDragOver ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <p className={`text-sm font-medium mb-1 ${
                      isDragOver ? 'text-purple-700' : 'text-gray-600'
                    }`}>
                      {isDragOver ? 'Drop your image here' : 'Drag and drop an image, or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Supports JPG, PNG, WebP up to 5MB
                    </p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${postData.imageUrl
                      ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                      : 'border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <Camera className={`h-4 w-4 ${postData.imageUrl ? 'text-purple-600' : 'text-gray-500'}`} />
                    <span className="text-sm">
                      {postData.imageUrl ? 'Change Photo' : 'Add Photo'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
                      postData.location_data 
                        ? 'border-purple-300 bg-purple-50 text-purple-700' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <MapPin className={`h-4 w-4 ${postData.location_data ? 'text-purple-600' : 'text-gray-500'}`} />
                    <span className="text-sm">
                      {postData.location_data ? 'Change Location' : 'Add Location'}
                    </span>
                  </button>
                </div>

                {/* Selected Location Display */}
                {postData.location_data && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium text-purple-900 break-words line-clamp-2">
                            {postData.location_data.display_name}
                          </p>
                          {postData.location_data.address.country && (
                            <p className="text-xs text-purple-700">
                              {[
                                postData.location_data.address.city,
                                postData.location_data.address.state,
                                postData.location_data.address.country
                              ].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLocationSelect(null)}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-6 pb-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex flex-col space-y-3">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px] touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !postData.content.trim()}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Sharing...' : 'Share Gratitude'}
                  </button>
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500">
                    Draft saved automatically
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Mention Autocomplete */}
        <MentionAutocomplete
          isOpen={showMentionAutocomplete}
          searchQuery={mentionQuery}
          onUserSelect={handleMentionSelect}
          onClose={handleMentionClose}
          position={mentionPosition}
        />
      </div>

      {/* Location Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelect={handleLocationSelect}
        initialValue={postData.location_data?.display_name || postData.location || ''}
      />
    </>
  )
}