"use client"

import { useState, useRef, useEffect } from "react"
import { X, MapPin, Brush, Loader2 } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import MentionAutocomplete from "./MentionAutocomplete"
import LocationModal from "./LocationModal"
import RichTextEditor, { RichTextEditorRef } from "./RichTextEditor"
import PostStyleSelector, { PostStyle, POST_STYLES } from "./PostStyleSelector"
import PostPrivacySelector from "./PostPrivacySelector"
import { usePostPrivacyState } from "@/hooks/usePostPrivacyState"
import { PostPrivacy } from "@/types/post"
import { buildPostPayload } from "@/utils/postPayload"

// UserInfo type defined locally
interface UserInfo {
  id: number
  username: string
  profileImageUrl?: string
  bio?: string
}

// Location result type from LocationAutocomplete
interface LocationResult {
  displayName: string
  lat: number
  lon: number
  placeId?: string
  address: {
    city?: string
    state?: string
    country?: string
    countryCode?: string
  }
  importance?: number
  type?: string
}

// PostImage for multi-image support
interface PostImage {
  id: string
  position: number
  thumbnailUrl: string
  mediumUrl: string
  originalUrl: string
  width?: number
  height?: number
}

interface Post {
  id: string
  content: string
  richContent?: string
  postStyle?: PostStyle
  location?: string
  locationData?: LocationResult
  imageUrl?: string  // Legacy single image
  images?: PostImage[]  // Multi-image support
  postType: "daily" | "photo" | "spontaneous"
  createdAt?: string
  privacyLevel?: 'public' | 'private' | 'custom'
  privacyRules?: string[]
  specificUsers?: number[]
}

interface EditPostModalProps {
  isOpen: boolean
  onClose: () => void
  post: Post
  onSubmit: (postData: {
    content: string
    richContent?: string
    postStyle?: PostStyle
    location?: string
    locationData?: LocationResult
    privacyLevel: 'public' | 'private' | 'custom'
    privacyRules: string[]
    specificUsers: number[]
  }) => void
}

// Character limits for automatic type detection
const CHARACTER_LIMITS = {
  daily: 5000,      // Universal limit for all text posts
  photo: 0,         // image-only
  spontaneous: 5000 // Same limit as daily posts - no artificial restriction
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
    imageUrl?: string
    location?: string | null
    locationData?: LocationResult | null
  }>({
    content: post.content || '',
    imageUrl: post.imageUrl || '',
    location: post.location || null,
    locationData: post.locationData || null
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const richTextEditorRef = useRef<RichTextEditorRef>(null)

  // Rich text and styling state (always enabled)
  const [richContent, setRichContent] = useState('')

  // Filter out font properties from post style to maintain consistency
  const filterPostStyleProperties = (style: PostStyle): PostStyle => {
    if (!style) return POST_STYLES[0]

    const filtered = { ...style }
    // Remove font properties as per task requirements
    delete filtered.fontFamily

    return filtered
  }

  const [selectedStyle, setSelectedStyle] = useState<PostStyle>(
    filterPostStyleProperties(post.postStyle || POST_STYLES[0])
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
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0)
  const [initialPrivacy, setInitialPrivacy] = useState<PostPrivacy>({
    privacyLevel: post.privacyLevel,
    privacyRules: post.privacyRules ?? [],
    specificUsers: post.specificUsers ?? [],
  })
  const initializedRef = useRef(false)

  const {
    privacyLevel,
    privacyRules,
    specificUsers,
    setPrivacyLevel,
    setPrivacyRules,
    setSpecificUsers,
  } = usePostPrivacyState(initialPrivacy)

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

  const hasImage = Boolean(postData.imageUrl) || Boolean(post.images && post.images.length > 0)

  // Always use plain text for analysis to avoid HTML tag length issues
  const getPlainTextContent = () => {
    if (richTextEditorRef.current) {
      return richTextEditorRef.current.getPlainText()
    }
    return postData.content
  }

  const contentForAnalysis = getPlainTextContent()
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

        // ✅ Ignore clicks inside background selector or its backdrop if open
        if (showBackgrounds && (target.closest('.background-selector') || target.closest('[data-backgrounds-modal]') || target.closest('[data-backgrounds-backdrop]'))) {
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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

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

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleViewportMode = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    handleViewportMode()
    mediaQuery.addEventListener('change', handleViewportMode)

    return () => {
      mediaQuery.removeEventListener('change', handleViewportMode)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !isMobileViewport || typeof window === 'undefined') return

    if (!window.visualViewport) {
      setMobileKeyboardInset(0)
      return
    }

    const viewport = window.visualViewport
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop))
      setMobileKeyboardInset(inset)
    }

    updateInset()
    viewport.addEventListener('resize', updateInset)
    viewport.addEventListener('scroll', updateInset)

    return () => {
      viewport.removeEventListener('resize', updateInset)
      viewport.removeEventListener('scroll', updateInset)
      setMobileKeyboardInset(0)
    }
  }, [isOpen, isMobileViewport])

  // Reset form when modal opens/closes or post changes
  useEffect(() => {
    if (isOpen) {
      if (!initializedRef.current) {
        setInitialPrivacy({
          privacyLevel: post.privacyLevel,
          privacyRules: post.privacyRules ?? [],
          specificUsers: post.specificUsers ?? [],
        })
        initializedRef.current = true
      }
      // Load existing post data including image
      setPostData({
        content: post.content || '',
        imageUrl: post.imageUrl || '',
        location: post.location || null,
        locationData: post.locationData || null
      })

      // Initialize rich content - preserve existing HTML formatting
      setRichContent(post.richContent || '')

      // Filter and set post style
      setSelectedStyle(filterPostStyleProperties(post.postStyle || POST_STYLES[0]))

      setError('')
      setIsSubmitting(false)

      // Focus on content editor after a short delay
      setTimeout(() => {
        if (richTextEditorRef.current) {
          richTextEditorRef.current.focus()
        }
      }, 100)
    } else {
      initializedRef.current = false
    }
  }, [isOpen, post])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Get content from the rich text editor
    const contentToSubmit = richContent || postData.content
    const finalPlainText = richTextEditorRef.current?.getPlainText() || ''

    const hasExistingImages = Boolean(post.images && post.images.length > 0) || Boolean(postData.imageUrl)

    // Allow image-only posts (no content required if there's an image)
    if (!contentToSubmit.trim() && !hasExistingImages) {
      setError('Please write something you\'re grateful for or add an image')
      return
    }

    if (finalPlainText.length > maxChars) {
      setError(`Content is too long. Maximum ${maxChars} characters for ${currentPostTypeInfo.name}`)
      return
    }

    setIsSubmitting(true)

    // Show loading toast
    const loadingToastId = showLoading(
      'Updating post...',
      'Saving your changes'
    )

    try {
      // Build payload - always include location fields to ensure proper clearing
      const payload = buildPostPayload(
        {
          content: contentToSubmit.trim(),
          richContent: richContent || null,
          postStyle: filterPostStyleProperties(selectedStyle),
          location: postData.location || null,
          locationData: postData.locationData || null,
          privacyLevel,
          privacyRules,
          specificUsers,
        },
        'edit'
      )

      await onSubmit(payload as any)

      // Hide loading toast and show success
      hideToast(loadingToastId)
      showSuccess(
        'Post Updated!',
        'Your changes have been saved successfully'
      )

      // Close modal on successful submission
      onClose()

    } catch (error: any) {
      // Hide loading toast and show error
      hideToast(loadingToastId)
      console.error('Post update error:', error)

      // Better error message extraction
      let errorMessage = 'Failed to update post. Please try again.'

      if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.error) {
        errorMessage = error.error
      } else if (error?.detail) {
        // Handle Pydantic validation errors (array of error objects)
        if (Array.isArray(error.detail)) {
          const firstError = error.detail[0]
          if (firstError && firstError.msg) {
            errorMessage = firstError.msg
          } else {
            errorMessage = 'Validation error occurred'
          }
        } else if (typeof error.detail === 'string') {
          errorMessage = error.detail
        } else {
          errorMessage = 'Validation error occurred'
        }
      }

      setError(errorMessage)
      showError(
        'Update Failed',
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

  // Rich text and styling handlers (same as CreatePostModal)
  const handleRichTextChange = (plainText: string, formattedText: string) => {
    setPostData({ ...postData, content: plainText })
    setRichContent(formattedText)
  }

  const handleRichTextMentionTrigger = (query: string, position: { x: number, y: number }, cursorPosition?: number) => {
    setMentionQuery(query)
    setMentionPosition(position)
    setShowMentionAutocomplete(true)

    // Use the provided cursor position to find mention start
    if (cursorPosition !== undefined) {
      // Get the current plain text from the editor (not from postData.content which might be stale)
      const currentContent = richTextEditorRef.current?.getPlainText() || postData.content
      const textBeforeCursor = currentContent.slice(0, cursorPosition)
      const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\-\.\?\!\+]*)$/)
      if (mentionMatch) {
        setCurrentMentionStart(cursorPosition - mentionMatch[0].length)
      }
    }
  }

  const handleRichTextMentionHide = () => {
    setShowMentionAutocomplete(false)
    setMentionQuery('')
    setCurrentMentionStart(-1)
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
      // Get the current plain text from the editor to ensure accuracy
      const currentContent = richTextEditorRef.current.getPlainText()

      // Find the end of the current partial mention
      let mentionEnd = currentMentionStart + 1 // Start after the @
      while (mentionEnd < currentContent.length &&
        /[a-zA-Z0-9_\-\.]/.test(currentContent[mentionEnd])) {
        mentionEnd++
      }

      // Use the RichTextEditor's insertMention method to handle the insertion properly
      richTextEditorRef.current.insertMention(user.username, currentMentionStart, mentionEnd)
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

  // Location handling functions
  const handleLocationSelect = (location: LocationResult | null) => {
    if (location) {
      setPostData(prev => ({
        ...prev,
        location: location.displayName,
        locationData: location
      }))
    } else {
      // Clear location data when null is passed
      setPostData(prev => ({
        ...prev,
        location: null,
        locationData: null
      }))
    }
    setShowLocationModal(false)
  }

  const handleLocationClear = () => {
    setPostData(prev => ({
      ...prev,
      location: null,
      locationData: null
    }))
  }

  // Background selector functions
  const handleShowBackgrounds = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setBackgroundsPosition({ x: rect.left, y: rect.bottom + 8 })
    setShowBackgrounds(true)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-30 z-40"
        onClick={(e) => {
          // Don't close if location modal is open
          if (e.target === e.currentTarget && !showLocationModal) {
            onClose()
          }
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4"
        style={{ paddingBottom: isMobileViewport ? `${mobileKeyboardInset}px` : undefined }}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-labelledby="modal-title"
          aria-modal="true"
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col"
          style={{ maxHeight: isMobileViewport ? '85dvh' : undefined }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
            <h2 id="modal-title" className="text-xl font-semibold text-gray-900 flex items-center min-w-0">
              Edit Your Gratitude
              <span className="text-xl ml-2" aria-hidden="true">💜</span>
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <PostPrivacySelector
                  privacyLevel={privacyLevel}
                  privacyRules={privacyRules}
                  specificUserIds={specificUsers}
                  onPrivacyLevelChange={setPrivacyLevel}
                  onPrivacyRulesChange={setPrivacyRules}
                  onSpecificUserIdsChange={setSpecificUsers}
                />
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label="Close modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {/* Content Input */}
              <div className="flex-1 p-4 sm:p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What are you grateful for?
                  </label>
                </div>

                {/* Content Editor - Always Rich Text */}
                <div className="relative">
                  <div className="border rounded-lg border-gray-300">
                    <RichTextEditor
                      ref={richTextEditorRef}
                      value={postData.content}
                      htmlValue={post.richContent || post.content || null}
                      onChange={handleRichTextChange}
                      placeholder="Share what you're grateful for today... (Use @username to mention someone)"
                      maxLength={maxChars}
                      onMentionTrigger={handleRichTextMentionTrigger}
                      onMentionHide={handleRichTextMentionHide}
                      selectedStyle={selectedStyle}
                      onStyleChange={setSelectedStyle}
                    />
                  </div>

                </div>

                {/* Toolbar - Style and Location buttons under textbox */}
                <div className="flex items-center justify-between pt-3 mt-3">
                  <div className="flex items-center space-x-3">
                    {/* Style Button */}
                    <button
                      type="button"
                      onClick={handleShowBackgrounds}
                      className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      <Brush className="h-4 w-4" />
                      <span className="text-sm font-medium">Style</span>
                    </button>

                    {/* Location Button */}
                    <button
                      type="button"
                      onClick={() => setShowLocationModal(true)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${postData.locationData
                        ? 'text-purple-600 bg-purple-50'
                        : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                    >
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {postData.locationData ? 'Location Added' : 'Location'}
                      </span>
                    </button>
                  </div>

                  {/* Character Count */}
                  <div className={`text-sm ${contentForAnalysis.length > maxChars * 0.9
                    ? 'text-red-500'
                    : 'text-gray-500'
                    }`}>
                    {contentForAnalysis.length}/{maxChars}
                  </div>
                </div>

                {/* Location Display */}
                {postData.locationData && (
                  <div className="flex items-center space-x-2 mt-2 p-2 bg-purple-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-purple-600" />
                    <div className="text-sm text-purple-700 font-medium truncate flex-1">
                      {postData.locationData.displayName}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLocationSelect(null)}
                      className="text-purple-600 hover:text-purple-800 transition-colors"
                      title="Remove location"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Multi-Image Display (read-only - editing images not yet supported) */}
                {/* Prioritize multi-image array over legacy imageUrl */}
                {post.images && post.images.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Attached Images ({post.images.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {[...post.images].sort((a, b) => a.position - b.position).map((img, index) => (
                        <div
                          key={img.id}
                          className="relative aspect-square rounded-lg overflow-hidden border border-gray-200"
                        >
                          <img
                            src={img.thumbnailUrl || img.mediumUrl}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black bg-opacity-60 flex items-center justify-center text-xs font-medium text-white">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy Single Image Preview (only show if no multi-images) */}
                {postData.imageUrl && !(post.images && post.images.length > 0) && (
                  <div className="mt-4">
                    <div className="relative inline-block group">
                      <img
                        src={postData.imageUrl}
                        alt="Post preview"
                        className="max-w-full h-32 object-cover rounded-lg border border-gray-200 transition-opacity group-hover:opacity-90"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 pb-6 pt-0" />
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-6 pb-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Predicted type: {currentPostTypeInfo.name}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center space-x-2"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{isSubmitting ? 'Updating...' : 'Update Post'}</span>
                  </button>
                </div>
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
