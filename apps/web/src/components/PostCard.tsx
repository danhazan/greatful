"use client"

import { useState, useRef, useEffect } from "react"
import { Heart, Share, Calendar, MapPin, Plus } from "lucide-react"
import EmojiPicker from "./EmojiPicker"
import ReactionViewer from "./ReactionViewer"
import analyticsService from "@/services/analytics"
import { getEmojiFromCode } from "@/utils/emojiMapping"

interface Post {
  id: string
  content: string
  author: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
  currentUserReaction?: string
}

interface PostCardProps {
  post: Post
  currentUserId?: string
  onHeart?: (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => void
  onReaction?: (postId: string, emojiCode: string) => void
  onRemoveReaction?: (postId: string) => void
  onShare?: (postId: string) => void
  onUserClick?: (userId: string) => void
}

// Removed local emoji mapping - now using utility function

export default function PostCard({ 
  post, 
  currentUserId,
  onHeart, 
  onReaction,
  onRemoveReaction,
  onShare,
  onUserClick 
}: PostCardProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionViewer, setShowReactionViewer] = useState(false)
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 })
  const [reactions, setReactions] = useState<any[]>([]) // Will be populated from API
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const reactionButtonRef = useRef<HTMLButtonElement>(null)

  // Track post view when component mounts
  useEffect(() => {
    if (!hasTrackedView && currentUserId) {
      analyticsService.trackViewEvent(post.id, currentUserId)
      setHasTrackedView(true)
    }
  }, [post.id, hasTrackedView, currentUserId])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    return date.toLocaleDateString()
  }

  const handleReactionButtonClick = (event: React.MouseEvent) => {
    event.preventDefault()
    
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
      onRemoveReaction(post.id)
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

  const handleEmojiSelect = (emojiCode: string) => {
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
    
    if (onReaction) {
      onReaction(post.id, emojiCode)
    }
    setShowEmojiPicker(false)
  }

  const handleReactionCountClick = async () => {
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
      }
    } catch (error) {
      console.error('Failed to fetch reactions:', error)
    }
  }

  const handleUserClick = (userId: number) => {
    if (onUserClick) {
      onUserClick(userId.toString())
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
      <article className={styling.container}>
        {/* Post Header */}
        <div className={styling.header}>
          <div className="flex items-center space-x-3">
            <img
              src={post.author.image || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"}
              alt={post.author.name}
              className={`${styling.avatar} rounded-full cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all`}
              onClick={() => onUserClick?.(post.author.id)}
            />
            <div className="flex-1">
              <h3 
                className={`${styling.name} text-gray-900 cursor-pointer hover:text-purple-700 transition-colors`}
                onClick={() => onUserClick?.(post.author.id)}
              >
                {post.author.name}
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(post.createdAt)}</span>
                {post.location && (
                  <>
                    <MapPin className="h-4 w-4" />
                    <span>{post.location}</span>
                  </>
                )}
              </div>
            </div>
            <div className={styling.badge}>
              {post.postType}
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className={styling.content}>
          <p className={`${styling.text} text-gray-900`}>{post.content}</p>
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt="Post image"
              className={styling.image}
            />
          )}
        </div>

        {/* Post Actions */}
        <div className={styling.actions}>
          {/* Engagement Summary for highly engaged posts */}
          {((post.heartsCount || 0) + (post.reactionsCount || 0)) > 5 && (
            <div className="mb-2 px-2 py-1 bg-gradient-to-r from-purple-50 to-red-50 rounded-full">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <span className="flex items-center space-x-1">
                  <Heart className="h-3 w-3 text-red-400 fill-current" />
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
                  const isCurrentlyHearted = post.isHearted || false
                  
                  // Track analytics event
                  if (currentUserId) {
                    analyticsService.trackHeartEvent(post.id, currentUserId, !isCurrentlyHearted)
                  }
                  
                  try {
                    const token = localStorage.getItem("access_token")
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
                      } else {
                        // Fallback to original handler if heart info fetch fails
                        onHeart?.(post.id, isCurrentlyHearted)
                      }
                    } else {
                      console.error('Failed to update heart status')
                    }
                  } catch (error) {
                    console.error('Error updating heart:', error)
                  }
                }}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full transition-all duration-200 ${
                  post.isHearted 
                    ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100' 
                    : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                <Heart className={`${styling.iconSize} ${post.isHearted ? 'fill-current' : ''}`} />
                <span className={`${styling.textSize} font-medium`}>{post.heartsCount || 0}</span>
              </button>

              {/* Emoji Reaction Button */}
              <button
                ref={reactionButtonRef}
                onClick={handleReactionButtonClick}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full transition-all duration-200 ${
                  post.currentUserReaction
                    ? 'text-purple-500 hover:text-purple-600 bg-purple-50 hover:bg-purple-100'
                    : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
                } ${(post.reactionsCount || 0) > 0 ? 'ring-1 ring-purple-200' : ''}`}
                title="React with emoji"
              >
                {post.currentUserReaction ? (
                  <span className={styling.iconSize.includes('h-6') ? 'text-xl' : styling.iconSize.includes('h-5') ? 'text-lg' : 'text-base'}>
                    {getEmojiFromCode(post.currentUserReaction)}
                  </span>
                ) : (
                  <div className={`${styling.iconSize} rounded-full border-2 border-current flex items-center justify-center`}>
                    <Plus className="h-3 w-3" />
                  </div>
                )}
                <span 
                  className={`${styling.textSize} font-medium cursor-pointer hover:underline`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReactionCountClick()
                  }}
                >
                  {post.reactionsCount || 0}
                </span>
              </button>



              {/* Share Button */}
              <button 
                onClick={() => {
                  // Track analytics event for share
                  if (currentUserId) {
                    analyticsService.trackShareEvent(post.id, currentUserId, 'url')
                  }
                  onShare?.(post.id)
                }}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-gray-500 hover:text-green-500 hover:bg-green-50 transition-all duration-200 ${styling.textSize}`}
              >
                <Share className={styling.iconSize} />
                <span className="font-medium">Share</span>
              </button>
            </div>
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
      />

      {/* Reaction Viewer Modal */}
      <ReactionViewer
        isOpen={showReactionViewer}
        onClose={() => setShowReactionViewer(false)}
        postId={post.id}
        reactions={reactions}
        onUserClick={handleUserClick}
      />
    </>
  )
}