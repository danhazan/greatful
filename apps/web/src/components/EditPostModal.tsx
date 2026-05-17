"use client"

import { useState, useEffect, useRef } from "react"
import { X, MapPin, Brush, Loader2 } from "lucide-react"
import MentionAutocomplete from "./MentionAutocomplete"
import LocationModal from "./LocationModal"
import MinimalEmojiPicker from "./MinimalEmojiPicker"
import RichTextEditor from "./RichTextEditor"
import PostStyleSelector, { PostStyle, POST_STYLES } from "./PostStyleSelector"
import PostPrivacySelector from "./PostPrivacySelector"
import { usePostPrivacyState } from "@/hooks/usePostPrivacyState"
import { type PostPrivacy } from "@/types/post"
import { buildPostPayload } from "@/utils/postPayload"
import { usePostForm } from "@/hooks/usePostForm"
import InlineError from "./InlineError"

// Removed local UserInfo interface in favor of UserSearchResult from @/types/userSearch

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

// Universal character limit for posts
const MAX_CHARS = 5000

const DEFAULT_EDITOR_MAX_HEIGHT = 300
const MIN_EDITOR_MAX_HEIGHT = 140
const EDITOR_TRAY_GAP = 12

export default function EditPostModal({ isOpen, onClose, post, onSubmit }: EditPostModalProps) {
  // Toast ownership: PostCard's handler owns all toast lifecycle for post edits.
  // EditPostModal only uses setError() for inline form error display.

  // Filter out font properties from post style to maintain consistency
  const filterPostStyleProperties = (style: PostStyle): PostStyle => {
    if (!style) return POST_STYLES[0]
    const filtered = { ...style }
    delete filtered.fontFamily
    return filtered
  }

  const {
    postData, setPostData,
    isSubmitting, setIsSubmitting,
    error, setError,
    richContent, setRichContent,
    selectedStyle, setSelectedStyle,
    showBackgrounds, setShowBackgrounds,
    backgroundsPosition, setBackgroundsPosition,
    showMentionAutocomplete, setShowMentionAutocomplete,
    mentionQuery, setMentionQuery,
    mentionPosition, setMentionPosition,
    currentMentionStart, setCurrentMentionStart,
    showLocationModal, setShowLocationModal,
    isMobileViewport,
    mobileKeyboardInset,
    showEmojiPicker, setShowEmojiPicker,
    emojiEditorMaxHeight,
    modalRef,
    scrollableContentRef,
    emojiTrayRef,
    richTextEditorRef,
    contentForAnalysis,
    maxChars,
    handleRichTextChange,
    handleRichTextMentionTrigger,
    handleRichTextMentionHide,
    handleMentionSelect,
    handleMentionClose,
    handleEmojiPickerToggle,
    extractErrorMessage,
  } = usePostForm({
    isOpen,
    onClose,
    initialContent: post.content || '',
    initialRichContent: post.richContent || '',
    initialPostStyle: filterPostStyleProperties(post.postStyle || POST_STYLES[0]),
    initialPrivacy: {
      privacyLevel: post.privacyLevel,
      privacyRules: post.privacyRules ?? [],
      specificUsers: post.specificUsers ?? [],
    },
  })
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



  const hasImage = Boolean(postData.imageUrl) || Boolean(post.images && post.images.length > 0)

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
      setError(`Content is too long. Maximum ${maxChars} characters.`)
      return
    }

    setIsSubmitting(true)

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
          specificUsers: specificUsers.map((u) => u.id),
        },
        'edit'
      )

      await onSubmit(payload as any)

      // Close modal on successful submission
      // Toast handling is owned by PostCard's handler
      onClose()

    } catch (error: any) {
      console.error('Post update error:', error)

      // Extract error message for inline form display
      let errorMsg = 'Failed to update post. Please try again.'

      if (error?.message) {
        errorMsg = error.message
      } else if (typeof error === 'string') {
        errorMsg = error
      } else if (error?.error) {
        errorMsg = error.error
      } else if (error?.detail) {
        if (Array.isArray(error.detail)) {
          const firstError = error.detail[0]
          errorMsg = firstError?.msg || 'Validation error occurred'
        } else if (typeof error.detail === 'string') {
          errorMsg = error.detail
        } else {
          errorMsg = 'Validation error occurred'
        }
      }

      // Inline form error only — toast is owned by PostCard's handler
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
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
        className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:items-center sm:p-4"
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-labelledby="modal-title"
          aria-modal="true"
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col"
          style={{
            maxHeight: isMobileViewport
              ? `calc(100dvh - ${mobileKeyboardInset}px - 16px)`
              : undefined
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 sm:p-4 border-b border-gray-200">
            <h2 id="modal-title" className="text-base sm:text-xl font-semibold text-gray-900 flex items-center min-w-0">
              Edit Your Gratitude
              <span className="text-base sm:text-xl ml-2" aria-hidden="true">💜</span>
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <PostPrivacySelector
                  privacyLevel={privacyLevel}
                  privacyRules={privacyRules}
                  specificUsers={specificUsers}
                  onPrivacyLevelChange={setPrivacyLevel}
                  onPrivacyRulesChange={setPrivacyRules}
                  onSpecificUsersChange={setSpecificUsers}
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
            {/* Caption - stays visible above scrollable content */}
            <div className="shrink-0 px-4 py-1.5 sm:px-6 sm:pt-4 sm:pb-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">
                What are you grateful for?
              </label>
            </div>

            {/* Scrollable Content */}
            <div ref={scrollableContentRef} className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ overflowAnchor: 'none' }}>
              {/* Content Input */}
              <div className="flex-1 px-4 pb-4 sm:px-6 sm:pb-6">
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
                      emojiPickerMode="external"
                      emojiTrayOpen={showEmojiPicker}
                      editorMaxHeight={emojiEditorMaxHeight}
                      onEmojiPickerToggle={handleEmojiPickerToggle}
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
            <InlineError message={error} />

            {showEmojiPicker && (
              <div
                ref={emojiTrayRef}
                className="relative z-10 border-t border-gray-200 bg-white px-4 pb-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:px-6"
              >
                <MinimalEmojiPicker
                  isOpen={showEmojiPicker}
                  onClose={() => setShowEmojiPicker(false)}
                  onEmojiSelect={(emoji) => richTextEditorRef.current?.insertEmoji(emoji)}
                  variant="inline"
                  viewportInset={mobileKeyboardInset}
                />
              </div>
            )}

            {/* Footer */}
            <div className={`px-4 py-2 sm:px-6 sm:py-4 border-t border-gray-200 bg-gray-50 ${showEmojiPicker ? 'hidden' : ''}`}>
              <div className="flex items-center justify-end">
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 sm:py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center space-x-2 text-sm sm:text-base"
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
