import { useState, useRef, useEffect, useCallback } from "react"
import { UserSearchResult } from "@/types/userSearch"
import { PostPrivacy } from "@/types/post"
import { PostStyle, POST_STYLES } from "@/components/PostStyleSelector"
import { RichTextEditorRef } from "@/components/RichTextEditor"
import { useMobileViewport } from "./useMobileViewport"
import { useMobileKeyboardInset } from "./useMobileKeyboardInset"
import { MAX_POST_CHARS } from "@/constants/limits"

export { POST_STYLES }
export type { PostStyle, PostPrivacy }

// Universal character limit for posts
export const MAX_CHARS = MAX_POST_CHARS

export const DEFAULT_EDITOR_MAX_HEIGHT = 300
export const MIN_EDITOR_MAX_HEIGHT = 140
export const EDITOR_TRAY_GAP = 12

// Location result type
export interface LocationResult {
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

export interface UsePostFormOptions {
  isOpen: boolean
  onClose: () => void
  initialContent?: string
  initialRichContent?: string
  initialPostStyle?: PostStyle
  initialPrivacy?: PostPrivacy
}

export function usePostForm({
  isOpen,
  onClose,
  initialContent = '',
  initialRichContent = '',
  initialPostStyle,
  initialPrivacy,
}: UsePostFormOptions) {
  const [postData, setPostData] = useState<{
    content: string
    imageUrl?: string
    location?: string | null
    locationData?: LocationResult | null
  }>({
    content: initialContent,
    imageUrl: '',
    location: null,
    locationData: null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const modalRef = useRef<HTMLDivElement>(null)
  const scrollableContentRef = useRef<HTMLDivElement>(null)
  const emojiTrayRef = useRef<HTMLDivElement>(null)
  const richTextEditorRef = useRef<RichTextEditorRef>(null)

  const [richContent, setRichContent] = useState(initialRichContent)
  const [selectedStyle, setSelectedStyle] = useState<PostStyle>(
    initialPostStyle || POST_STYLES[0]
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
  const isMobileViewport = useMobileViewport()
  const mobileKeyboardInset = useMobileKeyboardInset(isMobileViewport)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiEditorMaxHeight, setEmojiEditorMaxHeight] = useState<number | null>(null)

  const hasImage = Boolean(postData.imageUrl)

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
  const maxChars = MAX_CHARS

  // Rich text handlers
  const handleRichTextChange = (plainText: string, formattedText: string) => {
    setPostData({ ...postData, content: plainText })
    setRichContent(formattedText)
  }

  const handleRichTextMentionTrigger = (query: string, position: { x: number, y: number }, cursorPosition?: number) => {
    setMentionQuery(query)
    setMentionPosition(position)
    setShowMentionAutocomplete(true)
    if (cursorPosition !== undefined) {
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

  const handleMentionSelect = (user: UserSearchResult) => {
    if (currentMentionStart >= 0 && richTextEditorRef.current) {
      const currentContent = richTextEditorRef.current.getPlainText()
      let mentionEnd = currentMentionStart + 1
      while (mentionEnd < currentContent.length && /[a-zA-Z0-9_\-\.]/.test(currentContent[mentionEnd])) {
        mentionEnd++
      }
      richTextEditorRef.current.insertMention(user.username || '', currentMentionStart, mentionEnd)
    }
    setShowMentionAutocomplete(false)
    setMentionQuery('')
    setCurrentMentionStart(-1)
  }

  const handleMentionClose = useCallback(() => {
    setShowMentionAutocomplete(false)
    setMentionQuery('')
    setCurrentMentionStart(-1)
  }, [])

  // Emoji picker
  const handleEmojiPickerToggle = useCallback(() => {
    setShowEmojiPicker(prev => {
      const next = !prev
      if (next) {
        scrollableContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return next
    })
  }, [])

  const updateEmojiEditorMaxHeight = useCallback(() => {
    if (!showEmojiPicker) {
      setEmojiEditorMaxHeight(null)
      return
    }

    const modal = modalRef.current
    const tray = emojiTrayRef.current
    const editorShell = richTextEditorRef.current?.getEditorShell()

    if (!modal || !tray || !editorShell) {
      setEmojiEditorMaxHeight(DEFAULT_EDITOR_MAX_HEIGHT)
      return
    }

    const availableShellHeight = tray.getBoundingClientRect().top - editorShell.getBoundingClientRect().top - EDITOR_TRAY_GAP
    const toolbarHeight = richTextEditorRef.current?.getToolbarHeight() ?? 0
    const nextMaxHeight = Math.max(
      MIN_EDITOR_MAX_HEIGHT,
      Math.floor(availableShellHeight - toolbarHeight)
    )

    setEmojiEditorMaxHeight(nextMaxHeight)
  }, [showEmojiPicker])

  // Reset emoji state on close
  useEffect(() => {
    if (!isOpen) {
      setShowEmojiPicker(false)
      setEmojiEditorMaxHeight(null)
    }
  }, [isOpen])

  // Emoji layout recalculation on resize
  useEffect(() => {
    if (!isOpen || !showEmojiPicker || typeof window === 'undefined') return

    const updateLayout = () => updateEmojiEditorMaxHeight()
    const frame = window.requestAnimationFrame(updateLayout)
    window.addEventListener('resize', updateLayout)

    const viewport = window.visualViewport
    viewport?.addEventListener('resize', updateLayout)
    viewport?.addEventListener('scroll', updateLayout)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateLayout)
      viewport?.removeEventListener('resize', updateLayout)
      viewport?.removeEventListener('scroll', updateLayout)
    }
  }, [isOpen, showEmojiPicker, updateEmojiEditorMaxHeight, mobileKeyboardInset])

  // Escape key layered dismiss + mention autocomplete navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showMentionAutocomplete && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        return
      }

      if (event.key === 'Escape') {
        if (showMentionAutocomplete) {
          handleMentionClose()
        } else if (showEmojiPicker) {
          setShowEmojiPicker(false)
        } else {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, showEmojiPicker, showMentionAutocomplete, handleMentionClose])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      const clickedInsideModal = !!modalRef.current?.contains(event.target as Node)

      if (clickedInsideModal) {
        const editorShell = richTextEditorRef.current?.getEditorShell()
        const isInsideEditor = !!editorShell?.contains(event.target as Node)
        const isInsideTray = !!target.closest('[data-minimal-emoji-picker]')
        const isInsideEmojiTrigger = !!target.closest('[data-emoji-trigger]')

        if (showEmojiPicker && !isInsideEditor && !isInsideTray && !isInsideEmojiTrigger) {
          setShowEmojiPicker(false)
        }
        return
      }

      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (showLocationModal && target.closest('[data-location-modal]')) return
        if (target.closest('[data-mention-autocomplete]')) return
        if (showBackgrounds && (target.closest('.background-selector') || target.closest('[data-backgrounds-modal]') || target.closest('[data-backgrounds-backdrop]'))) return
        if (target.closest('.rich-text-toolbar') || target.closest('[data-rich-text-modal]')) return

        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, showBackgrounds, showEmojiPicker, showLocationModal])

  // Extract error message from various API error shapes
  const extractErrorMessage = (error: any): string => {
    if (error?.message) return error.message
    if (typeof error === 'string') return error
    if (error?.error) return error.error
    if (error?.detail) {
      if (Array.isArray(error.detail)) {
        const firstError = error.detail[0]
        return firstError?.msg || 'Validation error occurred'
      }
      if (typeof error.detail === 'string') return error.detail
      return 'Validation error occurred'
    }
    return 'An unexpected error occurred. Please try again.'
  }

  return {
    // State
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

    // Refs
    modalRef,
    scrollableContentRef,
    emojiTrayRef,
    richTextEditorRef,

    // Computed
    hasImage,
    contentForAnalysis,
    trimmed,
    wordCount,
    maxChars,

    // Handlers
    handleRichTextChange,
    handleRichTextMentionTrigger,
    handleRichTextMentionHide,
    handleMentionSelect,
    handleMentionClose,
    handleEmojiPickerToggle,
    extractErrorMessage,
  }
}
