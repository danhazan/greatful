"use client"

import { useState, useRef, useEffect } from "react"
import { X } from "lucide-react"
import { getEmojiFromCode } from "@/utils/emojiMapping"
import { formatTimeAgo } from "@/utils/timeAgo"
import ProfilePhotoDisplay from "./ProfilePhotoDisplay"

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

  // Handle escape key and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
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
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 sm:p-6">
        <div 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reaction-viewer-title"
          aria-describedby="reaction-viewer-description"
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md max-h-[85vh] sm:max-h-[80vh] flex flex-col touch-manipulation"
          tabIndex={-1}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 id="reaction-viewer-title" className="text-lg font-semibold text-gray-900">
              Reactions ({totalCount})
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              aria-label="Close reactions modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar" role="main">
            {totalCount === 0 ? (
              <div className="p-6 sm:p-8 text-center" role="status" aria-label="No reactions yet">
                <div className="text-gray-400 text-4xl mb-4" aria-hidden="true">😊</div>
                <p className="text-gray-500">No reactions yet</p>
                <p id="reaction-viewer-description" className="text-sm text-gray-400 mt-1">Be the first to react!</p>
              </div>
            ) : (
              <div className="p-3 sm:p-4 space-y-4" role="list" aria-label="Reactions by emoji type">
                <div className="sr-only" id="reaction-viewer-description">
                  List of users who reacted to this post, grouped by emoji type. Use tab to navigate through reactions.
                </div>
                {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => (
                  <div key={emoji} className="space-y-2" role="group" aria-labelledby={`emoji-${emoji}-header`}>
                    {/* Emoji Header */}
                    <div className="flex items-center space-x-2 px-2">
                      <span className="text-xl" aria-hidden="true">{emoji}</span>
                      <span id={`emoji-${emoji}-header`} className="text-sm text-gray-500 font-medium">
                        {emojiReactions.length} {emojiReactions.length === 1 ? 'reaction' : 'reactions'}
                      </span>
                    </div>
                    
                    {/* Users who reacted with this emoji */}
                    <div className="space-y-2" role="list" aria-label={`Users who reacted with ${emoji}`}>
                      {emojiReactions.map((reaction) => (
                        <div 
                          key={reaction.id}
                          className="flex items-center space-x-3 p-3 sm:p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer min-h-[44px] touch-manipulation active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset"
                          onClick={() => onUserClick?.(parseInt(reaction.userId))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onUserClick?.(parseInt(reaction.userId))
                            }
                          }}
                          role="listitem"
                          tabIndex={0}
                          aria-label={`${reaction.userName} reacted with ${emoji} ${formatTimeAgo(reaction.createdAt)}. Press to view profile.`}
                        >
                          {/* User Avatar */}
                          <div className="flex-shrink-0">
                            <ProfilePhotoDisplay
                              photoUrl={reaction.userImage}
                              username={reaction.userName}
                              size="sm"
                              className="border-0 shadow-none"
                            />
                          </div>
                          
                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {reaction.userName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatTimeAgo(reaction.createdAt)}
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
              className="w-full px-4 py-3 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors min-h-[44px] touch-manipulation active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              aria-label="Close reactions modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}