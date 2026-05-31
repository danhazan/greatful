"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, MessageCircle, MessagesSquare, Pencil, Trash2, Smile, Heart } from "lucide-react"
import { formatTimeAgo } from "@/utils/timeAgo"
import ProfilePhotoDisplay from "./ProfilePhotoDisplay"
import { useToast } from "@/contexts/ToastContext"
import MinimalEmojiPicker from "./MinimalEmojiPicker"
import EmojiPicker from "./EmojiPicker"
import ReactionViewer from "./ReactionViewer"
import ReactionsBanner from "./ReactionsBanner"
import { insertEmojiIntoTextarea } from "@/utils/insertEmojiIntoTextarea"
import { useMobileViewport } from "@/hooks/useMobileViewport"
import { useMobileKeyboardInset } from "@/hooks/useMobileKeyboardInset"
import { useCommentReactions, type ReactionSummaryData } from "@/hooks/useImageReactions"
import { useReactionMutation } from "@/hooks/useReactionMutation"
import { useLongPress } from "@/hooks/useLongPress"
import { getEmojiFromCode, getTopEmojis } from "@/utils/emojiMapping"
import { MAX_COMMENT_CHARS } from "@/constants/limits"

interface CommentUser {
  id: number
  username: string
  displayName?: string
  profileImageUrl?: string
}

interface Comment {
  id: string
  postId: string
  userId: number
  content: string
  parentCommentId?: string
  createdAt: string
  updatedAt?: string
  editedAt?: string  // Timestamp when comment was edited
  user: CommentUser
  isReply: boolean
  replyCount: number  // For top-level comments: number of replies
  canDelete?: boolean  // For replies: whether this reply can be deleted (only last reply can be deleted)
}

interface CommentsModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  comments: Comment[]
  totalCommentsCount: number
  currentUserId?: number  // Current logged-in user ID for ownership checks
  onCommentSubmit: (content: string) => Promise<void>
  onReplySubmit: (commentId: string, content: string) => Promise<void>
  onLoadReplies: (commentId: string) => Promise<Comment[]>
  onCommentEdit?: (commentId: string, content: string) => Promise<Comment>  // Edit callback
  onCommentDelete?: (commentId: string) => Promise<void>  // Delete callback
  isSubmitting?: boolean
}

interface CommentReactionButtonProps {
  postId: string
  commentId: string
  reactionState: ReactionSummaryData
}

const COMMENT_REACTION_BUTTON_TEXT = {
  idle: 'React',
  active: 'Reacted'
} as const

function CommentReactionButton({ postId, commentId, reactionState }: CommentReactionButtonProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 })
  const hasUserReaction = Boolean(reactionState.userReaction)
  const { handleReaction, isInFlight } = useReactionMutation({
    postId,
    objectType: 'comment',
    objectId: commentId,
    currentReactionState: reactionState
  })

  const { handlers, consumeLongPress } = useLongPress({
    onLongPress: (target) => {
      if (isInFlight) return
      const rect = target.getBoundingClientRect()
      const pickerWidth = 320
      const x = Math.max(16, Math.min(rect.left + rect.width / 2 - pickerWidth / 2, window.innerWidth - pickerWidth - 16))
      setPickerPosition({ x, y: rect.bottom + 8 })
      setShowPicker(true)
    },
  })

  return (
    <>
      <button
        type="button"
        {...handlers}
        onClick={(event) => {
          if (consumeLongPress()) return
          if (isInFlight) return
          if (hasUserReaction) {
            handleReaction(null)
            return
          }

          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
          const pickerWidth = 320
          const x = Math.max(16, Math.min(rect.left + rect.width / 2 - pickerWidth / 2, window.innerWidth - pickerWidth - 16))
          setPickerPosition({ x, y: rect.bottom + 8 })
          setShowPicker(true)
        }}
        disabled={isInFlight}
        className={`text-xs font-medium min-h-[44px] sm:min-h-0 py-2 sm:py-0 px-2 sm:px-0 touch-manipulation focus:outline-none rounded flex items-center space-x-1 transition-colors ${
          hasUserReaction
            ? 'text-purple-600 hover:text-purple-700 active:text-purple-800'
            : 'text-gray-500 hover:text-purple-600 active:text-purple-700'
        } ${isInFlight ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={hasUserReaction ? 'Remove reaction from comment' : 'React to comment'}
        title={hasUserReaction ? 'Remove reaction' : 'React'}
      >
        {hasUserReaction && reactionState.userReaction ? (
          <span className="text-sm leading-none">{getEmojiFromCode(reactionState.userReaction)}</span>
        ) : (
          <Heart className="h-3 w-3 flex-shrink-0" />
        )}
        <span>{hasUserReaction ? COMMENT_REACTION_BUTTON_TEXT.active : COMMENT_REACTION_BUTTON_TEXT.idle}</span>
      </button>

      {showPicker && (
        <EmojiPicker
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onCancel={() => setShowPicker(false)}
          onEmojiSelect={(emoji) => {
            handleReaction(emoji)
            setShowPicker(false)
          }}
          currentReaction={reactionState.userReaction}
          position={pickerPosition}
          isLoading={isInFlight}
          anchor="top"
          compact
        />
      )}
    </>
  )
}

export default function CommentsModal({
  isOpen,
  onClose,
  postId,
  comments,
  totalCommentsCount,
  currentUserId,
  onCommentSubmit,
  onReplySubmit,
  onLoadReplies,
  onCommentEdit,
  onCommentDelete,
  isSubmitting = false
}: CommentsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const commentsContainerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const [commentText, setCommentText] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [composerEnabled, setComposerEnabled] = useState(false)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const [repliesCache, setRepliesCache] = useState<Record<string, Comment[]>>({})
  const [localComments, setLocalComments] = useState<Comment[]>(comments)
  const { showError } = useToast()

  // Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Delete state
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [reactionViewerCommentId, setReactionViewerCommentId] = useState<string | null>(null)
  const [textareaSelection, setTextareaSelection] = useState({ start: 0, end: 0 })
  const mutationRef = useRef<'comment' | 'reply' | 'edit' | 'delete' | null>(null)
  const lastReplyTargetRef = useRef<string | null>(null)
  const scrollToThreadBottomRef = useRef(false)
  const [hasPendingMutation, setHasPendingMutation] = useState(false)
  const isMobileViewport = useMobileViewport()
  const mobileKeyboardInset = useMobileKeyboardInset(isMobileViewport)
  const {
    isLoading: isLoadingCommentReactions,
    error: commentReactionsError,
    getReactionForComment,
    refetch: refetchCommentReactions
  } = useCommentReactions(postId, isOpen)

  const MAX_CHARS = MAX_COMMENT_CHARS
  const MAX_TEXTAREA_LINES = 4
  const getTextareaHeights = (element: HTMLTextAreaElement) => {
    const computedStyle = window.getComputedStyle(element)
    const fontSize = Number.parseFloat(computedStyle.fontSize) || 16
    const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight)
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.5
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0
    const borderTop = Number.parseFloat(computedStyle.borderTopWidth) || 0
    const borderBottom = Number.parseFloat(computedStyle.borderBottomWidth) || 0
    const verticalInsets = paddingTop + paddingBottom + borderTop + borderBottom

    return {
      singleLineHeight: lineHeight + verticalInsets,
      maxHeight: lineHeight * MAX_TEXTAREA_LINES + verticalInsets
    }
  }

  const resizeTextarea = (element: HTMLTextAreaElement) => {
    const { maxHeight } = getTextareaHeights(element)
    element.style.height = 'auto'
    const nextHeight = Math.min(element.scrollHeight, maxHeight)
    element.style.height = `${nextHeight}px`
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  const resetTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return

    const { singleLineHeight } = getTextareaHeights(element)
    element.style.height = `${singleLineHeight}px`
    element.style.overflowY = 'hidden'
    element.scrollTop = 0
  }

  const unlockCommentsScroll = () => {
    const container = commentsContainerRef.current
    if (!container) return
    container.style.overflowY = ''
  }

  const lockCommentsScroll = () => {
    const container = commentsContainerRef.current
    if (!container) return
    container.style.overflowY = 'hidden'
  }

  const clearReplyMode = () => {
    setReplyingTo(null)
    setComposerEnabled(false)
    setCommentText("")
    resetTextarea(commentInputRef.current)
    unlockCommentsScroll()
  }

  const clearEditMode = () => {
    setEditingCommentId(null)
    setCommentText("")
    resetTextarea(commentInputRef.current)
    unlockCommentsScroll()
  }

  const clearComposerModes = () => {
    setReplyingTo(null)
    setEditingCommentId(null)
    setCommentText("")
    resetTextarea(commentInputRef.current)
    unlockCommentsScroll()
  }

  // Sync local comments with prop changes
  useEffect(() => {
    setLocalComments(comments)
    // Don't clear expanded state or cache - keep the UI state intact
  }, [comments])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY

      // Prevent scrolling on body
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'

      return () => {
        // Restore scrolling
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''

        // Restore scroll position
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      unlockCommentsScroll()
      setReplyingTo(null)
      setEditingCommentId(null)
      setExpandedComments(new Set())
      setLoadingReplies(new Set())
      setRepliesCache({})
      // Reset edit/delete state
      setDeleteConfirmCommentId(null)
      setShowEmojiPicker(false)
      setReactionViewerCommentId(null)
      resetTextarea(commentInputRef.current)
    }
  }, [isOpen])

  // When the emoji tray opens OR the onscreen keyboard shrinks the modal while
  // an inline edit is active, scroll the container just enough to keep the edit
  // controls row (emoji btn / cancel / char count) visible at the container's
  // bottom edge.  We only need this for editing because the reply composer lives
  // outside the scroll container at modal level and is always visible.
  useEffect(() => {
    if (!editingCommentId) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = commentsContainerRef.current
        const controlsEl = container?.querySelector<HTMLElement>(`[data-edit-controls="${editingCommentId}"]`)
        if (!container || !controlsEl) return
        const overflow = controlsEl.getBoundingClientRect().bottom - container.getBoundingClientRect().bottom
        if (overflow > 0) {
          unlockCommentsScroll()
          container.scrollTop += overflow
          lockCommentsScroll()
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEmojiPicker, mobileKeyboardInset])

  // Scroll delete confirmation into view (Issue 3)
  useEffect(() => {
    if (!deleteConfirmCommentId) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = commentsContainerRef.current
        const el = container?.querySelector<HTMLElement>(`[data-delete-confirm="${deleteConfirmCommentId}"]`)
        if (!container || !el) return
        unlockCommentsScroll()
        const overflow = el.getBoundingClientRect().bottom - container.getBoundingClientRect().bottom
        if (overflow > 0) {
          container.scrollTop += overflow + 16
        }
      })
    })
  }, [deleteConfirmCommentId])

  // Auto-scroll to bottom when a new comment/reply is submitted optimistically
  useEffect(() => {
    if (!hasPendingMutation) return
    const mode = mutationRef.current
    if (mode !== 'comment' && mode !== 'reply') return
    // In reply mode, only scroll while thread is visible (not after replyingTo cleared)
    if (mode === 'reply' && !replyingTo) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (mutationRef.current === null) return
        const container = commentsContainerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    })
  }, [hasPendingMutation, replyingTo])

  // OverscrollBehavior during reply mode
  useEffect(() => {
    const container = commentsContainerRef.current
    if (replyingTo) {
      lastReplyTargetRef.current = replyingTo
      if (container) container.style.overscrollBehavior = 'contain'
    }
    return () => {
      if (container) container.style.overscrollBehavior = ''
    }
  }, [replyingTo])

  // Restore thread position when reply mode exits.
  // Cancel/failure: scroll parent to top.
  // Success:        scroll so the last reply is visible at the bottom.
  useEffect(() => {
    if (replyingTo || !lastReplyTargetRef.current) return
    const target = lastReplyTargetRef.current
    const scrollToBottom = scrollToThreadBottomRef.current
    lastReplyTargetRef.current = null
    scrollToThreadBottomRef.current = false
    const container = commentsContainerRef.current
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!container) return
        if (scrollToBottom) {
          // Find the last reply and scroll it into view
          const repliesSection = container.querySelector(`[data-replies-section="${target}"]`)
          if (repliesSection?.lastElementChild) {
            const lastRect = repliesSection.lastElementChild.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            if (lastRect.bottom > containerRect.bottom) {
              container.scrollTop += lastRect.bottom - containerRect.bottom + 16
            }
          }
        } else {
          // Scroll parent comment to container top
          const el = container.querySelector<HTMLElement>(`[data-comment-id="${target}"]`)
          if (el) {
            container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top
          }
        }
      })
    })
  }, [replyingTo])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reactionViewerCommentId) return

      const target = event.target as Element
      const isInsidePicker = !!target.closest('[data-minimal-emoji-picker]')
      const isInsideReactionPicker = !!target.closest('[data-emoji-picker]')
      const isInsideInput = !!target.closest('textarea')
      const isInsideEmojiTrigger = !!target.closest('[data-emoji-trigger]')
      const isInsideSubmit = !!target.closest('[data-submit-button]')
      const modalElement = modalRef.current
      const modalContainsTarget = !!modalElement?.contains(event.target as Node)
      const modalRect = modalElement?.getBoundingClientRect()
      // Geometry fallback is only valid when layout is measurable.
      // In test/edge rendering states, zero-sized rects can misclassify inside clicks.
      const hasMeasurableModalRect = !!modalRect && modalRect.width > 0 && modalRect.height > 0
      const pointInsideModal = hasMeasurableModalRect &&
        event.clientX >= modalRect.left &&
        event.clientX <= modalRect.right &&
        event.clientY >= modalRect.top &&
        event.clientY <= modalRect.bottom
      const isInsideModal = modalContainsTarget || pointInsideModal

      // Click-scope precedence:
      // 1) outside modal => close modal
      // 2) inside modal but outside picker => close picker only
      // 3) inside picker => keep both open
      // Modal boundary is authoritative. Only true outside clicks close the modal.
      if (isInsideReactionPicker) return

      if (!isInsideModal) {
        onClose()
        return
      }

      if (showEmojiPicker && !isInsidePicker && !isInsideInput && !isInsideEmojiTrigger && !isInsideSubmit) {
        setShowEmojiPicker(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, showEmojiPicker, reactionViewerCommentId])

  // Handle escape key and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (reactionViewerCommentId) {
          return
        }
        if (editingCommentId) {
          clearEditMode()
        } else if (deleteConfirmCommentId) {
          // Cancel delete confirmation
          setDeleteConfirmCommentId(null)
        } else if (replyingTo) {
          clearReplyMode()
        } else {
          onClose()
        }
      } else if (event.key === 'Tab') {
        // Allow tab navigation within modal
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    if (isOpen) {
      // Focus the modal when it opens
      if (modalRef.current) {
        modalRef.current.focus()
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [deleteConfirmCommentId, editingCommentId, isOpen, onClose, replyingTo, reactionViewerCommentId])

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || hasPendingMutation || isSubmitting) return

    // Close emoji picker explicitly (Issue 1)
    if (showEmojiPicker) setShowEmojiPicker(false)

    const content = commentText.trim()
    const mode = editingCommentId ? 'edit' : replyingTo ? 'reply' : 'comment'

    // Shared pending lifecycle
    mutationRef.current = mode
    setHasPendingMutation(true)

    // Optimistic: clear textbox immediately for new comments
    if (mode === 'comment') {
      setCommentText("")
      resetTextarea(commentInputRef.current)
    }

    // Error-recovery context for optimistic reply (Issue 2)
    let errorCtxReplyTarget: string | null = null
    let errorCtxTempReplyId: string | null = null

    try {
      switch (mode) {
        case 'edit': {
          if (!onCommentEdit) break
          const updatedComment = await onCommentEdit(editingCommentId!, content)
          setLocalComments(prev =>
            prev.map(c => c.id === editingCommentId ? { ...c, content: updatedComment.content, editedAt: updatedComment.editedAt } : c)
          )
          setRepliesCache(prev => {
            const newCache = { ...prev }
            for (const parentId of Object.keys(newCache)) {
              newCache[parentId] = newCache[parentId].map(r =>
                r.id === editingCommentId ? { ...r, content: updatedComment.content, editedAt: updatedComment.editedAt } : r
              )
            }
            return newCache
          })
          setEditingCommentId(null)
          setCommentText("")
          resetTextarea(commentInputRef.current)
          break
        }
        case 'reply': {
          const targetId = replyingTo!
          const tempReply: Comment = {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            postId,
            userId: currentUserId || 0,
            content,
            parentCommentId: targetId,
            createdAt: new Date().toISOString(),
            user: {
              id: currentUserId || 0,
              username: '',
              displayName: 'You',
              profileImageUrl: undefined,
            },
            isReply: true,
            replyCount: 0,
            canDelete: true,
          }
          errorCtxReplyTarget = targetId
          errorCtxTempReplyId = tempReply.id

          // Optimistic: hide composer but stay in thread mode
          setCommentText("")
          resetTextarea(commentInputRef.current)
          setComposerEnabled(false)
          setRepliesCache(prev => ({
            ...prev,
            [targetId]: [...(prev[targetId] || []), tempReply],
          }))
          setExpandedComments(prev => new Set(prev).add(targetId))

          await onReplySubmit(targetId, content)

          // Refresh with server data
          const freshReplies = await onLoadReplies(targetId)
          setRepliesCache(prev => ({ ...prev, [targetId]: freshReplies }))

          // Exit thread mode and flag scroll-to-thread-bottom
          scrollToThreadBottomRef.current = true
          setReplyingTo(null)
          break
        }
        case 'comment': {
          await onCommentSubmit(content)
          break
        }
      }
      unlockCommentsScroll()
    } catch (error) {
      // Remove optimistic reply on failure (Issue 2)
      const errTarget = errorCtxReplyTarget
      const errTempId = errorCtxTempReplyId
      if (errTarget && errTempId) {
        setRepliesCache(prev => ({
          ...prev,
          [errTarget]: (prev[errTarget] || []).filter(
            (r: Comment) => r.id !== errTempId
          ),
        }))
      }
      // Exit thread mode on reply failure
      if (errTarget) {
        setReplyingTo(null)
      }
      console.error('CommentsModal: Comment submission failed', error)
    } finally {
      mutationRef.current = null
      setHasPendingMutation(false)
    }
  }

  const updateTextareaSelection = (target: HTMLTextAreaElement) => {
    setTextareaSelection({
      start: target.selectionStart ?? 0,
      end: target.selectionEnd ?? 0
    })
  }

  const openEmojiPickerForInput = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return

    if (showEmojiPicker) {
      setShowEmojiPicker(false)
      return
    }

    updateTextareaSelection(textarea)
    setShowEmojiPicker(true)
  }

  const insertEmojiIntoActiveInput = (emoji: string) => {
    const textLengthAfterReplace = commentText.length - (textareaSelection.end - textareaSelection.start) + emoji.length
    if (textLengthAfterReplace > MAX_CHARS) {
      setShowEmojiPicker(false)
      return
    }

    const result = insertEmojiIntoTextarea(
      commentText,
      emoji,
      textareaSelection.start,
      textareaSelection.end
    )

    setCommentText(result.value)
    setTextareaSelection({ start: result.cursor, end: result.cursor })

    requestAnimationFrame(() => {
      const element = commentInputRef.current
      if (!element) return
      resizeTextarea(element)
      element.focus()
      element.setSelectionRange(result.cursor, result.cursor)
    })
  }

  // Start editing a comment — the editor renders inline, replacing the bubble.
  // scrollCommentToTop handles the double-rAF scroll-to-top + focus + lock.
  const handleStartEdit = (comment: Comment) => {
    clearReplyMode()
    setEditingCommentId(comment.id)
    setCommentText(comment.content)
    setDeleteConfirmCommentId(null)
    setShowEmojiPicker(false)
    scrollCommentToTop(comment.id)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    clearEditMode()
  }

  // Show delete confirmation
  const handleShowDeleteConfirm = (commentId: string) => {
    setDeleteConfirmCommentId(commentId)
    // Cancel any active edit
    clearEditMode()
    // Cancel any active reply
    clearReplyMode()
  }

  // Cancel delete confirmation
  const handleCancelDelete = () => {
    setDeleteConfirmCommentId(null)
  }

  // Confirm and execute delete
  const handleConfirmDelete = async (commentId: string) => {
    if (isDeleting || !onCommentDelete) return

    // Find parent comment ID if this is a reply (Issue 4)
    let parentCommentId: string | null = null
    for (const [pid, replies] of Object.entries(repliesCache)) {
      if (replies.some(r => r.id === commentId)) {
        parentCommentId = pid
        break
      }
    }

    setIsDeleting(true)
    try {
      await onCommentDelete(commentId)

      // Update local state - remove the deleted comment
      setLocalComments(prev => prev.filter(c => c.id !== commentId))

      // Also remove from replies cache if it's a reply
      setRepliesCache(prev => {
        const newCache = { ...prev }
        for (const pid of Object.keys(newCache)) {
          newCache[pid] = newCache[pid].filter(r => r.id !== commentId)
        }
        return newCache
      })

      setDeleteConfirmCommentId(null)

      // Refresh parent's replies to get fresh canDelete values (Issue 4)
      if (parentCommentId) {
        await loadReplies(parentCommentId, true)
      }

      // Toast ownership: PostCard's handler owns toast lifecycle for comment deletes
    } catch (error: any) {
      showError(error.message || "Failed to delete comment")
    } finally {
      setIsDeleting(false)
    }
  }

  const loadReplies = async (commentId: string, forceReload: boolean = false) => {
    // Skip if already loading, unless force reload is requested
    if (!forceReload && loadingReplies.has(commentId)) return

    setLoadingReplies(prev => new Set(prev).add(commentId))

    try {
      const replies = await onLoadReplies(commentId)
      setRepliesCache(prev => ({ ...prev, [commentId]: replies }))
      setExpandedComments(prev => new Set(prev).add(commentId))
    } catch (error) {
      showError("Failed to load replies")
    } finally {
      setLoadingReplies(prev => {
        const newSet = new Set(prev)
        newSet.delete(commentId)
        return newSet
      })
    }
  }

  const toggleReplies = async (commentId: string) => {
    if (expandedComments.has(commentId)) {
      // Collapse replies
      setExpandedComments(prev => {
        const newSet = new Set(prev)
        newSet.delete(commentId)
        return newSet
      })
    } else {
      // Expand replies - load if not cached
      if (!repliesCache[commentId]) {
        await loadReplies(commentId)
      } else {
        setExpandedComments(prev => new Set(prev).add(commentId))
      }
    }
  }

  // Check if current user owns the comment
  const isCommentOwner = (comment: Comment) => {
    return currentUserId !== undefined && currentUserId === comment.userId
  }

  // Check if deletion is allowed
  // Top-level comments: cannot delete if they have replies
  // Replies: can only delete the last reply chronologically (canDelete field from API)
  const canDeleteComment = (comment: Comment) => {
    if (comment.isReply) {
      // For replies, use the canDelete field from the API
      return comment.canDelete === true
    }
    // For top-level comments, check if there are no replies
    return comment.replyCount === 0
  }

  // Scroll the container so the target comment sits flush at the top, then lock.
  // Same pattern as handleStartEdit — inline composer renders below the replies
  // so no footer alignment is needed at all.
  const scrollCommentToTop = (commentId: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = commentsContainerRef.current
        const commentEl = container?.querySelector<HTMLElement>(`[data-comment-id="${commentId}"]`)
        if (container && commentEl) {
          container.scrollTop += commentEl.getBoundingClientRect().top - container.getBoundingClientRect().top
        }
        const input = commentInputRef.current
        if (input) {
          resizeTextarea(input)
          input.focus()
          input.setSelectionRange(input.value.length, input.value.length)
        }
        lockCommentsScroll()
      })
    })
  }

  const handleReplyToggle = (comment: Comment) => {
    if (replyingTo === comment.id) {
      clearReplyMode()
      return
    }

    clearEditMode()
    setDeleteConfirmCommentId(null)
    setCommentText("")
    setReplyingTo(comment.id)
    setComposerEnabled(true)

    // Focus reply composer (parent is at top naturally in thread-only view)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const input = commentInputRef.current
        if (input) {
          resizeTextarea(input)
          input.focus()
          input.setSelectionRange(input.value.length, input.value.length)
        }
      })
    })

    // Load replies if needed (they'll appear when loadReplies resolves)
    if (comment.replyCount > 0 && !expandedComments.has(comment.id)) {
      void loadReplies(comment.id)
    }
  }

  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isExpanded = expandedComments.has(comment.id)
    const isLoadingReplies = loadingReplies.has(comment.id)
    const replies = repliesCache[comment.id] || []
    const isReplyingToThis = replyingTo === comment.id
    const isDeletingThis = deleteConfirmCommentId === comment.id
    const isOwner = isCommentOwner(comment)
    const canDelete = canDeleteComment(comment)
    const reactionState = getReactionForComment(comment.id)
    const reactionEmojiCodes = getTopEmojis(reactionState.emojiCounts, 3).map(({ code }) => code)

    // Format time to show - use editedAt if available, otherwise createdAt
    const displayTime = comment.editedAt || comment.createdAt
    const isEdited = !!comment.editedAt

    return (
      <div
        key={comment.id}
        className={`${isReply ? 'ml-8 sm:ml-12' : ''} space-y-2`}
        role="article"
        aria-label={`Comment by ${comment.user.displayName || comment.user.username}`}
        data-comment-id={comment.id}
      >
        <div className="flex space-x-3">
          {/* User Profile Picture */}
          <div className="flex-shrink-0">
            <a href={`/profile/${comment.user.id}`} aria-label={`${comment.user.displayName || comment.user.username}'s profile`}>
              <ProfilePhotoDisplay
                photoUrl={comment.user.profileImageUrl}
                username={comment.user.username}
                size="sm"
                className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              />
            </a>
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            {/* User Info */}
            <div className="flex items-baseline space-x-2 flex-wrap" data-comment-header={comment.id}>
              <a
                href={`/profile/${comment.user.id}`}
                className="font-bold text-gray-900 text-sm hover:text-purple-600 transition-colors no-underline"
              >
                {comment.user.displayName || comment.user.username}
              </a>
              <a
                href={`/profile/${comment.user.id}`}
                className="text-gray-500 hover:text-purple-600 transition-colors text-xs no-underline"
              >
                @{comment.user.username}
              </a>
              <span className="text-gray-400 text-xs">
                {formatTimeAgo(displayTime)}
                {isEdited && <span className="ml-1 text-gray-400">(edited)</span>}
              </span>
            </div>

            {editingCommentId === comment.id ? (
              /* ── Inline editor: replaces the bubble and action bar ── */
              <div className="mt-0.5 w-full">
                <div className="relative">
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => {
                      setCommentText(e.target.value.slice(0, MAX_CHARS))
                      resizeTextarea(e.target)
                    }}
                    onFocus={(e) => updateTextareaSelection(e.currentTarget)}
                    onClick={(e) => updateTextareaSelection(e.currentTarget)}
                    onKeyUp={(e) => updateTextareaSelection(e.currentTarget)}
                    onSelect={(e) => updateTextareaSelection(e.currentTarget)}
                    className="w-full px-3 py-2 sm:px-5 sm:py-3 pr-10 bg-purple-50 border-2 border-purple-400 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-y-hidden text-sm text-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-300"
                    maxLength={MAX_CHARS}
                    disabled={hasPendingMutation}
                    aria-label="Edit comment"
                    aria-describedby="edit-comment-char-count"
                    style={{ boxSizing: 'border-box' }}
                  />
                    <button
                        onClick={handleCommentSubmit}
                        onMouseDown={(e) => e.preventDefault()}
                        disabled={!commentText.trim() || isSubmitting || hasPendingMutation}
                        data-submit-button
                        className="absolute right-2 top-2 p-1.5 text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-purple-100 active:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        aria-label="Save comment edit"
                      >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                </div>
                {/* Controls row */}
                <div
                  id="edit-comment-char-count"
                  className="mt-1 flex items-center justify-between"
                  aria-live="polite"
                  data-edit-controls={comment.id}
                >
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openEmojiPickerForInput(commentInputRef.current)}
                      data-emoji-trigger
                      className="p-1 text-purple-600 hover:text-purple-700 transition-colors rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      aria-label="Open emoji picker"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    {commentText.length}/{MAX_CHARS}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Comment bubble */}
                <div className="mt-0.5 bg-purple-50 rounded-2xl px-3 py-2 sm:px-5 sm:py-3 inline-block max-w-full">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>

                {reactionState.totalCount > 0 && !commentReactionsError && (
                  <ReactionsBanner
                    totalCount={reactionState.totalCount}
                    emojiCodes={reactionEmojiCodes}
                    onClick={isLoadingCommentReactions ? undefined : () => setReactionViewerCommentId(comment.id)}
                    className="mt-1 mb-0"
                  />
                )}

                {commentReactionsError && reactionState.totalCount > 0 && (
                  <button
                    type="button"
                    onClick={refetchCommentReactions}
                    className="mt-1 text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Reaction sync error. Tap to retry.
                  </button>
                )}

                {/* Delete Confirmation */}
                {isDeletingThis && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg" data-delete-confirm={comment.id}>
                    <p className="text-sm text-red-700 mb-2">Are you sure you want to delete this comment?</p>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleConfirmDelete(comment.id)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <span>Delete</span>
                        )}
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!isDeletingThis && (
                  <div className="overflow-x-auto mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="inline-flex items-center gap-2 sm:gap-4 flex-nowrap w-max">
                    <CommentReactionButton
                      postId={postId}
                      commentId={comment.id}
                      reactionState={reactionState}
                    />

                    {/* Reply Button - only for top-level comments */}
                    {!isReply && (
                      <button
                        onClick={() => handleReplyToggle(comment)}
                        disabled={hasPendingMutation}
                        className={`text-xs font-medium min-h-[44px] sm:min-h-0 py-2 sm:py-0 px-2 sm:px-0 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded flex items-center space-x-1 min-w-0 flex-shrink [-webkit-tap-highlight-color:transparent] transition-colors ${
                          hasPendingMutation
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-purple-600 active:text-purple-700'
                        }`}
                        aria-label={isReplyingToThis ? `Cancel reply to ${comment.user.displayName || comment.user.username}` : `Reply to ${comment.user.displayName || comment.user.username}'s comment`}
                      >
                        {isReplyingToThis ? null : <Send className="h-3 w-3 flex-shrink-0" />}
                        <span>{isReplyingToThis ? 'Cancel' : 'Reply'}</span>
                      </button>
                    )}

                    {/* Show/Hide Replies Button */}
                    {!isReply && comment.replyCount > 0 && (
                      <button
                        onClick={() => toggleReplies(comment.id)}
                        disabled={isLoadingReplies}
                        className="text-xs text-purple-600 hover:text-purple-700 transition-colors font-medium flex items-center space-x-1 min-h-[44px] sm:min-h-0 py-2 sm:py-0 px-2 sm:px-0 touch-manipulation active:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded [-webkit-tap-highlight-color:transparent]"
                        aria-label={isExpanded ? `Hide ${comment.replyCount} replies` : `Show ${comment.replyCount} replies`}
                        aria-expanded={isExpanded}
                      >
                        {isLoadingReplies ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                            <span className="truncate">Loading...</span>
                          </>
                        ) : (
                          <>
                            <MessagesSquare className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              <span className="hidden min-[400px]:inline">{isExpanded ? 'Hide' : 'Show'} </span>
                              {comment.replyCount}
                              <span className="hidden sm:inline"> {comment.replyCount === 1 ? 'reply' : 'replies'}</span>
                            </span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Owner Actions: Edit & Delete */}
                    {isOwner && onCommentEdit && (
                      <button
                        onClick={() => handleStartEdit(comment)}
                        disabled={hasPendingMutation}
                        className={`text-xs font-medium min-h-[44px] sm:min-h-0 py-2 sm:py-0 px-2 sm:px-0 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded flex items-center space-x-1 min-w-0 flex-shrink [-webkit-tap-highlight-color:transparent] transition-colors ${
                          hasPendingMutation
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-purple-600 active:text-purple-700'
                        }`}
                        aria-label="Edit comment"
                      >
                        <Pencil className="h-3 w-3 flex-shrink-0" />
                        <span>Edit</span>
                      </button>
                    )}

                    {isOwner && onCommentDelete && (
                      <button
                        onClick={() => canDelete ? handleShowDeleteConfirm(comment.id) : undefined}
                        disabled={!canDelete}
                        className={`text-xs font-medium min-h-[44px] sm:min-h-0 py-2 sm:py-0 px-2 sm:px-0 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded flex items-center space-x-1 transition-colors min-w-0 flex-shrink relative group [-webkit-tap-highlight-color:transparent] ${
                          canDelete
                            ? 'text-red-500 hover:text-red-600 active:text-red-700'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        aria-label={canDelete ? "Delete comment" : (isReply ? "Cannot delete reply with later replies" : "Cannot delete comment with replies")}
                      >
                        <Trash2 className="h-3 w-3 flex-shrink-0" />
                        <span>Delete</span>
                        {!canDelete && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap pointer-events-none z-10 hidden group-hover:block">
                            {isReply
                              ? "Only the last reply in a thread can be deleted."
                              : "This comment has replies and cannot be deleted."}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                          </div>
                        )}
                      </button>
                    )}
                    </div>
                  </div>
                )}
              </>
            )}
            
          </div>
        </div>

        {/* Render Replies */}
        {isExpanded && replies.length > 0 && (
          <div
            className="space-y-3 mt-3"
            role="list"
            aria-label="Replies"
            data-replies-section={comment.id}
          >
            {replies.map(reply => renderComment(reply, true))}
          </div>
        )}


      </div>
    )
  }

  if (!isOpen) return null

  // Used by the modal-level reply composer (reply mode is no longer inline)
  const replyTargetComment = replyingTo ? localComments.find(c => c.id === replyingTo) : null
  const replyTargetName = replyTargetComment?.user.displayName || replyTargetComment?.user.username || ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-6"
      style={{ paddingBottom: isMobileViewport ? `${mobileKeyboardInset}px` : undefined }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" aria-hidden="true" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-modal-title"
        aria-describedby="comments-modal-description"
        className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col touch-manipulation z-10"
        style={{ maxHeight: isMobileViewport ? '85dvh' : undefined }}
        tabIndex={-1}
      >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 id="comments-modal-title" className="text-lg font-semibold text-gray-900">
              Comments ({totalCommentsCount})
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              aria-label="Close comments modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content - Scrollable Comments List */}
          <div
            ref={commentsContainerRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 select-text"
            role="main"
            style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
          >
            {replyingTo && replyTargetComment ? (
              renderComment(replyTargetComment)
            ) : localComments.length === 0 ? (
              <div className="text-center py-8" role="status" aria-label="No comments yet">
                <div className="text-gray-400 text-4xl mb-4" aria-hidden="true">💬</div>
                <p className="text-gray-500">No comments yet</p>
                <p id="comments-modal-description" className="text-sm text-gray-400 mt-1">
                  Be the first to comment!
                </p>
              </div>
            ) : (
              <div className="space-y-4" role="list" aria-label="Comments">
                <div className="sr-only" id="comments-modal-description">
                  List of comments on this post. Use tab to navigate through comments and replies.
                </div>
                {localComments.map(comment => renderComment(comment))}
              </div>
            )}
          </div>

          {/* ── Modal-level reply composer ───────────────────────────────────────
               Lives outside the locked scroll container so the emoji tray can sit
               immediately below it with no gap and no scroll adjustment needed.   */}
          {replyingTo && composerEnabled && (
            <div className="border-t border-purple-100 bg-white px-4 sm:px-6 py-3">
              <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(e) => {
                    setCommentText(e.target.value.slice(0, MAX_CHARS))
                    resizeTextarea(e.target)
                  }}
                  onFocus={(e) => updateTextareaSelection(e.currentTarget)}
                  onClick={(e) => updateTextareaSelection(e.currentTarget)}
                  onKeyUp={(e) => updateTextareaSelection(e.currentTarget)}
                  onSelect={(e) => updateTextareaSelection(e.currentTarget)}
                  placeholder={`Reply to ${replyTargetName}...`}
                  className="w-full px-3 py-2 sm:px-5 sm:py-3 pr-10 bg-white border-2 border-purple-400 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-y-hidden text-sm text-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-300"
                  maxLength={MAX_CHARS}
                  disabled={hasPendingMutation}
                  aria-label={`Reply to ${replyTargetName}`}
                  aria-describedby="reply-composer-char-count"
                  style={{ boxSizing: 'border-box' }}
                />
                <button
                  onClick={handleCommentSubmit}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!commentText.trim() || isSubmitting || hasPendingMutation}
                  data-submit-button
                  className="absolute right-2 top-2 p-1.5 text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-purple-100 active:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label="Post reply"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div
                id="reply-composer-char-count"
                className="mt-1 flex items-center justify-between"
                aria-live="polite"
              >
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => openEmojiPickerForInput(commentInputRef.current)}
                    data-emoji-trigger
                    className="p-1 text-purple-600 hover:text-purple-700 transition-colors rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label="Open emoji picker"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={clearReplyMode}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
                <div className="text-xs text-gray-400 text-right">
                  {commentText.length}/{MAX_CHARS}
                </div>
              </div>
            </div>
          )}

          {/* ── Emoji tray ───────────────────────────────────────────────────────────
               Always adjacent to whichever composer is active (edit: just below the
               scroll container; reply: just below the modal-level reply composer).
               Never inside the scroll container so it can never be clipped.        */}
          {(editingCommentId || replyingTo) && (
            <MinimalEmojiPicker
              isOpen={showEmojiPicker}
              onClose={() => setShowEmojiPicker(false)}
              onEmojiSelect={insertEmojiIntoActiveInput}
              variant="inline"
              viewportInset={mobileKeyboardInset}
              className="border-t border-gray-100 px-4 sm:px-6 py-2"
            />
          )}

          {/* Footer — new top-level comment only.
               Edit and reply are both handled inline above their respective comments. */}
          <div ref={footerRef} className="border-t border-gray-200 bg-gray-50">
            {editingCommentId || replyingTo ? (
              /* Neutral placeholder while an inline edit or reply is open */
              <div className="p-4 sm:p-6">
                <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-sm text-gray-400 select-none">
                  {editingCommentId ? 'Editing comment above…' : 'Replying above…'}
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <div className="relative">
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => {
                      setCommentText(e.target.value.slice(0, MAX_CHARS))
                      resizeTextarea(e.target)
                    }}
                    onFocus={(e) => updateTextareaSelection(e.currentTarget)}
                    onClick={(e) => updateTextareaSelection(e.currentTarget)}
                    onKeyUp={(e) => updateTextareaSelection(e.currentTarget)}
                    onSelect={(e) => updateTextareaSelection(e.currentTarget)}
                    placeholder="Add a comment..."
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none overflow-y-auto text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-300"
                    rows={1}
                    maxLength={MAX_CHARS}
                    disabled={hasPendingMutation}
                    aria-label="Add a comment"
                    aria-describedby="comment-char-count"
                    style={{ minHeight: '44px', WebkitTextFillColor: '#111827', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={handleCommentSubmit}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={!commentText.trim() || isSubmitting || hasPendingMutation}
                    data-submit-button
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-purple-50 active:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label="Post comment"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <div
                  id="comment-char-count"
                  className="mt-1 flex items-center justify-between"
                  aria-live="polite"
                >
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openEmojiPickerForInput(commentInputRef.current)}
                      data-emoji-trigger
                      className="p-1 text-purple-600 hover:text-purple-700 transition-colors rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      aria-label="Open emoji picker for comment"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    {commentText.length}/{MAX_CHARS}
                  </div>
                </div>
                <MinimalEmojiPicker
                  isOpen={showEmojiPicker}
                  onClose={() => setShowEmojiPicker(false)}
                  onEmojiSelect={insertEmojiIntoActiveInput}
                  variant="inline"
                  viewportInset={mobileKeyboardInset}
                  className="mt-4"
                />
              </div>
            )}
          </div>
        </div>

        {reactionViewerCommentId && (
          <ReactionViewer
            isOpen={!!reactionViewerCommentId}
            onClose={() => setReactionViewerCommentId(null)}
            postId={postId}
            objectType="comment"
            objectId={reactionViewerCommentId}
          />
        )}
      </div>
  )
}
