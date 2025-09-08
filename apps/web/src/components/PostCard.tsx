"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Share, Calendar, MapPin, Plus, Loader2 } from "lucide-react"
import EmojiPicker from "./EmojiPicker"
import ReactionViewer from "./ReactionViewer"
import HeartsViewer from "./HeartsViewer"
import ShareModal from "./ShareModal"
import MentionHighlighter from "./MentionHighlighter"
import FollowButton from "./FollowButton"
import ProfilePhotoDisplay from "./ProfilePhotoDisplay"
import RichContentRenderer from "./RichContentRenderer"
import analyticsService from "@/services/analytics"
import { getEmojiFromCode } from "@/utils/emojiMapping"
import { getImageUrl } from "@/utils/imageUtils"
import { isAuthenticated, getAccessToken } from "@/utils/auth"
import { getUniqueUsernames, isValidUsername } from "@/utils/mentionUtils"
import { useToast } from "@/contexts/ToastContext"

interface Post {
  id: string
  content: string
  richContent?: string
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
  author: {
    id: string
    name: string
    username?: string
    display_name?: string
    image?: string
  }
  createdAt: string
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
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
  currentUserReaction?: string
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
  onUserClick 
}: PostCardProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionViewer, setShowReactionViewer] = useState(false)
  const [showHeartsViewer, setShowHeartsViewer] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false)

  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 })
  const [shareModalPosition, setShareModalPosition] = useState({ x: 0, y: 0 })
  const [reactions, setReactions] = useState<any[]>([]) // Will be populated from API
  const [hearts, setHearts] = useState<any[]>([]) // Will be populated from API
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const [validUsernames, setValidUsernames] = useState<string[]>([])
  
  // Loading states
  const [isHeartLoading, setIsHeartLoading] = useState(false)
  const [isReactionLoading, setIsReactionLoading] = useState(false)
  const [isReactionsViewerLoading, setIsReactionsViewerLoading] = useState(false)
  const [isHeartsViewerLoading, setIsHeartsViewerLoading] = useState(false)
  
  const reactionButtonRef = useRef<HTMLButtonElement>(null)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const { showSuccess, showError, showLoading, hideToast } = useToast()

  // Check authentication status on mount and when currentUserId changes
  useEffect(() => {
    setIsUserAuthenticated(isAuthenticated() && !!currentUserId)
  }, [currentUserId])

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

      if (!post.content || !isAuthenticated() || !currentUserId) {
        setValidUsernames([])
        return
      }

      const usernames = getUniqueUsernames(post.content)
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

        // Use batch validation endpoint to avoid 404 errors
        const response = await fetch('/api/users/validate-batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            usernames: validFormatUsernames
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          setValidUsernames(result.data.valid_usernames || [])
        } else {
          setValidUsernames([])
        }
      } catch (error) {
        // Only log errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error('Error validating usernames:', error)
        }
        setValidUsernames([])
      }
    }

    validateMentions()
  }, [post.content, currentUserId])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    return date.toLocaleDateString()
  }

  const handleReactionButtonClick = async (event: React.MouseEvent) => {
    event.preventDefault()
    
    if (!isUserAuthenticated) {
      // Call the onReaction handler which will handle the redirect
      onReaction?.(post.id, 'heart_eyes') // Use a default emoji for the redirect
      return
    }
    
    // If user already has a reaction, remove it
    if (post.currentUserReaction && onRemoveReaction) {
      // Track analytics event for reaction removal
      if (currentUserId) {
        analyticsService.trackReactionEvent(
          'reaction_remove',
          post.id,
          currentUserId,
          undefined,
          post.currentUserReaction
        )
      }
      
      try {
        const token = getAccessToken()
        
        // Make API call to remove reaction
        const response = await fetch(`/api/posts/${post.id}/reactions`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          // Get updated reaction summary from server
          const summaryResponse = await fetch(`/api/posts/${post.id}/reactions/summary`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })
          
          if (summaryResponse.ok) {
            const reactionSummary = await summaryResponse.json()
            // Call handler with updated server data
            onRemoveReaction(post.id, reactionSummary)
          } else {
            // Fallback to original handler if summary fetch fails
            onRemoveReaction(post.id)
          }
        } else {
          console.error('Failed to remove reaction')
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
      const eventType = post.currentUserReaction ? 'reaction_change' : 'reaction_add'
      analyticsService.trackReactionEvent(
        eventType,
        post.id,
        currentUserId,
        emojiCode,
        post.currentUserReaction
      )
    }
    
    // Note: Removed loading toast for reactions to reduce visual noise
    // The reaction UI provides sufficient visual feedback
    const loadingToastId = '' // Placeholder for error handling
    
    try {
      const token = localStorage.getItem("access_token")
      
      // Make API call to add/update reaction
      const response = await fetch(`/api/posts/${post.id}/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji_code: emojiCode })
      })
      
      if (response.ok) {
        // Get updated reaction summary from server
        const summaryResponse = await fetch(`/api/posts/${post.id}/reactions/summary`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (summaryResponse.ok) {
          const reactionSummary = await summaryResponse.json()
          // Call handler with updated server data
          onReaction?.(post.id, emojiCode, reactionSummary)
          
          // Note: No loading toast to hide for reactions
        } else {
          // Fallback to original handler if summary fetch fails
          onReaction?.(post.id, emojiCode)
          // Note: No loading toast to hide for reactions
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        // Note: No loading toast to hide for reactions
        showError(
          'Reaction Failed',
          errorData.message || 'Unable to add reaction. Please try again.',
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
      const response = await fetch(`/api/posts/${post.id}/hearts/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const heartsData = await response.json()
        setHearts(heartsData)
        setShowHeartsViewer(true)
      } else {
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

  // Get styling based on post type
  const getPostStyling = () => {
    switch (post.postType) {
      case 'daily':
        return {
          container: 'bg-white rounded-xl shadow-lg border-2 border-purple-100 overflow-hidden mb-8',
          header: 'p-6 border-b border-gray-100',
          avatar: 'w-12 h-12',
          name: 'font-bold text-lg',
          badge: 'text-sm px-3 py-2 bg-purple-100 text-purple-700 rounded-full capitalize font-medium',
          content: 'p-6',
          text: 'text-lg leading-relaxed',
          image: 'w-full h-80 object-contain rounded-lg mt-4 bg-gray-50',
          actions: 'px-6 py-4 border-t border-gray-100',
          iconSize: 'h-6 w-6',
          textSize: 'text-base font-medium'
        }
      case 'photo':
        return {
          container: 'bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6',
          header: 'p-5 border-b border-gray-100',
          avatar: 'w-10 h-10',
          name: 'font-semibold text-base',
          badge: 'text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full capitalize',
          content: 'p-5',
          text: 'text-base leading-relaxed',
          image: 'w-full h-64 object-contain rounded-lg mt-4 bg-gray-50',
          actions: 'px-5 py-3 border-t border-gray-100',
          iconSize: 'h-5 w-5',
          textSize: 'text-sm'
        }
      default: // spontaneous
        return {
          container: 'bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4',
          header: 'p-3 border-b border-gray-100',
          avatar: 'w-8 h-8',
          name: 'font-medium text-sm',
          badge: 'text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize',
          content: 'p-3',
          text: 'text-sm leading-relaxed',
          image: 'w-full h-48 object-contain rounded-lg mt-3 bg-gray-50',
          actions: 'px-3 py-2 border-t border-gray-100',
          iconSize: 'h-4 w-4',
          textSize: 'text-xs'
        }
    }
  }

  const styling = getPostStyling()

  return (
    <>
      <article className={styling.container} data-post-id={post.id}>
        {/* Post Header */}
        <div className={styling.header}>
          <div className="flex items-start space-x-3">
            <ProfilePhotoDisplay
              photoUrl={post.author.image}
              username={post.author.username || post.author.name}
              size={styling.avatar.includes('w-12') ? 'md' : 'lg'}
              className="cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all"
              onClick={() => onUserClick?.(post.author.id)}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <div 
                  className="cursor-pointer hover:text-purple-700 transition-colors"
                  onClick={() => onUserClick?.(post.author.id)}
                >
                  <h3 className={`${styling.name} text-gray-900 font-bold`}>
                    {post.author.display_name || post.author.name}
                  </h3>
                </div>
                {/* Follow button positioned right next to the username */}
                {currentUserId && 
                 currentUserId !== post.author.id && 
                 !isNaN(parseInt(post.author.id)) &&
                 !hideFollowButton && (
                  <FollowButton 
                    userId={parseInt(post.author.id)} 
                    size="xxs"
                    variant="outline"
                  />
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <a 
                  href={`/post/${post.id}`}
                  className="hover:text-purple-600 hover:underline transition-colors cursor-pointer"
                  title="View post details"
                >
                  {formatDate(post.createdAt)}
                </a>

              </div>
            </div>
            <div className={styling.badge}>
              {post.postType}
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className={styling.content}>
          {/* Always use RichContentRenderer for consistency */}

          <RichContentRenderer
            content={post.content}
            richContent={post.richContent}
            postStyle={post.postStyle}
            className={`${styling.text} text-gray-900`}
            onMentionClick={handleMentionClick}
          />
          {post.imageUrl && (
            <img
              src={getImageUrl(post.imageUrl) || post.imageUrl}
              alt="Post image"
              className={styling.image}
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
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Heart Button */}
              <button 
                onClick={async () => {
                  if (!isUserAuthenticated) {
                    // Call the onHeart handler which will handle the redirect
                    onHeart?.(post.id, post.isHearted || false)
                    return
                  }

                  if (isHeartLoading) return

                  const isCurrentlyHearted = post.isHearted || false
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
                    
                    const response = await fetch(`/api/posts/${post.id}/heart`, {
                      method,
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                    })
                    
                    if (response.ok) {
                      // Get updated heart info from server
                      const heartInfoResponse = await fetch(`/api/posts/${post.id}/hearts`, {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                        },
                      })
                      
                      if (heartInfoResponse.ok) {
                        const heartInfo = await heartInfoResponse.json()
                        // Call handler with updated server data
                        onHeart?.(post.id, isCurrentlyHearted, heartInfo)
                        
                        // Note: No loading toast to hide for hearts
                      } else {
                        // Fallback to original handler if heart info fetch fails
                        onHeart?.(post.id, isCurrentlyHearted)
                        // Note: No loading toast to hide for hearts
                        // Heart action completed successfully
                      }
                    } else {
                      const errorData = await response.json().catch(() => ({}))
                      // Note: No loading toast to hide for hearts
                      showError(
                        'Heart Failed',
                        errorData.message || 'Unable to update heart. Please try again.',
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
                className={`heart-button flex items-center space-x-1.5 px-2 py-1 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  !isUserAuthenticated
                    ? 'text-gray-400 cursor-pointer hover:bg-gray-50'
                    : post.isHearted 
                      ? 'text-purple-500 hover:text-purple-600 bg-purple-50 hover:bg-purple-100' 
                      : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
                }`}
                title={!isUserAuthenticated ? 'Login to like posts' : undefined}
              >
                {isHeartLoading ? (
                  <Loader2 className={`${styling.iconSize} animate-spin`} />
                ) : (
                  <span className={`${styling.iconSize.includes('h-6') ? 'text-xl' : styling.iconSize.includes('h-5') ? 'text-lg' : 'text-base'}`}>
                    💜
                  </span>
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
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  !isUserAuthenticated
                    ? 'text-gray-400 cursor-pointer hover:bg-gray-50'
                    : post.currentUserReaction
                      ? 'text-purple-500 hover:text-purple-600 bg-purple-50 hover:bg-purple-100'
                      : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
                } ${(post.reactionsCount || 0) > 0 ? 'ring-1 ring-purple-200' : ''}`}
                title={!isUserAuthenticated ? 'Login to react to posts' : 'React with emoji'}
              >
                {isReactionLoading ? (
                  <Loader2 className={`${styling.iconSize} animate-spin`} />
                ) : post.currentUserReaction ? (
                  <span className={styling.iconSize.includes('h-6') ? 'text-xl' : styling.iconSize.includes('h-5') ? 'text-lg' : 'text-base'}>
                    {getEmojiFromCode(post.currentUserReaction)}
                  </span>
                ) : (
                  <div className={`${styling.iconSize} rounded-full border-2 border-current flex items-center justify-center`}>
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
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-gray-500 hover:text-green-500 hover:bg-green-50 transition-all duration-200 ${styling.textSize}`}
              >
                <Share className={styling.iconSize} />
                <span className="font-medium">Share</span>
              </button>
            </div>

            {/* Location Display - Right aligned */}
            {(post.location_data || post.location) && (
              <div className="flex items-center space-x-1 text-gray-500">
                <MapPin className="h-4 w-4" />
                <span className={`${styling.textSize} truncate max-w-32`}>
                  {post.location_data ? post.location_data.display_name : post.location}
                </span>
              </div>
            )}
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
    </>
  )
}