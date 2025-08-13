"use client"

import { useState, useRef } from "react"
import { Heart, MessageCircle, Share, Calendar, MapPin, Plus } from "lucide-react"
import EmojiPicker from "./EmojiPicker"
import ReactionViewer from "./ReactionViewer"

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
  onHeart?: (postId: string, isCurrentlyHearted: boolean) => void
  onReaction?: (postId: string, emojiCode: string) => void
  onRemoveReaction?: (postId: string) => void
  onShare?: (postId: string) => void
  onUserClick?: (userId: string) => void
}

const EMOJI_MAP: Record<string, string> = {
  'heart_eyes': '😍',
  'hug': '🤗',
  'pray': '🙏',
  'muscle': '💪',
  'star': '🌟',
  'fire': '🔥',
  'heart_face': '🥰',
  'clap': '👏'
}

const getEmojiFromCode = (code: string): string => {
  return EMOJI_MAP[code] || '😊'
}

export default function PostCard({ 
  post, 
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
  const reactionButtonRef = useRef<HTMLButtonElement>(null)

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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Heart Button */}
              <button 
                onClick={() => onHeart?.(post.id, post.isHearted || false)}
                className={`flex items-center space-x-2 transition-colors ${
                  post.isHearted 
                    ? 'text-red-500 hover:text-red-600' 
                    : 'text-gray-500 hover:text-red-500'
                }`}
              >
                <Heart className={`${styling.iconSize} ${post.isHearted ? 'fill-current' : ''}`} />
                <span className={styling.textSize}>{post.heartsCount || 0}</span>
              </button>

              {/* Emoji Reaction Button */}
              <button
                ref={reactionButtonRef}
                onClick={handleReactionButtonClick}
                className={`flex items-center space-x-2 transition-colors ${
                  post.currentUserReaction
                    ? 'text-purple-500 hover:text-purple-600'
                    : 'text-gray-500 hover:text-purple-500'
                }`}
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
                {(post.reactionsCount || 0) > 0 && (
                  <span 
                    className={`${styling.textSize} cursor-pointer hover:underline`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReactionCountClick()
                    }}
                  >
                    {post.reactionsCount}
                  </span>
                )}
              </button>



              {/* Share Button */}
              <button 
                onClick={() => onShare?.(post.id)}
                className={`flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors ${styling.textSize}`}
              >
                <Share className={styling.iconSize} />
                <span>Share</span>
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