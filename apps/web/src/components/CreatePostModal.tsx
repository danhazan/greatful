"use client"

import { useState, useRef, useEffect } from "react"
import { X, Camera, MapPin, Type, Image as ImageIcon, Zap } from "lucide-react"
import { validateImageFile, createImagePreview, revokeImagePreview } from "@/utils/imageUpload"
import { extractMentions } from "@/utils/mentionUtils"
import MentionAutocomplete from "./MentionAutocomplete"
import { UserInfo } from "@/../../shared/types/core"

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (postData: {
    content: string
    postType: 'daily' | 'photo' | 'spontaneous'
    imageUrl?: string
    location?: string
    imageFile?: File
    mentions?: string[]
  }) => void
}

const POST_TYPES = [
  {
    id: 'daily' as const,
    name: 'Daily Gratitude',
    icon: Type,
    description: 'Share your daily gratitude reflection',
    maxChars: 500,
    color: 'purple',
    prominence: '3x larger display'
  },
  {
    id: 'photo' as const,
    name: 'Photo Gratitude',
    icon: ImageIcon,
    description: 'Share a moment with a photo',
    maxChars: 300,
    color: 'blue',
    prominence: '2x boost display'
  },
  {
    id: 'spontaneous' as const,
    name: 'Spontaneous Text',
    icon: Zap,
    description: 'Quick appreciation note',
    maxChars: 200,
    color: 'green',
    prominence: 'Compact display'
  }
]

export default function CreatePostModal({ isOpen, onClose, onSubmit }: CreatePostModalProps) {
  const [postData, setPostData] = useState<{
    content: string
    postType: 'daily' | 'photo' | 'spontaneous'
    imageUrl?: string
    location?: string
  }>({
    content: '',
    postType: 'daily',
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

  // Get current post type config
  const currentPostType = POST_TYPES.find(type => type.id === postData.postType)!
  const maxChars = currentPostType.maxChars

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!postData.content.trim()) {
      setError('Please write something you\'re grateful for')
      return
    }

    if (postData.content.length > maxChars) {
      setError(`Content is too long. Maximum ${maxChars} characters for ${currentPostType.name}`)
      return
    }

    setIsSubmitting(true)

    try {
      // Extract mentions from content
      const mentions = extractMentions(postData.content.trim())
      const mentionUsernames = mentions.map(m => m.username)

      await onSubmit({
        content: postData.content.trim(),
        postType: postData.postType,
        imageUrl: postData.imageUrl || undefined,
        location: postData.location || undefined,
        imageFile: imageFile || undefined,
        mentions: mentionUsernames.length > 0 ? mentionUsernames : undefined
      })

      // Clear form and draft on successful submission
      if (postData.imageUrl && postData.imageUrl.startsWith('blob:')) {
        revokeImagePreview(postData.imageUrl)
      }
      setImageFile(null)
      setPostData({
        content: '',
        postType: 'daily',
        imageUrl: '',
        location: ''
      })
      localStorage.removeItem('grateful_post_draft')
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to create post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePostTypeChange = (newType: 'daily' | 'photo' | 'spontaneous') => {
    const newMaxChars = POST_TYPES.find(type => type.id === newType)!.maxChars

    // Truncate content if it exceeds new limit
    let newContent = postData.content
    if (newContent.length > newMaxChars) {
      newContent = newContent.substring(0, newMaxChars)
    }

    setPostData({
      ...postData,
      postType: newType,
      content: newContent
    })
  }

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
    // TODO: Implement location picker
    alert('Location picker coming soon!')
  }

  // Handle mention detection and autocomplete
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    const cursorPosition = e.target.selectionStart || 0
    
    setPostData({ ...postData, content: newContent })

    // Check for @ mention at cursor position
    const textBeforeCursor = newContent.slice(0, cursorPosition)
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/)
    
    if (mentionMatch) {
      const mentionStart = cursorPosition - mentionMatch[0].length
      const query = mentionMatch[1] || '' // Ensure query is never undefined
      
      // Simple position calculation for testing
      const rect = textareaRef.current?.getBoundingClientRect()
      const x = rect ? rect.left + 16 : 16
      const y = rect ? rect.top + 24 : 24
      
      setMentionPosition({ x, y })
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          ref={modalRef}
          role="dialog"
          aria-labelledby="modal-title"
          aria-modal="true"
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
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
              {/* Post Type Selection */}
              <div className="p-6 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Post Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {POST_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = postData.postType === type.id

                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handlePostTypeChange(type.id)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <Icon className={`h-5 w-5 ${isSelected ? 'text-purple-600' : 'text-gray-500'
                            }`} />
                          <span className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'
                            }`}>
                            {type.name}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{type.description}</p>
                        <p className="text-xs text-gray-400">
                          {type.maxChars} chars • {type.prominence}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content Input */}
              <div className="flex-1 p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What are you grateful for?
                </label>
                <textarea
                  ref={textareaRef}
                  value={postData.content}
                  onChange={handleContentChange}
                  className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder={`Share what you're grateful for today... (Use @username to mention someone)`}
                  maxLength={maxChars}
                />
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs text-gray-500">
                    {currentPostType.name} • {currentPostType.prominence}
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
                    <div className="relative inline-block">
                      <img
                        src={postData.imageUrl}
                        alt="Post preview"
                        className="max-w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Options */}
              <div className="px-6 pb-8">
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
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Add Location</span>
                  </button>
                </div>
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
            <div className="p-6">
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  Draft saved automatically
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
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
    </>
  )
}