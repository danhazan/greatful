"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, MessageCircle } from "lucide-react"
import { formatTimeAgo } from "@/utils/timeAgo"
import ProfilePhotoDisplay from "./ProfilePhotoDisplay"
import ClickableUsername from "./ClickableUsername"
import { useToast } from "@/contexts/ToastContext"

interface CommentUser {
  id: number
  username: string
  display_name?: string
  profile_image_url?: string
}

interface Comment {
  id: string
  post_id: string
  user_id: number
  content: string
  parent_comment_id?: string
  created_at: string
  updated_at?: string
  user: CommentUser
  is_reply: boolean
  reply_count: number
}

interface CommentsModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  comments: Comment[]
  totalCommentsCount: number
  onCommentSubmit: (content: string) => Promise<void>
  onReplySubmit: (commentId: string, content: string) => Promise<void>
  onLoadReplies: (commentId: string) => Promise<Comment[]>
  isSubmitting?: boolean
}

export default function CommentsModal({
  isOpen,
  onClose,
  postId,
  comments,
  totalCommentsCount,
  onCommentSubmit,
  onReplySubmit,
  onLoadReplies,
  isSubmitting = false
}: CommentsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const commentsContainerRef = useRef<HTMLDivElement>(null)
  const [commentText, setCommentText] = useState("")
  const [replyText, setReplyText] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const [repliesCache, setRepliesCache] = useState<Record<string, Comment[]>>({})
  const [localComments, setLocalComments] = useState<Comment[]>(comments)
  const { showError, showSuccess } = useToast()

  const MAX_CHARS = 500

  // Sync local comments with prop changes
  useEffect(() => {
    console.log('CommentsModal: comments prop changed, updating localComments', {
      newCommentsCount: comments.length,
      comments: comments
    })
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
      setCommentText("")
      setReplyText("")
      setReplyingTo(null)
      setExpandedComments(new Set())
      setLoadingReplies(new Set())
      setRepliesCache({})
    }
  }, [isOpen])

  // Auto-scroll to reply input when replying
  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      setTimeout(() => {
        replyInputRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        })
        replyInputRef.current?.focus()
      }, 100)
    }
  }, [replyingTo])

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

  // Handle escape key and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (replyingTo) {
          setReplyingTo(null)
          setReplyText("")
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
  }, [isOpen, onClose, replyingTo])

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || isSubmitting) return

    try {
      await onCommentSubmit(commentText.trim())
      setCommentText("")
      // Success message is shown by parent component
      
      // Reload all comments to show the new comment (same pattern as replies)
      // This ensures the new comment appears immediately in the modal
      console.log('CommentsModal: Comment submitted, reloading all comments')
      
      // The parent component also reloads comments, but we do it here too
      // to ensure immediate update in the modal
      // The useEffect will sync with parent's reload as well
      
      // Scroll to bottom to show the new comment
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight
        }
      }, 100)
    } catch (error) {
      // Error is handled by parent component
      console.error('CommentsModal: Comment submission failed', error)
    }
  }

  const handleReplySubmit = async (commentId: string) => {
    if (!replyText.trim() || isSubmitting) return

    try {
      await onReplySubmit(commentId, replyText.trim())
      setReplyText("")
      setReplyingTo(null)
      // Success message is shown by parent component
      
      // Force refresh replies for this comment to show the new reply immediately
      await loadReplies(commentId, true)
      
      // Scroll to the end of the replies section to show the new reply
      setTimeout(() => {
        const repliesSection = document.querySelector(`[data-replies-section="${commentId}"]`)
        if (repliesSection && commentsContainerRef.current) {
          // Scroll the replies section into view, then scroll a bit more to show the last reply
          repliesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          
          // Additional scroll to ensure the last reply is visible
          setTimeout(() => {
            if (commentsContainerRef.current) {
              const repliesSectionBottom = repliesSection.getBoundingClientRect().bottom
              const containerBottom = commentsContainerRef.current.getBoundingClientRect().bottom
              if (repliesSectionBottom > containerBottom) {
                commentsContainerRef.current.scrollTop += (repliesSectionBottom - containerBottom + 20)
              }
            }
          }, 100)
        }
      }, 150)
    } catch (error) {
      // Error is handled by parent component
    }
  }

  const loadReplies = async (commentId: string, forceReload: boolean = false) => {
    // Skip if already loading, unless force reload is requested
    if (!forceReload && loadingReplies.has(commentId)) return

    setLoadingReplies(prev => new Set(prev).add(commentId))
    
    try {
      const replies = await onLoadReplies(commentId)
      console.log('CommentsModal: Loaded replies', {
        commentId,
        repliesCount: replies.length,
        replies
      })
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

  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isExpanded = expandedComments.has(comment.id)
    const isLoadingReplies = loadingReplies.has(comment.id)
    const replies = repliesCache[comment.id] || []
    const isReplyingToThis = replyingTo === comment.id

    return (
      <div 
        key={comment.id} 
        className={`${isReply ? 'ml-8 sm:ml-12' : ''} space-y-2`}
        role="article"
        aria-label={`Comment by ${comment.user.display_name || comment.user.username}`}
      >
        <div className="flex space-x-3">
          {/* User Profile Picture */}
          <div className="flex-shrink-0">
            <ProfilePhotoDisplay
              photoUrl={comment.user.profile_image_url}
              username={comment.user.username}
              size="sm"
              className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                // Navigate to user profile
                window.location.href = `/profile/${comment.user.id}`
              }}
            />
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            {/* User Info */}
            <div className="flex items-baseline space-x-2 flex-wrap">
              <ClickableUsername
                userId={comment.user.id}
                username={comment.user.username}
                displayName={comment.user.display_name}
                className="font-bold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors text-sm"
              />
              <span className="text-gray-500 text-xs">
                @{comment.user.username}
              </span>
              <span className="text-gray-400 text-xs">
                {formatTimeAgo(comment.created_at)}
              </span>
            </div>

            {/* Comment Text */}
            <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center space-x-4 mt-2">
              {/* Reply Button */}
              {!isReply && (
                <button
                  onClick={() => {
                    if (isReplyingToThis) {
                      // Hide reply input
                      setReplyingTo(null)
                      setReplyText("")
                    } else {
                      // Show reply input
                      setReplyingTo(comment.id)
                      setReplyText("")
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-purple-600 transition-colors font-medium min-h-[44px] sm:min-h-0 py-2 sm:py-0 px-2 sm:px-0 touch-manipulation active:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded"
                  aria-label={isReplyingToThis ? 'Hide reply input' : `Reply to ${comment.user.display_name || comment.user.username}'s comment`}
                >
                  {isReplyingToThis ? 'Hide' : 'Reply'}
                </button>
              )}

              {/* Show/Hide Replies Button */}
              {!isReply && comment.reply_count > 0 && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  disabled={isLoadingReplies}
                  className="text-xs text-purple-600 hover:text-purple-700 transition-colors font-medium flex items-center space-x-1 min-h-[44px] sm:min-h-0 py-2 sm:py-0 px-2 sm:px-0 touch-manipulation active:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded"
                  aria-label={isExpanded ? `Hide ${comment.reply_count} replies` : `Show ${comment.reply_count} replies`}
                  aria-expanded={isExpanded}
                >
                  {isLoadingReplies ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-3 w-3" />
                      <span>
                        {isExpanded ? 'Hide' : 'Show'} {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Reply Input */}
            {isReplyingToThis && (
              <div className="mt-3">
                <div className="relative">
                  <textarea
                    ref={replyInputRef}
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value.slice(0, MAX_CHARS))
                      // Auto-expand textarea
                      e.target.style.height = 'auto'
                      e.target.style.height = e.target.scrollHeight + 'px'
                    }}
                    placeholder={`Reply to ${comment.user.display_name || comment.user.username}...`}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm overflow-hidden"
                    rows={1}
                    maxLength={MAX_CHARS}
                    aria-label={`Reply to ${comment.user.display_name || comment.user.username}`}
                    style={{ minHeight: '40px', maxHeight: '200px' }}
                  />
                  {/* Reply Button inside textarea */}
                  <button
                    onClick={() => handleReplySubmit(comment.id)}
                    disabled={!replyText.trim() || isSubmitting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-purple-50 active:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label="Submit reply"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {/* Character count below textarea */}
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {replyText.length}/{MAX_CHARS}
                </div>
              </div>
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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 sm:p-6">
        <div 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="comments-modal-title"
          aria-describedby="comments-modal-description"
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col touch-manipulation"
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
            className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6" 
            role="main"
          >
            {localComments.length === 0 ? (
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

          {/* Footer - Comment Input */}
          <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
            <div className="relative">
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => {
                  setCommentText(e.target.value.slice(0, MAX_CHARS))
                  // Auto-expand textarea
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                placeholder="Add a comment..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none overflow-hidden"
                rows={1}
                maxLength={MAX_CHARS}
                aria-label="Add a comment"
                aria-describedby="comment-char-count"
                style={{ minHeight: '44px', maxHeight: '200px' }}
              />
              {/* Send Button inside textarea */}
              <button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim() || isSubmitting}
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
            {/* Character count below textarea */}
            <div 
              id="comment-char-count"
              className="text-xs text-gray-400 mt-1 text-right"
              aria-live="polite"
            >
              {commentText.length}/{MAX_CHARS}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
