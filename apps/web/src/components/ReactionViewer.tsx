"use client"

import { useEffect, useRef } from "react"
import { X, User } from "lucide-react"

interface Reaction {
  id: string
  user_id: number
  emoji_code: string
  emoji_display: string
  created_at: string
  user: {
    id: number
    username: string
    email: string
  }
}

interface ReactionViewerProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  reactions: Reaction[]
  onUserClick?: (userId: number) => void
}

const EMOJI_LABELS: Record<string, string> = {
  'heart_eyes': 'Heart Eyes',
  'hug': 'Hug',
  'pray': 'Pray',
  'muscle': 'Strong',
  'star': 'Star',
  'fire': 'Fire',
  'heart_face': 'Heart Face',
  'clap': 'Clap'
}

export default function ReactionViewer({ 
  isOpen, 
  onClose, 
  postId, 
  reactions,
  onUserClick 
}: ReactionViewerProps) {
  const modalRef = useRef<HTMLDivElement>(null)

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

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji_code]) {
      acc[reaction.emoji_code] = []
    }
    acc[reaction.emoji_code].push(reaction)
    return acc
  }, {} as Record<string, Reaction[]>)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    return date.toLocaleDateString()
  }

  const handleUserClick = (userId: number) => {
    if (onUserClick) {
      onUserClick(userId)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Reactions ({reactions.length})
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close reaction viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {reactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <div className="text-4xl mb-2">😊</div>
                <p className="text-sm">No reactions yet</p>
                <p className="text-xs text-gray-400 mt-1">Be the first to react!</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {Object.entries(groupedReactions).map(([emojiCode, emojiReactions]) => (
                  <div key={emojiCode} className="space-y-2">
                    {/* Emoji Section Header */}
                    <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                      <span className="text-lg">
                        {emojiReactions[0].emoji_display}
                      </span>
                      <span>
                        {EMOJI_LABELS[emojiCode]} ({emojiReactions.length})
                      </span>
                    </div>

                    {/* Users who reacted with this emoji */}
                    <div className="space-y-2 ml-6">
                      {emojiReactions.map((reaction) => (
                        <div
                          key={reaction.id}
                          className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                            onUserClick 
                              ? 'hover:bg-gray-50 cursor-pointer' 
                              : ''
                          }`}
                          onClick={() => handleUserClick(reaction.user.id)}
                        >
                          {/* User Avatar */}
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-purple-600" />
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {reaction.user.username}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(reaction.created_at)}
                            </p>
                          </div>

                          {/* Emoji */}
                          <span className="text-lg">
                            {reaction.emoji_display}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Click on users to view their profiles
            </p>
          </div>
        </div>
      </div>
    </>
  )
}