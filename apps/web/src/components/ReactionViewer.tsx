"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, Loader2 } from "lucide-react"
import { getEmojiFromCode } from "@/utils/emojiMapping"
import { getAccessToken } from "@/utils/auth"
import { lockScroll, unlockScroll } from "@/utils/scrollLock"
import UserItem from "./UserItem"

import { 
  getDetailedReactionsFromCache, 
  updateDetailedReactionsCache, 
  type Reaction 
} from "@/hooks/useImageReactions"

interface ReactionViewerProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  objectId?: string
  objectType?: 'post' | 'image' | 'comment'
  reactions?: Reaction[]
  onUserClick?: (userId: number) => void
}

export default function ReactionViewer({ 
  isOpen, 
  onClose, 
  postId, 
  objectId, 
  objectType = 'post', 
  reactions: initialReactions, 
  onUserClick 
}: ReactionViewerProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions || [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dev-only integrity check
  if (process.env.NODE_ENV === 'development') {
    if (objectType === 'image' && !objectId) {
      console.warn('[ReactionViewer] objectType is "image" but no objectId provided. This will likely cause reaction leakage.');
    }
  }

  // Fetch reactions if not provided
  useEffect(() => {
    if (isOpen && initialReactions === undefined) {
      const loadReactions = async () => {
        // 1. Check central cache first
        const cacheKey = `${postId}:${objectType}:${objectId || 'none'}`
        const cached = getDetailedReactionsFromCache(cacheKey)
        if (cached) {
          setReactions(cached)
          return
        }

        setIsLoading(true)
        setError(null)
        try {
          const token = getAccessToken()
          const url = `/api/posts/${postId}/reactions?object_type=${objectType}${objectId ? `&object_id=${objectId}` : ''}`
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            setReactions(data)
            // 2. Update central cache
            updateDetailedReactionsCache(cacheKey, data)
          } else {
            setError('Failed to load reactions')
          }
        } catch (err) {
          setError('Network error. Please try again.')
        } finally {
          setIsLoading(false)
        }
      }
      loadReactions()
    } else if (initialReactions) {
      setReactions(initialReactions)
    }
  }, [isOpen, initialReactions, postId, objectId, objectType])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [isOpen])

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

  // Prevent background scroll events (wheel/touch) explicitly
  useEffect(() => {
    const preventDefault = (e: Event) => {
      // If we're scrolling inside the content area, allow it
      const target = e.target as HTMLElement;
      const isInsideScrollable = target.closest('.overflow-y-auto');
      
      if (!isInsideScrollable) {
        e.preventDefault();
      }
    };

    if (isOpen) {
      window.addEventListener('wheel', preventDefault, { passive: false });
      window.addEventListener('touchmove', preventDefault, { passive: false });
      
      return () => {
        window.removeEventListener('wheel', preventDefault);
        window.removeEventListener('touchmove', preventDefault);
      };
    }
  }, [isOpen])

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

  // Group reactions by emoji code
  const groupedReactions = reactions.reduce((acc: Record<string, Reaction[]>, reaction: Reaction) => {
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

  if (typeof window === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[80]" 
        onClick={onClose} 
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[81] p-4 sm:p-6 pointer-events-none">
        <div 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reaction-viewer-title"
          aria-describedby="reaction-viewer-description"
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md max-h-[85vh] sm:max-h-[80vh] flex flex-col touch-manipulation pointer-events-auto"
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
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                <p className="text-gray-500 text-sm">Loading reactions...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="text-purple-500 font-medium hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : totalCount === 0 ? (
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
                      {emojiReactions.map((reaction: Reaction) => (
                        <UserItem
                          key={reaction.id}
                          mode="navigation"
                          user={{
                            id: Number(reaction.userId),
                            username: reaction.userName,
                            displayName: reaction.userName,
                            profileImageUrl: reaction.userImage,
                            createdAt: reaction.createdAt
                          }}
                          href={`/profile/${reaction.userId}`}
                          showTimestamp={true}
                          rightElement={<span className="text-lg">{emoji}</span>}
                          className="min-h-[44px] touch-manipulation active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset"
                          ariaLabel={`${reaction.userName} reacted with ${emoji}. Click to view profile.`}
                        />
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
    </>,
    document.body
  )
}