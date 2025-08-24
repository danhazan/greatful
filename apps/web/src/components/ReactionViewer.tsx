"use client"

import { useState, useRef, useEffect } from "react"
import { X } from "lucide-react"
import { getEmojiFromCode } from "@/utils/emojiMapping"

interface Reaction {
  id: string
  userId: string
  userName: string
  userImage?: string
  emojiCode: string
  createdAt: string
}

interface ReactionViewerProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  reactions: Reaction[]
  onUserClick?: (userId: number) => void
}

// Remove old emoji mapping - now using utility function

export default function ReactionViewer({ isOpen, onClose, postId, reactions, onUserClick }: ReactionViewerProps) {
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
    const emoji = getEmojiFromCode(reaction.emojiCode)
    if (!acc[emoji]) {
      acc[emoji] = []
    }
    acc[emoji].push(reaction)
    return acc
  }, {} as Record<string, Reaction[]>)

  // Get total count
  const totalCount = reactions.length

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          ref={modalRef}
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Reactions ({totalCount})
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {totalCount === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">😊</div>
                <p className="text-gray-500">No reactions yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to react!</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => (
                  <div key={emoji} className="space-y-2">
                    {/* Emoji Header */}
                    <div className="flex items-center space-x-2 px-2">
                      <span className="text-xl">{emoji}</span>
                      <span className="text-sm text-gray-500 font-medium">
                        {emojiReactions.length}
                      </span>
                    </div>
                    
                    {/* Users who reacted with this emoji */}
                    <div className="space-y-2">
                      {emojiReactions.map((reaction) => (
                        <div 
                          key={reaction.id}
                          className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                          onClick={() => onUserClick?.(parseInt(reaction.userId))}
                        >
                          {/* User Avatar */}
                          <div className="flex-shrink-0">
                            {reaction.userImage ? (
                              <img
                                src={reaction.userImage}
                                alt={reaction.userName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-purple-600 text-sm font-medium">
                                  {reaction.userName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {reaction.userName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(reaction.createdAt).toLocaleString()}
                            </p>
                          </div>
                          
                          {/* Emoji */}
                          <div className="flex-shrink-0">
                            <span className="text-lg">{emoji}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}