"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Share, Calendar, MapPin, Plus, Loader2, MoreHorizontal, Edit3, Trash2, Heart, MessageCircle } from "lucide-react"
import EmojiPicker from "./EmojiPicker"
import ReactionViewer from "./ReactionViewer"
import HeartsViewer from "./HeartsViewer"
import ShareModal from "./ShareModal"
import CommentsModal from "./CommentsModal"
import MentionHighlighter from "./MentionHighlighter"
import FollowButton from "./FollowButton"
import ProfilePhotoDisplay from "./ProfilePhotoDisplay"
import RichContentRenderer from "./RichContentRenderer"
import EditPostModal from "./EditPostModal"
import DeleteConfirmationModal from "./DeleteConfirmationModal"
import PostPrivacyBadge from "./PostPrivacyBadge"
import { apiClient } from "@/utils/apiClient"
import LocationDisplayModal from "./LocationDisplayModal"
import OptimizedPostImage from "./OptimizedPostImage"
import StackedImagePreview from "./StackedImagePreview"
import MultiImageModal from "./MultiImageModal"
import ReactionsBanner from "./ReactionsBanner"
import analyticsService from "@/services/analytics"
import { getEmojiFromCode, emojiCodeToEmoji } from "@/utils/emojiMapping"
import { getImageUrl } from "@/utils/imageUtils"
import { isAuthenticated, getAccessToken } from "@/utils/auth"
import { getUniqueUsernames, isValidUsername } from "@/utils/mentionUtils"
import { useToast } from "@/contexts/ToastContext"
import { normalizePostFromApi, debugApiResponse, mergePostUpdate } from "@/utils/normalizePost"
import { getTextDirection, getTextAlignmentClass, getDirectionAttribute, hasMixedDirectionContent } from "@/utils/rtlUtils"
import { usePostStateSynchronization } from "@/hooks/useStateSynchronization"
import { queryKeys, queryTags } from "@/utils/queryKeys"
import { Post, Author, PostImage } from "@/types/post"


interface PostCardProps {
  post: Post
  currentUserId?: string
  hideFollowButton?: boolean // New prop to hide follow button in profile context
  onHeart?: (postId: string, isCurrentlyHearted: boolean, heartInfo?: { heartsCount: number, isHearted: boolean }) => void
  onReaction?: (postId: string, emojiCode: string, reactionSummary?: { totalCount: number, reactions: { [key: string]: number }, userReaction: string | null, reactionEmojiCodes?: string[] }) => void
  onRemoveReaction?: (postId: string, reactionSummary?: { totalCount: number, reactions: { [key: string]: number }, userReaction: string | null, reactionEmojiCodes?: string[] }) => void
  onShare?: (postId: string) => void
  onUserClick?: (userId: string) => void
  onEdit?: (postId: string, updatedPost: Post) => void
  onDelete?: (postId: string) => void
}

// Removed local emoji mapping - now using utility function

export default function PostCard({
  post,
  currentUserId,
  hideFollowButton = false,
  onHeart,
  onReaction,
  onRemoveReaction,
  onShare,
  onUserClick,
  onEdit,
  onDelete
}: PostCardProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionViewer, setShowReactionViewer] = useState(false)
  const [showHeartsViewer, setShowHeartsViewer] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [showMultiImageModal, setShowMultiImageModal] = useState(false)
  const [multiImageInitialIndex, setMultiImageInitialIndex] = useState(0)
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false)

  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 })
  const [shareModalPosition, setShareModalPosition] = useState({ x: 0, y: 0 })
  const [locationModalPosition, setLocationModalPosition] = useState({ x: 0, y: 0 })
  const [reactions, setReactions] = useState<any[]>([]) // Will be populated from API
  const [hearts, setHearts] = useState<any[]>([]) // Will be populated from API
  const [comments, setComments] = useState<any[]>([]) // Will be populated from API
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const [validUsernames, setValidUsernames] = useState<string[]>([])
  const [currentPost, setCurrentPost] = useState(post)

  // Sync post prop with local state
  useEffect(() => {
    setCurrentPost(post)
  }, [post])

  // Subscribe to state synchronization for real-time updates
  usePostStateSynchronization(currentPost, (updatedPost) => {
    setCurrentPost(updatedPost)
  })

  // Loading states
  const [isHeartLoading, setIsHeartLoading] = useState(false)
  const [isReactionLoading, setIsReactionLoading] = useState(false)
  const [isReactionsViewerLoading, setIsReactionsViewerLoading] = useState(false)
  const [pendingReaction, setPendingReaction] = useState<string | null>(null) // Track pending reaction before API call
  const [isHeartsViewerLoading, setIsHeartsViewerLoading] = useState(false)
  const [isCommentsLoading, setIsCommentsLoading] = useState(false)
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const reactionButtonRef = useRef<HTMLButtonElement>(null)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const locationButtonRef = useRef<HTMLButtonElement>(null)
  const optionsButtonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const { showError, showDebugSuccess, showDebugLoading, hideToast } = useToast()

  // Check authentication status on mount and when currentUserId changes
  useEffect(() => {
    setIsUserAuthenticated(isAuthenticated() && !!currentUserId)
  }, [currentUserId])

  // Handle click outside to close options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsButtonRef.current && !optionsButtonRef.current.contains(event.target as Node)) {
        const target = event.target as Element
        // Check if click is outside the options dropdown
        if (!target.closest('.absolute')) {
          setShowOptionsMenu(false)
        }
      }
    }

    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showOptionsMenu])

  // Track post view when component mounts
  useEffect(() => {
    if (!hasTrackedView && currentUserId) {
      analyticsService.trackViewEvent(post.id, currentUserId)
      setHasTrackedView(true)
    }
  }, [post.id, hasTrackedView, currentUserId])

  // Validate usernames in post content
  useEffect(() => {
    const validateMentions = async () => {

      if (!currentPost.content || !isAuthenticated() || !currentUserId) {
        setValidUsernames([])
        return
      }

      const usernames = getUniqueUsernames(currentPost.content)
      if (usernames.length === 0) {
        setValidUsernames([])
        return
      }

      // Filter out obviously invalid usernames to prevent unnecessary API calls
      const validFormatUsernames = usernames.filter(isValidUsername)

      if (validFormatUsernames.length === 0) {
        setValidUsernames([])
        return
      }

      try {
        const token = getAccessToken()
        if (!token) {
          setValidUsernames([])
          return
        }

        // Use batch validation endpoint to avoid 404 errors with optimized API client
        const result = await apiClient.post('/users/validate-batch', {
          usernames: validFormatUsernames
        }) as any
        // API now returns camelCase
        setValidUsernames(result.data?.validUsernames || result.validUsernames || [])
      } catch (error) {
        // Only log errors in development
        if (process.env['NODE_ENV'] === 'development') {
          console.error('Error validating usernames:', error)
        }
        setValidUsernames([])
      }
    }

    validateMentions()
  }, [currentPost.content, currentUserId])

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date"

    const date = new Date(dateString)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString)
      return "Invalid date"
    }

    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    return date.toLocaleDateString()
  }

  // Determine which date to show and whether to indicate it was edited
  const getDisplayDate = () => {
    // Show updated date if post was edited, otherwise show created date
    const dateToShow = currentPost.updatedAt || currentPost.createdAt
    const wasEdited = currentPost.updatedAt && currentPost.updatedAt !== currentPost.createdAt

    return {
      dateString: dateToShow,
      wasEdited
    }
  }

  const handleReactionButtonClick = async (event: React.MouseEvent) => {
    event.preventDefault()

    if (!isUserAuthenticated) {
      return
    }

    // If user already has a reaction, remove it optimistically
    if (currentPost.currentUserReaction && onRemoveReaction) {
      // Track analytics event for reaction removal
      if (currentUserId) {
        analyticsService.trackReactionEvent(
          'reaction_remove',
          post.id,
          currentUserId,
          undefined,
          currentPost.currentUserReaction
        )
      }

      // Snapshot for rollback
      const snapshot = {
        currentUserReaction: currentPost.currentUserReaction,
        reactionsCount: currentPost.reactionsCount,
        reactionEmojiCodes: currentPost.reactionEmojiCodes ? [...currentPost.reactionEmojiCodes] : [],
      }

      // Optimistic update — remove reaction immediately
      setCurrentPost(prev => ({
        ...prev,
        currentUserReaction: null,
        reactionsCount: Math.max(0, (prev.reactionsCount || 1) - 1),
      }))
      onRemoveReaction(post.id)

      try {
        await apiClient.delete(`/posts/${post.id}/reactions`)

        // Background reconciliation — update counts from server truth
        try {
          const reactionSummary = await apiClient.get(`/posts/${post.id}/reactions/summary`, { skipCache: true }) as any
          const emojiCountsObj = reactionSummary.emojiCounts || {}
          const updatedEmojiCodes = [...Object.keys(emojiCountsObj)]

          setCurrentPost(prev => ({
            ...prev,
            reactionsCount: reactionSummary.totalCount ?? prev.reactionsCount,
            reactionEmojiCodes: updatedEmojiCodes,
          }))
          onRemoveReaction(post.id, { ...reactionSummary, reactionEmojiCodes: updatedEmojiCodes })
        } catch {
          // Reconciliation failure is non-critical — optimistic state is good enough
        }
        apiClient.invalidateTags([
          queryTags.post(post.id),
          queryTags.postReactions(post.id),
          queryTags.userPosts(currentPost.author.id),
        ])
      } catch (error) {
        // Rollback on failure
        console.error('Failed to remove reaction:', error)
        setCurrentPost(prev => ({
          ...prev,
          currentUserReaction: snapshot.currentUserReaction,
          reactionsCount: snapshot.reactionsCount,
          reactionEmojiCodes: snapshot.reactionEmojiCodes,
        }))
        showError(
          'Reaction Failed',
          'Unable to remove reaction. Please try again.',
          { label: 'Retry', onClick: () => handleReactionButtonClick(event) }
        )
      }
      return
    }

    // No existing reaction — open emoji picker
    setPendingReaction('heart')

    if (reactionButtonRef.current) {
      const rect = reactionButtonRef.current.getBoundingClientRect()
      setEmojiPickerPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 8
      })
    }

    setShowEmojiPicker(true)
  }

  // Handle emoji selection — optimistic update before API call
  const handleEmojiSelect = async (emojiCode: string) => {
    // Track analytics event
    if (currentUserId) {
      const eventType = currentPost.currentUserReaction ? 'reaction_change' : 'reaction_add'
      analyticsService.trackReactionEvent(
        eventType,
        post.id,
        currentUserId,
        emojiCode,
        currentPost.currentUserReaction
      )
    }

    // Snapshot for rollback
    const snapshot = {
      currentUserReaction: currentPost.currentUserReaction,
      reactionsCount: currentPost.reactionsCount,
      reactionEmojiCodes: currentPost.reactionEmojiCodes ? [...currentPost.reactionEmojiCodes] : [],
    }

    // Optimistic update — show reaction immediately
    const isChangingReaction = !!currentPost.currentUserReaction
    setCurrentPost(prev => ({
      ...prev,
      currentUserReaction: emojiCode,
      reactionsCount: isChangingReaction ? prev.reactionsCount : (prev.reactionsCount || 0) + 1,
      reactionEmojiCodes: prev.reactionEmojiCodes?.includes(emojiCode)
        ? prev.reactionEmojiCodes
        : [...(prev.reactionEmojiCodes || []), emojiCode],
    }))
    onReaction?.(post.id, emojiCode)
    setPendingReaction(null)

    try {
      await apiClient.post(`/posts/${post.id}/reactions`, { emojiCode })

      // Background reconciliation — update counts from server truth
      try {
        const reactionSummary = await apiClient.get(`/posts/${post.id}/reactions/summary`, { skipCache: true }) as any
        const emojiCountsObj = reactionSummary.emojiCounts || {}
        const updatedEmojiCodes = [...Object.keys(emojiCountsObj)]

        setCurrentPost(prev => ({
          ...prev,
          reactionsCount: reactionSummary.totalCount ?? prev.reactionsCount,
          reactionEmojiCodes: updatedEmojiCodes,
        }))
        onReaction?.(post.id, emojiCode, { ...reactionSummary, reactionEmojiCodes: updatedEmojiCodes })
      } catch {
        // Reconciliation failure is non-critical
      }
      apiClient.invalidateTags([
        queryTags.post(post.id),
        queryTags.postReactions(post.id),
        queryTags.userPosts(currentPost.author.id),
      ])
    } catch (apiError: any) {
      // Rollback on failure
      setCurrentPost(prev => ({
        ...prev,
        currentUserReaction: snapshot.currentUserReaction,
        reactionsCount: snapshot.reactionsCount,
        reactionEmojiCodes: snapshot.reactionEmojiCodes,
      }))
      showError(
        'Reaction Failed',
        apiError.message || 'Unable to add reaction. Please try again.',
        { label: 'Retry', onClick: () => handleEmojiSelect(emojiCode) }
      )
    } finally {
      setIsReactionLoading(false)
    }
  }

  // Handle emoji picker close after successful selection
  const handleEmojiPickerClose = () => {
    setShowEmojiPicker(false)
    setPendingReaction(null)
  }

  // Handle emoji picker cancel (X button, click outside, Escape) - no API call
  const handleEmojiPickerCancel = () => {
    setShowEmojiPicker(false)
    setPendingReaction(null)
    // No API call - just close the picker
  }

  const handleReactionCountClick = async () => {
    if (isReactionsViewerLoading) return

    setIsReactionsViewerLoading(true)

    // Fetch reactions from API
    try {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`/api/posts/${post.id}/reactions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const reactionsData = await response.json()
        setReactions(reactionsData)
        setShowReactionViewer(true)
      } else {
        showError('Failed to Load', 'Unable to load reactions. Please try again.')
      }
    } catch (error) {
      console.error('Failed to fetch reactions:', error)
      showError('Network Error', 'Please check your connection and try again.')
    } finally {
      setIsReactionsViewerLoading(false)
    }
  }

  const handleHeartsCountClick = async () => {
    if (isHeartsViewerLoading) return

    setIsHeartsViewerLoading(true)

    // Fetch hearts from API
    try {
      const token = localStorage.getItem("access_token")
      try {
        // Use optimized API client for hearts users
        const heartsData = await apiClient.get(`/posts/${post.id}/hearts/users`) as any
        setHearts(heartsData)
        setShowHeartsViewer(true)
      } catch (apiError) {
        showError('Failed to Load', 'Unable to load hearts. Please try again.')
      }
    } catch (error) {
      console.error('Failed to fetch hearts:', error)
      showError('Network Error', 'Please check your connection and try again.')
    } finally {
      setIsHeartsViewerLoading(false)
    }
  }

  const handleUserClick = (userId: number) => {
    if (onUserClick) {
      onUserClick(userId.toString())
    }
  }

  const handleCommentsButtonClick = async () => {
    if (!isUserAuthenticated) {
      // Guest users cannot comment — button is disabled, no redirect
      return
    }

    if (isCommentsLoading) return

    setIsCommentsLoading(true)

    // Fetch top-level comments from API
    try {
      const token = getAccessToken()
      if (!token) {
        showError('Authentication Error', 'Please log in to view comments.')
        return
      }

      const commentsData = await apiClient.get(`/posts/${post.id}/comments`) as any
      setComments(commentsData)
      setShowCommentsModal(true)
    } catch (error: any) {
      console.error('Failed to fetch comments:', error)
      showError('Failed to Load', error.message || 'Unable to load comments. Please try again.')
    } finally {
      setIsCommentsLoading(false)
    }
  }

  const handleCommentSubmit = async (content: string) => {
    const token = getAccessToken()
    if (!token) {
      showError('Authentication Error', 'Please log in to comment.')
      return
    }

    // Snapshot for rollback
    const snapshotComments = [...comments]
    const snapshotCount = currentPost.commentsCount || 0

    // Optimistic insert — temp comment appears instantly
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const tempComment = {
      id: tempId,
      content,
      userId: currentUserId,
      user: { id: currentUserId, displayName: '', profileImageUrl: null },
      createdAt: new Date().toISOString(),
      editedAt: null,
      replies: [],
      repliesCount: 0,
    }
    setComments(prev => [...prev, tempComment])
    setCurrentPost(prev => ({ ...prev, commentsCount: (prev.commentsCount || 0) + 1 }))
    setIsCommentSubmitting(true)

    try {
      const newComment = await apiClient.post(`/posts/${post.id}/comments`, { content }) as any

      // Reconcile: replace temp comment with server response
      setComments(prev => prev.map(c => c.id === tempId ? newComment : c))

      // Background: reload full list for consistency (e.g., server-side ordering)
      try {
        const updatedComments = await apiClient.get(`/posts/${post.id}/comments`, { skipCache: true }) as any
        setComments(updatedComments)
      } catch {
        // Non-critical — we already have the server comment
      }
      apiClient.invalidateTags([
        queryTags.post(post.id),
        queryTags.postComments(post.id),
        queryTags.userPosts(currentPost.author.id),
      ])
    } catch (error: any) {
      // Rollback
      console.error('Failed to post comment:', error)
      setComments(snapshotComments)
      setCurrentPost(prev => ({ ...prev, commentsCount: snapshotCount }))
      showError('Failed to Post', error.message || 'Unable to post comment. Please try again.')
      throw error // Re-throw to let modal handle it
    } finally {
      setIsCommentSubmitting(false)
    }
  }

  const handleReplySubmit = async (commentId: string, content: string) => {
    const token = getAccessToken()
    if (!token) {
      showError('Authentication Error', 'Please log in to reply.')
      return
    }

    // Snapshot for rollback
    const snapshotCount = currentPost.commentsCount || 0

    // Optimistic: increment count immediately (reply appears in CommentsModal via reload)
    setCurrentPost(prev => ({ ...prev, commentsCount: (prev.commentsCount || 0) + 1 }))

    try {
      await apiClient.post(`/comments/${commentId}/replies`, { content }) as any

      // Reload comments to show the new reply with server data
      const updatedComments = await apiClient.get(`/posts/${post.id}/comments`, { skipCache: true }) as any
      setComments(updatedComments)
      apiClient.invalidateTags([
        queryTags.post(post.id),
        queryTags.postComments(post.id),
        queryTags.userPosts(currentPost.author.id),
      ])
    } catch (error: any) {
      // Rollback count
      console.error('Failed to post reply:', error)
      setCurrentPost(prev => ({ ...prev, commentsCount: snapshotCount }))
      showError('Failed to Post', error.message || 'Unable to post reply. Please try again.')
      throw error // Re-throw to let modal handle it
    }
  }

  const handleLoadReplies = async (commentId: string): Promise<any[]> => {
    try {
      const token = getAccessToken()
      if (!token) {
        showError('Authentication Error', 'Please log in to view replies.')
        return []
      }

      // Use skipCache to ensure we get fresh replies after submission
      const replies = await apiClient.get(`/comments/${commentId}/replies`, {
        skipCache: true
      }) as any
      console.log('PostCard: Loaded replies for comment', {
        commentId,
        repliesCount: replies.length
      })
      return replies
    } catch (error: any) {
      console.error('Failed to load replies:', error)
      showError('Failed to Load', error.message || 'Unable to load replies. Please try again.')
      return []
    }
  }

  // Edit comment handler — optimistic content update
  const handleCommentEdit = async (commentId: string, content: string): Promise<any> => {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Please log in to edit comments.')
    }

    // Snapshot original content for rollback
    const originalComment = comments.find(c => c.id === commentId)
    const originalContent = originalComment?.content

    // Optimistic update — show edited content immediately
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, content, editedAt: new Date().toISOString() } : c
    ))

    try {
      const updatedComment = await apiClient.put(`/comments/${commentId}`, { content }) as any

      // Reconcile with server data (e.g., exact editedAt timestamp)
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, content: updatedComment.content, editedAt: updatedComment.editedAt } : c
      ))
      apiClient.invalidateTags([
        queryTags.post(post.id),
        queryTags.postComments(post.id),
        queryTags.userPosts(currentPost.author.id),
      ])

      return updatedComment
    } catch (error: any) {
      // Rollback to original content
      console.error('Failed to edit comment:', error)
      if (originalContent !== undefined) {
        setComments(prev => prev.map(c =>
          c.id === commentId ? { ...c, content: originalContent, editedAt: originalComment?.editedAt } : c
        ))
      }
      showError('Edit Failed', error.message || 'Unable to edit comment. Please try again.')
      throw new Error(error.message || 'Unable to edit comment. Please try again.')
    }
  }

  // Delete comment handler — optimistic removal
  const handleCommentDelete = async (commentId: string): Promise<void> => {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Please log in to delete comments.')
    }

    // Snapshot for rollback
    const snapshotComments = [...comments]
    const snapshotCount = currentPost.commentsCount || 0

    // Optimistic removal — hide comment immediately
    setComments(prev => prev.filter(c => c.id !== commentId))
    setCurrentPost(prev => ({
      ...prev,
      commentsCount: Math.max(0, (prev.commentsCount || 0) - 1)
    }))

    try {
      await apiClient.delete(`/comments/${commentId}`)

      // Background reconciliation
      try {
        const updatedComments = await apiClient.get(`/posts/${post.id}/comments`, { skipCache: true }) as any
        setComments(updatedComments)
      } catch {
        // Non-critical
      }
      apiClient.invalidateTags([
        queryTags.post(post.id),
        queryTags.postComments(post.id),
        queryTags.userPosts(currentPost.author.id),
      ])
    } catch (error: any) {
      // Rollback
      console.error('Failed to delete comment:', error)
      setComments(snapshotComments)
      setCurrentPost(prev => ({ ...prev, commentsCount: snapshotCount }))
      showError('Delete Failed', error.message || 'Unable to delete comment. Please try again.')
      throw new Error(error.message || 'Unable to delete comment. Please try again.')
    }
  }

  const handleMentionClick = async (username: string) => {
    try {
      // Get auth token
      const token = getAccessToken()
      if (!token) {
        console.error('No auth token available for mention navigation')
        return
      }

      // URL encode the username to handle special characters
      const encodedUsername = encodeURIComponent(username)

      // Fetch user by username
      const response = await fetch(`/api/users/username/${encodedUsername}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        const userData = result.data

        // Navigate to user profile
        router.push(`/profile/${userData.id}`)
      } else {
        console.error('Failed to fetch user by username:', response.status)
        // Optionally show a toast notification that user was not found
      }
    } catch (error) {
      console.error('Error navigating to user profile:', error)
    }
  }

  // Edit post handler — optimistic update
  const handleEditPost = async (postData: {
    content: string
    updatedAt?: string
    richContent?: string
    postStyle?: any
    location?: string
    locationData?: any
    privacyLevel?: 'public' | 'private' | 'custom'
    privacyRules?: string[]
    specificUsers?: number[]
  }) => {
    const token = getAccessToken()
    if (!token) {
      showError('Authentication Error', 'Please log in to edit posts.')
      return
    }

    // Snapshot for rollback (structuredClone for deep copy)
    const snapshot = typeof structuredClone === 'function'
      ? structuredClone(currentPost)
      : JSON.parse(JSON.stringify(currentPost))

    // Optimistic update — merge edited fields immediately
    setCurrentPost(prev => ({
      ...prev,
      content: postData.content,
      richContent: postData.richContent ?? prev.richContent,
      postStyle: postData.postStyle ?? prev.postStyle,
      location: postData.location ?? prev.location,
      privacyLevel: postData.privacyLevel ?? prev.privacyLevel,
      updatedAt: new Date().toISOString(),
    }))
    setShowEditModal(false)

    const loadingToastId = showDebugLoading('Updating Post', 'Saving your changes...')

    try {
      const raw = await apiClient.put(`/posts/${post.id}`, postData) as any

      if (loadingToastId) hideToast(loadingToastId)
      debugApiResponse(raw, "PUT /api/posts/:id response")

      const normalized = normalizePostFromApi(raw)
      if (normalized) {
        // Reconcile with full server response
        setCurrentPost(prev => mergePostUpdate(prev, normalized))
        apiClient.patchTaggedQuery(queryKeys.post(post.id), () => normalized)
        apiClient.invalidateTags([
          queryTags.feed,
          queryTags.userPosts(currentPost.author.id),
          queryTags.post(post.id),
        ])
        showDebugSuccess('Post Updated', 'Your post has been updated successfully.')
        if (onEdit) onEdit(post.id, normalized)
      } else {
        console.warn("Could not normalize post response:", raw)
        if (onEdit) onEdit(post.id, raw)
      }
    } catch (error: any) {
      if (loadingToastId) hideToast(loadingToastId)

      // Rollback to snapshot
      console.error('Error updating post:', error)
      setCurrentPost(snapshot)

      const errorMessage = error.message || 'Unable to update post. Please try again.'
      showError(
        'Update Failed',
        errorMessage,
        { label: 'Retry', onClick: () => handleEditPost(postData) }
      )
    }
  }

  const handleDeletePost = async () => {
    try {
      const token = getAccessToken()
      if (!token) {
        showError('Authentication Error', 'Please log in to delete posts.')
        return
      }

      setIsDeleting(true)
      const loadingToastId = showDebugLoading('Deleting Post', 'Removing your post...')

      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })

      if (loadingToastId) hideToast(loadingToastId)

      if (response.ok) {
        showDebugSuccess('Post Deleted', 'Your post has been deleted successfully.')
        setShowDeleteModal(false)
        apiClient.invalidateTags([
          queryTags.feed,
          queryTags.userPosts(currentPost.author.id),
          queryTags.currentUserProfile,
          queryTags.userProfile(currentPost.author.id),
          queryTags.post(post.id),
        ])

        // Call the onDelete callback if provided
        if (onDelete) {
          onDelete(post.id)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        showError(
          'Delete Failed',
          errorData.detail || 'Unable to delete post. Please try again.',
          {
            label: 'Retry',
            onClick: handleDeletePost
          }
        )
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      showError(
        'Network Error',
        'Please check your connection and try again.',
        {
          label: 'Retry',
          onClick: handleDeletePost
        }
      )
    } finally {
      setIsDeleting(false)
    }
  }

  // Check if current user is the post author
  const isPostAuthor = currentUserId && currentUserId === currentPost.author.id


  
  // Standardized styling for all posts
  const styling = {
    container: `bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6`,
    header: 'p-5 border-b border-gray-100',
    avatar: 'w-10 h-10',
    name: 'font-semibold text-base',
    content: 'p-5',
    text: 'text-base leading-relaxed font-medium text-gray-900',
    actions: 'px-5 py-3 border-t border-gray-100',
    iconSize: 'h-5 w-5',
    textSize: 'text-sm'
  }
  const postPrivacyLevel = currentPost.privacyLevel
  const postPrivacyRules = useMemo(
    () => Array.isArray(currentPost.privacyRules) ? currentPost.privacyRules : [],
    [currentPost.privacyRules]
  )
  const postSpecificUsers = useMemo(
    () => Array.isArray(currentPost.specificUsers) ? currentPost.specificUsers : [],
    [currentPost.specificUsers]
  )
  const badgePostPrivacy = useMemo(() => ({
    privacyLevel: postPrivacyLevel,
    privacyRules: postPrivacyRules,
    specificUsers: postSpecificUsers,
  }), [postPrivacyLevel, postPrivacyRules, postSpecificUsers])

  return (
    <>
      <article className={styling.container} data-post-id={post.id}>
        {/* Post Header */}
        <div className={styling.header}>
          <div className="flex items-start gap-3">
            <Link href={`/profile/${currentPost.author.id}`} className="flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all rounded-full">
              <ProfilePhotoDisplay
                photoUrl={currentPost.author.profileImageUrl || currentPost.author.image}
                username={currentPost.author.username || currentPost.author.name}
                size={styling.avatar.includes('w-12') ? 'md' : 'lg'}
                className="flex-shrink-0"
              />
            </Link>
            {/* Content Column */}
            <div className="flex-1 min-w-0">
              {/* Row 1: Name + Follow + Options */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/profile/${currentPost.author.id}`}
                    className="min-w-0 cursor-pointer hover:text-purple-700 transition-colors no-underline text-inherit"
                  >
                    <h3 className={`${styling.name} text-gray-900 font-bold truncate`}>
                      {currentPost.author.displayName || currentPost.author.name}
                    </h3>
                  </Link>
                  {/* Follow button */}
                  {currentUserId &&
                    currentUserId !== currentPost.author.id &&
                    !isNaN(parseInt(currentPost.author.id)) &&
                    !hideFollowButton && (
                      <div className="flex-shrink-0">
                        {(() => {
                          const isFollowing = currentPost.author.isFollowing ?? false;
                          console.debug("Follow state for user", currentPost.author.id, isFollowing);
                          return (
                            <FollowButton
                              userId={parseInt(currentPost.author.id)}
                              size="xxs"
                              variant="outline"
                            />
                          );
                        })()}
                      </div>
                    )}
                </div>

                {/* Options Menu for Post Author */}
                {isPostAuthor && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PostPrivacyBadge
                      privacyLevel={postPrivacyLevel}
                      privacyRules={postPrivacyRules}
                      specificUsers={postSpecificUsers}
                      isAuthor
                      postPrivacy={badgePostPrivacy}
                      showQuickPreview
                      hideLabelOnMobile
                      className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600"
                      labelClassName="text-gray-600"
                    />
                    <div className="relative">
                      <button
                        ref={optionsButtonRef}
                        onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Post options"
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-500" />
                      </button>

                      {/* Options Dropdown */}
                      {showOptionsMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => {
                              setShowEditModal(true)
                              setShowOptionsMenu(false)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Edit3 className="h-4 w-4" />
                            <span>Edit post</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteModal(true)
                              setShowOptionsMenu(false)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete post</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Row 2: Date */}
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <a
                    href={`/post/${post.id}`}
                    className="whitespace-nowrap hover:text-purple-600 hover:underline transition-colors cursor-pointer"
                    title="View post details"
                  >
                    {formatDate(getDisplayDate().dateString)}
                  </a>
                  {getDisplayDate().wasEdited && (
                    <span className="text-gray-400 text-xs">(edited)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Post Content */}
        {(() => {
          const style = currentPost.postStyle

          const backgroundStyle: React.CSSProperties | undefined = style
            ? {
              background: style.backgroundGradient || style.backgroundColor,
              color: style.textColor || undefined,
              fontFamily: style.fontFamily || undefined,
            }
            : undefined

          return (
            <div
              className={`
        ${styling.content}
        post-content-area
        rounded-lg
        overflow-hidden
      `}
              style={backgroundStyle}
              dir={getDirectionAttribute(currentPost.content)}
            >
              {/* Inner padding wrapper so background fills fully */}
              <div className="p-5 space-y-4">
                {/* Text */}
                <RichContentRenderer
                  content={currentPost.content}
                  className={`
            ${styling.text}
            ${getTextAlignmentClass(currentPost.content)}
          `}
                  onMentionClick={handleMentionClick}
                  validUsernames={validUsernames}
                />

                {/* Images */}
                {currentPost.images && currentPost.images.length > 0 ? (
                  <StackedImagePreview
                    images={currentPost.images}
                    onImageClick={(index) => {
                      setMultiImageInitialIndex(index)
                      setShowMultiImageModal(true)
                    }}
                    disabled={!isUserAuthenticated}
                  />
                ) : currentPost.imageUrl && (
                  <OptimizedPostImage
                    src={getImageUrl(currentPost.imageUrl) || currentPost.imageUrl}
                    alt="Post image"
                    disabled={!isUserAuthenticated}
                  />
                )}
              </div>
            </div>
          )
        })()}

        {/* Post Actions */}
        <div className={styling.actions}>
          {/* Authentication Notice for logged-out users - only show if currentUserId is explicitly undefined */}
          {currentUserId === undefined && !isUserAuthenticated && (
            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                  <span className="text-sm text-blue-700 font-medium line-clamp-2">
                    Join to interact with this post!
                  </span>
                </div>
                <div className="flex space-x-2 flex-shrink-0">
                  <a
                    href="/auth/login"
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors whitespace-nowrap h-7 flex items-center"
                  >
                    Log In
                  </a>
                  <a
                    href="/auth/signup"
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors whitespace-nowrap h-7 flex items-center"
                  >
                    Sign Up
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Reactions Banner — clickable summary of who reacted, above footer buttons */}
          <div className="flex justify-between items-center px-1">
            <div className="flex gap-2 min-w-0">
              <ReactionsBanner
                totalCount={currentPost.reactionsCount || 0}
                emojiCodes={currentPost.reactionEmojiCodes || []}
                onClick={isUserAuthenticated ? handleReactionCountClick : undefined}
              />
            </div>
          </div>

          {/* Post Actions Toolbar - Three main buttons in single horizontal line */}
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Unified Heart/Reaction Button */}
            <button
              ref={reactionButtonRef}
              onClick={handleReactionButtonClick}
              disabled={!isUserAuthenticated || isReactionLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] ${!isUserAuthenticated
                ? 'text-gray-400'
                : (pendingReaction || currentPost.currentUserReaction)
                  ? 'text-purple-500 hover:text-purple-600 bg-purple-50 hover:bg-purple-100'
                  : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
                }`}
              title={!isUserAuthenticated ? 'Login to react to posts' : currentPost.currentUserReaction ? 'Remove reaction' : 'React with emoji'}
            >
              {isReactionLoading ? (
                <Loader2 className={`${styling.iconSize} animate-spin flex-shrink-0`} />
              ) : pendingReaction ? (
                // Show pending reaction (selected but not yet sent to API)
                <span className={`flex-shrink-0 ${styling.iconSize.includes('h-6') ? 'text-xl' : styling.iconSize.includes('h-5') ? 'text-lg' : 'text-base'}`}>
                  {getEmojiFromCode(pendingReaction)}
                </span>
              ) : currentPost.currentUserReaction ? (
                <span className={`flex-shrink-0 ${styling.iconSize.includes('h-6') ? 'text-xl' : styling.iconSize.includes('h-5') ? 'text-lg' : 'text-base'}`}>
                  {getEmojiFromCode(currentPost.currentUserReaction)}
                </span>
              ) : (
                // Show empty heart icon when no interaction exists
                <Heart
                  className={`${styling.iconSize} flex-shrink-0 text-gray-500`}
                />
              )}
            </button>

            {/* Comments Button */}
            <button
              onClick={handleCommentsButtonClick}
              disabled={!isUserAuthenticated || isCommentsLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] ${!isUserAuthenticated
                ? 'text-gray-400'
                : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
                } ${(currentPost.commentsCount || 0) > 0 && isUserAuthenticated ? 'ring-1 ring-purple-200' : ''}`}
              title={!isUserAuthenticated ? 'Login to comment on posts' : 'View and add comments'}
            >
              {isCommentsLoading ? (
                <Loader2 className={`${styling.iconSize} animate-spin flex-shrink-0`} />
              ) : (
                <MessageCircle className={`${styling.iconSize} flex-shrink-0`} />
              )}
              <span className={`${styling.textSize} font-medium`}>
                {currentPost.commentsCount || 0}
              </span>
            </button>

            {/* Share Button */}
            <button
              ref={shareButtonRef}
              onClick={(event) => {
                event.preventDefault()

                if (shareButtonRef.current) {
                  const rect = shareButtonRef.current.getBoundingClientRect()
                  setShareModalPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top
                  })
                }

                setShowShareModal(true)
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-green-500 hover:bg-green-50 transition-all duration-200 min-w-[44px] min-h-[44px] ${styling.textSize}`}
              title="Share this post"
            >
              <Share className={`${styling.iconSize} flex-shrink-0`} />
              <span className="font-medium">Share</span>
            </button>
          </div>

          {/* Location Metadata Row */}
          {(currentPost.locationData || currentPost.location) && (
            <div className="flex justify-end min-w-0 mt-1">
              {isUserAuthenticated ? (
                <button
                  ref={locationButtonRef}
                  onClick={(event) => {
                    event.preventDefault()

                    if (locationButtonRef.current) {
                      const rect = locationButtonRef.current.getBoundingClientRect()
                      setLocationModalPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top
                      })
                    }

                    setShowLocationModal(true)
                  }}
                  className="flex items-center justify-end gap-1 flex-1 min-w-0 overflow-hidden text-gray-500 hover:text-purple-600 transition-colors"
                  title={currentPost.locationData ? currentPost.locationData.displayName : currentPost.location}
                >
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-xs truncate min-w-0">
                    {currentPost.locationData ? currentPost.locationData.displayName : currentPost.location}
                  </span>
                </button>
              ) : (
                <div 
                  className="flex items-center justify-end gap-1 flex-1 min-w-0 overflow-hidden text-gray-400 select-none cursor-default" 
                  title={currentPost.locationData ? currentPost.locationData.displayName : currentPost.location}
                >
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-xs truncate min-w-0">
                    {currentPost.locationData ? currentPost.locationData.displayName : currentPost.location}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </article>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={handleEmojiPickerClose}
        onCancel={handleEmojiPickerCancel}
        onEmojiSelect={handleEmojiSelect}
        currentReaction={currentPost.currentUserReaction}
        position={emojiPickerPosition}
        isLoading={isReactionLoading}
      />

      {/* Reaction Viewer Modal */}
      <ReactionViewer
        isOpen={showReactionViewer}
        onClose={() => setShowReactionViewer(false)}
        postId={post.id}
        reactions={reactions}
        onUserClick={handleUserClick}
      />

      {/* Hearts Viewer Modal */}
      <HeartsViewer
        isOpen={showHeartsViewer}
        onClose={() => setShowHeartsViewer(false)}
        postId={post.id}
        hearts={hearts}
        onUserClick={handleUserClick}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        post={post}
        position={shareModalPosition}
        isGuest={!isUserAuthenticated}
        onShare={(method) => {
          // Track analytics event for share
          if (currentUserId) {
            analyticsService.trackShareEvent(post.id, currentUserId, method)
          }
          // Call original onShare callback if provided
          onShare?.(post.id)
        }}
      />

      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        postId={post.id}
        comments={comments}
        totalCommentsCount={currentPost.commentsCount || 0}
        currentUserId={currentUserId ? parseInt(currentUserId, 10) : undefined}
        onCommentSubmit={handleCommentSubmit}
        onReplySubmit={handleReplySubmit}
        onLoadReplies={handleLoadReplies}
        onCommentEdit={handleCommentEdit}
        onCommentDelete={handleCommentDelete}
        isSubmitting={isCommentSubmitting}
      />

      {/* Location Display Modal */}
      <LocationDisplayModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        location={currentPost.location}
        locationData={currentPost.locationData}
        position={locationModalPosition}
      />

      {/* Edit Post Modal */}
      <EditPostModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        post={currentPost}
        onSubmit={handleEditPost}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeletePost}
        isDeleting={isDeleting}
      />

      {/* Multi-Image Modal */}
      {currentPost.images && currentPost.images.length > 0 && (
        <MultiImageModal
          images={currentPost.images}
          initialIndex={multiImageInitialIndex}
          isOpen={showMultiImageModal}
          onClose={() => setShowMultiImageModal(false)}
        />
      )}
    </>
  )
}
