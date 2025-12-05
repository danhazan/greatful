"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { apiClient } from "@/utils/apiClient"
import LocationDisplayModal from "./LocationDisplayModal"
import OptimizedPostImage from "./OptimizedPostImage"
import analyticsService from "@/services/analytics"
import { getEmojiFromCode } from "@/utils/emojiMapping"
import { getImageUrl } from "@/utils/imageUtils"
import { isAuthenticated, getAccessToken } from "@/utils/auth"
import { getUniqueUsernames, isValidUsername } from "@/utils/mentionUtils"
import { useToast } from "@/contexts/ToastContext"
import { normalizePostFromApi, debugApiResponse, mergePostUpdate } from "@/utils/normalizePost"
import { getTextDirection, getTextAlignmentClass, getDirectionAttribute, hasMixedDirectionContent } from "@/utils/rtlUtils"
import { usePostStateSynchronization } from "@/hooks/useStateSynchronization"

interface Post {
  id: string
  content: string
  postStyle?: {
    id: string
    name: string
    backgroundColor: string
    backgroundGradient?: string
    textColor: string
    borderStyle?: string
    fontFamily?: string
    textShadow?: string
  }
  post_style?: {  // Backend field name
    id: string
    name: string
    backgroundColor: string
    backgroundGradient?: string
    textColor: string
    borderStyle?: string
    fontFamily?: string
    textShadow?: string
  }
  author: {
    id: string
    name: string
    username?: string
    display_name?: string
    image?: string
  }
  createdAt: string
  updatedAt?: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  location_data?: {
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
  heartsCount: number
  isHearted: boolean
  reactionsCount: number
  currentUserReaction?: string
  isRead?: boolean
  isUnread?: boolean
  commentsCount?: number
}

interface PostCardProps {
  post: Post
  currentUserId?: string
  hideFollowButton?: boolean // New prop to hide follow button in profile context
  onHeart?: (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => void
  onReaction?: (postId: string, emojiCode: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => void
  onRemoveReaction?: (postId: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => void
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
  const [isHeartsViewerLoading, setIsHeartsViewerLoading] = useState(false)
  const [isCommentsLoading, setIsCommentsLoading] = useState(false)
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const reactionButtonRef = useRef<HTMLButtonElement>(null)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const locationButtonRef = useRef<HTMLButtonElement>(null)
  const optionsButtonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const { showSuccess, showError, showLoading, hideToast } = useToast()

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
        setValidUsernames(result.valid_usernames || [])
      } catch (error) {
        // Only log errors in development
        if (process.env.NODE_ENV === 'development') {
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
      // Call the onReaction handler which will handle the redirect
      onReaction?.(post.id, 'heart_eyes') // Use a default emoji for the redirect
      return
    }
    
    // If user already has a reaction, remove it
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
      
      try {
        const token = getAccessToken()
        
        // Make API call to remove reaction
        try {
          // Use optimized API client for reaction removal
          await apiClient.delete(`/posts/${post.id}/reactions`)
          
          // Get updated reaction summary from server
          const reactionSummary = await apiClient.get(`/posts/${post.id}/reactions/summary`) as any
          
          // Call handler with updated server data
          onRemoveReaction(post.id, reactionSummary)
        } catch (error) {
          console.error('Failed to remove reaction:', error)
          // Fallback to original handler if removal fails
          onRemoveReaction(post.id)
        }
      } catch (error) {
        console.error('Error removing reaction:', error)
      }
      return
    }
    
    if (reactionButtonRef.current) {
      const rect = reactionButtonRef.current.getBoundingClientRect()
      setEmojiPickerPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      })
    }
    
    setShowEmojiPicker(true)
  }

  const handleEmojiSelect = async (emojiCode: string) => {
    setIsReactionLoading(true)
    
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
    
    // Note: Removed loading toast for reactions to reduce visual noise
    // The reaction UI provides sufficient visual feedback
    const loadingToastId = '' // Placeholder for error handling
    
    try {
      const token = localStorage.getItem("access_token")
      
      try {
        // Make API call to add/update reaction using optimized API client
        await apiClient.post(`/posts/${post.id}/reactions`, { emoji_code: emojiCode })
        
        // Get updated reaction summary from server
        const reactionSummary = await apiClient.get(`/posts/${post.id}/reactions/summary`) as any
        
        // Call handler with updated server data
        onReaction?.(post.id, emojiCode, reactionSummary)
        
        // Note: No loading toast to hide for reactions
      } catch (apiError: any) {
        // Note: No loading toast to hide for reactions
        showError(
          'Reaction Failed',
          apiError.message || 'Unable to add reaction. Please try again.',
          {
            label: 'Retry',
            onClick: () => handleEmojiSelect(emojiCode)
          }
        )
      }
    } catch (error) {
      console.error('Error updating reaction:', error)
      // Note: No loading toast to hide for reactions
      showError(
        'Network Error',
        'Please check your connection and try again.',
        {
          label: 'Retry',
          onClick: () => handleEmojiSelect(emojiCode)
        }
      )
    } finally {
      setIsReactionLoading(false)
    }
    
    setShowEmojiPicker(false)
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
      // Redirect to login for unauthenticated users
      router.push('/auth/login')
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
    try {
      const token = getAccessToken()
      if (!token) {
        showError('Authentication Error', 'Please log in to comment.')
        return
      }

      setIsCommentSubmitting(true)

      // Create the comment
      const newComment = await apiClient.post(`/posts/${post.id}/comments`, {
        content
      }) as any

      // Reload comments to show the new comment
      const updatedComments = await apiClient.get(`/posts/${post.id}/comments`) as any
      setComments(updatedComments)

      // Update comment count in post (includes all comments + replies)
      const newCount = (currentPost.commentsCount || 0) + 1
      setCurrentPost(prev => ({
        ...prev,
        commentsCount: newCount
      }))

      showSuccess('Comment Posted', 'Your comment has been added.')
    } catch (error: any) {
      console.error('Failed to post comment:', error)
      showError('Failed to Post', error.message || 'Unable to post comment. Please try again.')
      throw error // Re-throw to let modal handle it
    } finally {
      setIsCommentSubmitting(false)
    }
  }

  const handleReplySubmit = async (commentId: string, content: string) => {
    try {
      const token = getAccessToken()
      if (!token) {
        showError('Authentication Error', 'Please log in to reply.')
        return
      }

      // Use the correct endpoint for replies
      const newReply = await apiClient.post(`/comments/${commentId}/replies`, {
        content
      }) as any

      // Update comment count in post (includes all comments + replies)
      const newCount = (currentPost.commentsCount || 0) + 1
      setCurrentPost(prev => ({
        ...prev,
        commentsCount: newCount
      }))

      showSuccess('Reply Posted', 'Your reply has been added.')
    } catch (error: any) {
      console.error('Failed to post reply:', error)
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

      const replies = await apiClient.get(`/comments/${commentId}/replies`) as any
      return replies
    } catch (error: any) {
      console.error('Failed to load replies:', error)
      showError('Failed to Load', error.message || 'Unable to load replies. Please try again.')
      return []
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

  // Edit and delete handlers
  const handleEditPost = async (postData: {
    content: string
    postStyle?: any
    title?: string
    location?: string
    location_data?: any
    mentions?: string[]
    imageUrl?: string
    imageFile?: File
  }) => {
    try {
      const token = getAccessToken()
      if (!token) {
        showError('Authentication Error', 'Please log in to edit posts.')
        return
      }

      const loadingToastId = showLoading('Updating Post', 'Saving your changes...')

      let finalImageUrl = postData.imageUrl

      // If there's a new image file, upload it first
      if (postData.imageFile) {
        try {
          const formData = new FormData()
          formData.append('image', postData.imageFile)

          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData
          })

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            finalImageUrl = uploadResult.url || uploadResult.file_url
          } else {
            throw new Error('Failed to upload image')
          }
        } catch (uploadError) {
          hideToast(loadingToastId)
          showError('Upload Failed', 'Failed to upload image. Please try again.')
          return
        }
      }

      const updateData = {
        content: postData.content,
        post_style: postData.postStyle,
        title: postData.title,
        image_url: finalImageUrl,
        location: postData.location,
        location_data: postData.location_data
      }

      try {
        // Use optimized API client for post update
        const raw = await apiClient.put(`/posts/${post.id}`, updateData) as any
        
        hideToast(loadingToastId)
        
        debugApiResponse(raw, "PUT /api/posts/:id response")
        
        const normalized = normalizePostFromApi(raw)
        if (!normalized) {
          console.warn("Could not normalize post response:", raw)
          // Fallback: close modal and try to refetch from server
          setShowEditModal(false)
          if (onEdit) onEdit(post.id, raw) // best-effort
          return
        }

        showSuccess('Post Updated', 'Your post has been updated successfully.')
        setShowEditModal(false)
        
        // Merge updated fields into local post state (safe)
        // Use specialized merge function to preserve author fields like profile image
        setCurrentPost(prev => mergePostUpdate(prev, normalized))
        
        // Call the onEdit callback if provided
        if (onEdit) {
          onEdit(post.id, normalized)
        }
      } catch (error: any) {
        hideToast(loadingToastId)
        
        // Handle API client errors
        let errorMessage = 'Unable to update post. Please try again.'
        if (error.message) {
          errorMessage = error.message
        }
        
        showError(
          'Update Failed',
          errorMessage,
          {
            label: 'Retry',
            onClick: () => handleEditPost(postData)
          }
        )
      }
    } catch (error) {
      console.error('Error updating post:', error)
      showError(
        'Network Error',
        'Please check your connection and try again.',
        {
          label: 'Retry',
          onClick: () => handleEditPost(postData)
        }
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
      const loadingToastId = showLoading('Deleting Post', 'Removing your post...')

      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })

      hideToast(loadingToastId)

      if (response.ok) {
        showSuccess('Post Deleted', 'Your post has been deleted successfully.')
        setShowDeleteModal(false)
        
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

  // Get styling based on post type - now standardized with consistent dimensions
  const getPostStyling = () => {
    const isUnread = currentPost.isUnread
    
    // Standardized styling for all post types - same base size and spacing
    const baseStyle = {
      container: `bg-white rounded-lg shadow-md border ${isUnread ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-200'} overflow-hidden mb-6`,
      header: 'p-5 border-b border-gray-100',
      avatar: 'w-10 h-10',
      name: 'font-semibold text-base',
      content: 'p-5',
      text: 'text-base leading-relaxed',
      actions: 'px-5 py-3 border-t border-gray-100',
      iconSize: 'h-5 w-5',
      textSize: 'text-sm'
    }
    
    // Visual distinction through content styling rather than card size
    switch (currentPost.postType) {
      case 'daily':
        return {
          ...baseStyle,
          badge: 'text-sm px-3 py-2 bg-purple-100 text-purple-700 rounded-full capitalize font-medium',
          // Daily posts get enhanced text styling for prominence
          text: 'text-base leading-relaxed font-medium text-gray-900'
        }
      case 'photo':
        return {
          ...baseStyle,
          badge: 'text-sm px-3 py-2 bg-blue-100 text-blue-700 rounded-full capitalize font-medium',
          // Photo posts maintain standard text styling
          text: 'text-base leading-relaxed text-gray-800'
        }
      default: // spontaneous
        return {
          ...baseStyle,
          badge: 'text-sm px-3 py-2 bg-gray-100 text-gray-600 rounded-full capitalize font-medium',
          // Spontaneous posts get subtle text styling
          text: 'text-base leading-relaxed text-gray-700'
        }
    }
  }

  const styling = getPostStyling()

  return (
    <>
      <article className={styling.container} data-post-id={post.id}>
        {/* Post Header */}
        <div className={styling.header}>
          <div className="flex items-start space-x-6">
            <ProfilePhotoDisplay
              photoUrl={currentPost.author.image}
              username={currentPost.author.username || currentPost.author.name}
              size={styling.avatar.includes('w-12') ? 'md' : 'lg'}
              className="cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all flex-shrink-0"
              onClick={() => onUserClick?.(currentPost.author.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-4">
                <div 
                  className="cursor-pointer hover:text-purple-700 transition-colors flex-shrink-0"
                  onClick={() => onUserClick?.(currentPost.author.id)}
                >
                  <h3 className={`${styling.name} text-gray-900 font-bold`}>
                    {currentPost.author.display_name || currentPost.author.name}
                  </h3>
                </div>
                {/* Follow button positioned next to the user display name */}
                {currentUserId && 
                 currentUserId !== currentPost.author.id && 
                 !isNaN(parseInt(currentPost.author.id)) &&
                 !hideFollowButton && (
                  <FollowButton 
                    userId={parseInt(currentPost.author.id)} 
                    size="xxs"
                    variant="outline"
                  />
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <a 
                    href={`/post/${post.id}`}
                    className="hover:text-purple-600 hover:underline transition-colors cursor-pointer"
                    title="View post details"
                  >
                    {(() => {
                      const { dateString, wasEdited } = getDisplayDate()
                      const formattedDate = formatDate(dateString)
                      return wasEdited ? `${formattedDate} (edited)` : formattedDate
                    })()}
                  </a>
                </div>
                {/* Location on mobile - separate line to avoid collision with follow button */}
                {(currentPost.location_data || currentPost.location) && (
                  <div className="flex items-center space-x-1 sm:hidden">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
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
                      className="text-gray-500 hover:text-purple-600 hover:underline transition-colors text-xs truncate max-w-[200px]"
                      title="View location details"
                    >
                      {currentPost.location_data ? currentPost.location_data.display_name : currentPost.location}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 max-w-[40%]">
              {/* Location on desktop - positioned in top-right corner */}
              {(currentPost.location_data || currentPost.location) && (
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
                  className="hidden sm:flex items-center gap-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-full px-2 py-1 transition-all duration-200 min-w-[44px] min-h-[44px] max-w-full"
                  title="View location details"
                >
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs truncate">
                    {currentPost.location_data ? currentPost.location_data.display_name : currentPost.location}
                  </span>
                </button>
              )}
              {/* Options Menu for Post Author */}
              {isPostAuthor && (
                <div className="relative flex-shrink-0">
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
              )}
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div 
          className={`${styling.content} post-content-area`}
          dir={getDirectionAttribute(currentPost.content)}
        >
          {/* Always use RichContentRenderer for consistency */}
          <RichContentRenderer
            content={currentPost.content}
            postStyle={currentPost.postStyle}
            post_style={currentPost.post_style}
            className={`${styling.text} text-gray-900 ${getTextAlignmentClass(currentPost.content)}`}
            onMentionClick={handleMentionClick}
            validUsernames={validUsernames}
          />
          {currentPost.imageUrl && (
            <OptimizedPostImage
              src={getImageUrl(currentPost.imageUrl) || currentPost.imageUrl}
              alt="Post image"
              postType={currentPost.postType}
            />
          )}
        </div>

        {/* Post Actions */}
        <div className={styling.actions}>
          {/* Authentication Notice for logged-out users - only show if currentUserId is explicitly undefined */}
          {currentUserId === undefined && !isUserAuthenticated && (
            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-sm text-blue-700 font-medium">
                    Join to interact with this post
                  </span>
                </div>
                <div className="flex space-x-2">
                  <a
                    href="/auth/login"
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                  >
                    Log In
                  </a>
                  <a
                    href="/auth/signup"
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                  >
                    Sign Up
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Engagement Summary for highly engaged posts */}
          {((post.heartsCount || 0) + (post.reactionsCount || 0)) > 5 && (
            <div className="mb-2 px-2 py-1 bg-gradient-to-r from-purple-50 to-purple-100 rounded-full">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <span className="flex items-center space-x-1">
                  <span className="text-xs">💜</span>
                  <span>{post.heartsCount || 0}</span>
                </span>
                {(post.reactionsCount || 0) > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <span className="text-purple-400">😊</span>
                      <span>{post.reactionsCount}</span>
                    </span>
                  </>
                )}
                <span className="text-gray-400">•</span>
                <span className="font-medium text-purple-600">
                  {(post.heartsCount || 0) + (post.reactionsCount || 0)} total reactions
                </span>
              </div>
            </div>
          )}
          
          {/* Post Actions Toolbar - Four main buttons in single horizontal line */}
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Heart Button */}
            <button 
              onClick={async () => {
                if (!isUserAuthenticated) {
                  // Call the onHeart handler which will handle the redirect
                  onHeart?.(post.id, currentPost.isHearted || false)
                  return
                }

                if (isHeartLoading) return

                const isCurrentlyHearted = currentPost.isHearted || false
                setIsHeartLoading(true)
                
                // Track analytics event
                if (currentUserId) {
                  analyticsService.trackHeartEvent(post.id, currentUserId, !isCurrentlyHearted)
                }
                
                // Note: Removed loading toast for hearts to reduce visual noise
                // The heart UI provides sufficient visual feedback
                const loadingToastId = '' // Placeholder for error handling
                
                try {
                  const token = getAccessToken()
                  const method = isCurrentlyHearted ? 'DELETE' : 'POST'
                  
                  try {
                    // Use optimized API client for heart action
                    if (method === 'POST') {
                      await apiClient.post(`/posts/${post.id}/heart`)
                    } else {
                      await apiClient.delete(`/posts/${post.id}/heart`)
                    }
                    
                    // Get updated heart info from server
                    const heartInfo = await apiClient.get(`/posts/${post.id}/hearts`) as any
                    
                    // Call handler with updated server data
                    onHeart?.(post.id, isCurrentlyHearted, heartInfo)
                    
                    // Note: No loading toast to hide for hearts
                  } catch (error: any) {
                    // Note: No loading toast to hide for hearts
                    showError(
                      'Heart Failed',
                      error.message || 'Unable to update heart. Please try again.',
                      {
                        label: 'Retry',
                        onClick: () => {
                          // Retry the heart action
                          setTimeout(() => {
                            const button = document.querySelector(`[data-post-id="${post.id}"] .heart-button`) as HTMLButtonElement
                            button?.click()
                          }, 100)
                        }
                      }
                    )
                  }
                } catch (error) {
                  console.error('Error updating heart:', error)
                  // Note: No loading toast to hide for hearts
                  showError(
                    'Network Error',
                    'Please check your connection and try again.',
                    {
                      label: 'Retry',
                      onClick: () => {
                        // Retry the heart action
                        setTimeout(() => {
                          const button = document.querySelector(`[data-post-id="${post.id}"] .heart-button`) as HTMLButtonElement
                          button?.click()
                        }, 100)
                      }
                    }
                  )
                } finally {
                  setIsHeartLoading(false)
                }
              }}
              disabled={isHeartLoading}
              className={`heart-button flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] ${
                !isUserAuthenticated
                  ? 'text-gray-400 cursor-pointer hover:bg-gray-50'
                  : currentPost.isHearted 
                    ? 'text-purple-500 hover:text-purple-600 bg-purple-50 hover:bg-purple-100' 
                    : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
              }`}
              title={!isUserAuthenticated ? 'Login to like posts' : undefined}
            >
              {isHeartLoading ? (
                <Loader2 className={`${styling.iconSize} animate-spin flex-shrink-0`} />
              ) : (
                <Heart 
                  className={`${styling.iconSize} flex-shrink-0 ${currentPost.isHearted ? 'fill-purple-500 text-purple-500' : 'text-current'}`}
                />
              )}
              <span 
                className={`${styling.textSize} font-medium ${isUserAuthenticated && !isHeartsViewerLoading ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isUserAuthenticated && !isHeartsViewerLoading) {
                    handleHeartsCountClick()
                  }
                }}
              >
                {isHeartsViewerLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                ) : (
                  post.heartsCount || 0
                )}
              </span>
            </button>

            {/* Emoji Reaction Button */}
            <button
              ref={reactionButtonRef}
              onClick={handleReactionButtonClick}
              disabled={isReactionLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] ${
                !isUserAuthenticated
                  ? 'text-gray-400 cursor-pointer hover:bg-gray-50'
                  : post.currentUserReaction
                    ? 'text-purple-500 hover:text-purple-600 bg-purple-50 hover:bg-purple-100'
                    : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
              } ${(post.reactionsCount || 0) > 0 ? 'ring-1 ring-purple-200' : ''}`}
              title={!isUserAuthenticated ? 'Login to react to posts' : 'React with emoji'}
            >
              {isReactionLoading ? (
                <Loader2 className={`${styling.iconSize} animate-spin flex-shrink-0`} />
              ) : post.currentUserReaction ? (
                <span className={`flex-shrink-0 ${styling.iconSize.includes('h-6') ? 'text-xl' : styling.iconSize.includes('h-5') ? 'text-lg' : 'text-base'}`}>
                  {getEmojiFromCode(post.currentUserReaction)}
                </span>
              ) : (
                <div className={`${styling.iconSize} rounded-full border-2 border-current flex items-center justify-center flex-shrink-0`}>
                  <Plus className="h-3 w-3" />
                </div>
              )}
              <span 
                className={`${styling.textSize} font-medium ${!isReactionsViewerLoading ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isReactionsViewerLoading) {
                    handleReactionCountClick()
                  }
                }}
              >
                {isReactionsViewerLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                ) : (
                  post.reactionsCount || 0
                )}
              </span>
            </button>

            {/* Comments Button */}
            <button
              onClick={handleCommentsButtonClick}
              disabled={isCommentsLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] ${
                !isUserAuthenticated
                  ? 'text-gray-400 cursor-pointer hover:bg-gray-50'
                  : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
              } ${(currentPost.commentsCount || 0) > 0 ? 'ring-1 ring-purple-200' : ''}`}
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
        </div>
      </article>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
        currentReaction={post.currentUserReaction}
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
        onCommentSubmit={handleCommentSubmit}
        onReplySubmit={handleReplySubmit}
        onLoadReplies={handleLoadReplies}
        isSubmitting={isCommentSubmitting}
      />

      {/* Location Display Modal */}
      <LocationDisplayModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        location={currentPost.location}
        locationData={currentPost.location_data}
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
    </>
  )
}