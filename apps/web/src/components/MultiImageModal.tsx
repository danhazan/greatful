"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Maximize2, Heart } from "lucide-react"
import ImageModal from "./ImageModal"
import { useImageReactions } from '@/hooks/useImageReactions'
import { lockScroll, unlockScroll } from '@/utils/scrollLock'
import { useReactionMutation } from '@/hooks/useReactionMutation'
import EmojiPicker from './EmojiPicker'
import ReactionViewer from './ReactionViewer'
import { getEmojiFromCode, getTopEmojis } from '@/utils/emojiMapping'

/**
 * Image data for multi-image posts.
 */
interface PostImage {
  id: string
  position: number
  thumbnailUrl: string
  mediumUrl: string
  originalUrl: string
  width?: number
  height?: number
}

interface MultiImageModalProps {
  postId: string
  images: PostImage[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
}

/**
 * MultiImageModal displays images in fullscreen with navigation.
 *
 * Features:
 * - Swipe gestures on mobile (left/right to navigate)
 * - Arrow key navigation on desktop
 * - On-screen arrow buttons
 * - Image counter (e.g., "1 / 5")
 * - Simple fade transition between images
 * - Background scroll lock
 */
export default function MultiImageModal({
  postId,
  images,
  initialIndex,
  isOpen,
  onClose
}: MultiImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isLoading, setIsLoading] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const [showExpandedView, setShowExpandedView] = useState(false)

  // Touch tracking for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Reactions state
  // Reactions state
  const { data: reactionsData, isLoading: isLoadingReactions, getReactionForImage, error, refetch } = useImageReactions(postId || "", isOpen)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionViewer, setShowReactionViewer] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 })

  const imageRef = useRef<HTMLImageElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Sort images by position
  const sortedImages = [...images].sort((a, b) => a.position - b.position)
  const totalImages = sortedImages.length
  const currentImage = sortedImages[currentIndex]

  // Initialize unified reaction mutation
  const currentReactionState = getReactionForImage(currentImage?.id || "")
  const { handleReaction, isInFlight } = useReactionMutation({
    postId,
    objectType: 'image',
    objectId: currentImage?.id || "",
    currentReactionState
  })

  // Reset state when modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setIsLoading(true)
      setIsFading(false)
      setShowExpandedView(false)
      setShowEmojiPicker(false)
      setShowReactionViewer(false)
    }
  }, [isOpen, initialIndex])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      lockScroll();
    }
    
    return () => {
      unlockScroll();
    }
  }, [isOpen])

  // Navigate to next/previous image with fade transition
  const navigateTo = useCallback((index: number) => {
    if (index < 0 || index >= totalImages) return
    if (index === currentIndex) return

    setIsFading(true)
    setTimeout(() => {
      setCurrentIndex(index)
      setIsLoading(true)
      setIsFading(false)
      setShowEmojiPicker(false)
      setShowReactionViewer(false)
    }, 150) // Half of fade duration for smooth transition
  }, [currentIndex, totalImages])

  const goNext = useCallback(() => {
    if (currentIndex < totalImages - 1) {
      navigateTo(currentIndex + 1)
    }
  }, [currentIndex, totalImages, navigateTo])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      navigateTo(currentIndex - 1)
    }
  }, [currentIndex, navigateTo])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goPrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          goNext()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, goNext, goPrev])

  // Swipe gesture handling
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      goNext()
    } else if (isRightSwipe) {
      goPrev()
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleImageLoad = () => {
    setIsLoading(false)
  }

  if (!isOpen || !currentImage) return null

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
      onClick={handleBackdropClick}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      {/* Top right controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
        {/* Expand to full resolution button */}
        <button
          onClick={() => setShowExpandedView(true)}
          className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
          aria-label="View full resolution"
          title="View full resolution"
        >
          <Maximize2 className="h-6 w-6" />
        </button>
        {/* Close button */}
        <button
          onClick={onClose}
          className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
          aria-label="Close image modal"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Image counter */}
      <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
        {currentIndex + 1} / {totalImages}
      </div>

      {/* Top Center User Reaction Button */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <button
          disabled={isLoadingReactions || isInFlight}
          className={`p-3 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-transform active:scale-90 flex items-center justify-center ${
            (isLoadingReactions || isInFlight) ? 'opacity-50 cursor-not-allowed' : ''
          } ${error ? 'ring-2 ring-red-500 ring-opacity-50' : ''}`}
          aria-label={error ? "Reaction sync error" : "React to image"}
          title={error ? "Synchronization error. Click to retry." : undefined}
          onClick={(e) => {
            e.stopPropagation()
            if (error) {
              refetch()
              return
            }
            if (isLoadingReactions || isInFlight) return
            
            // If already reacted, clicking removes the reaction (parity with PostCard)
            if (currentReactionState.userReaction) {
              handleReaction(null)
              return
            }

            // Otherwise, open emoji picker
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setPickerPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 12 })
            setShowEmojiPicker(true)
          }}
        >
          {isLoadingReactions ? (
            <div className="h-8 w-8 border-b-2 border-white rounded-full animate-spin"></div>
          ) : error ? (
            <div className="h-8 w-8 flex items-center justify-center">
              <span className="text-red-500 font-bold text-2xl" title="Sync Error">!</span>
            </div>
          ) : currentReactionState.userReaction ? (
            <span className="text-3xl leading-none">
              {getEmojiFromCode(currentReactionState.userReaction)}
            </span>
          ) : (
            <Heart className="h-8 w-8 text-white" />
          )}
        </button>
      </div>

      {/* Previous button (desktop) */}
      {currentIndex > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors hidden md:flex items-center justify-center"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next button (desktop) */}
      {currentIndex < totalImages - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors hidden md:flex items-center justify-center"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {/* Image container */}
      <div
        className={`relative flex items-center justify-center transition-opacity duration-300 ${
          isFading ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          width: '90vw',
          height: '90vh',
          cursor: 'default'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imageRef}
          src={currentImage.mediumUrl}
          alt={`Image ${currentIndex + 1} of ${totalImages}`}
          className={`max-w-full max-h-full object-contain select-none transition-opacity duration-200 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={handleImageLoad}
          draggable={false}
        />
      </div>

      {/* Thumbnail navigation strip */}
      {totalImages > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center space-x-2 bg-black bg-opacity-50 rounded-full px-4 py-2 max-w-[90vw] overflow-x-auto">
          {sortedImages.map((img, index) => (
            <button
              key={img.id}
              onClick={() => navigateTo(index)}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                index === currentIndex
                  ? 'border-white opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={img.thumbnailUrl}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Bottom Reactions Bar */}
      <div 
        className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoadingReactions ? (
          <div className="flex items-center space-x-2 bg-black bg-opacity-50 rounded-full px-4 py-2">
            <div className="h-4 w-4 border-b-2 border-white rounded-full animate-spin"></div>
            <span className="text-white text-sm">Loading...</span>
          </div>
        ) : error ? (
          <button 
            onClick={refetch}
            className="flex items-center space-x-2 bg-red-900 bg-opacity-60 hover:bg-opacity-80 transition-colors rounded-full px-4 py-2 border border-red-500"
          >
            <span className="text-white text-xs font-medium">Sync Error. Tap to retry.</span>
          </button>
        ) : currentReactionState.totalCount > 0 ? (
          <button
            onClick={() => setShowReactionViewer(true)}
            className="flex items-center space-x-2 bg-black bg-opacity-60 hover:bg-opacity-80 transition-colors rounded-full px-4 py-2"
          >
            <div className="flex -space-x-1">
              {getTopEmojis(currentReactionState.emojiCounts, 3).map(({ code }) => (
                <span key={code} className="text-base leading-none relative z-10 z-[1] drop-shadow-md">
                  {getEmojiFromCode(code)}
                </span>
              ))}
            </div>
            <span className="text-white text-sm font-medium">
              {currentReactionState.totalCount}
            </span>
          </button>
        ) : null}
      </div>

      {/* Overlays / Modals */}
      {showEmojiPicker && (
        <EmojiPicker
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onCancel={() => setShowEmojiPicker(false)}
          onEmojiSelect={(emoji) => {
            handleReaction(emoji)
            setShowEmojiPicker(false)
          }}
          currentReaction={currentReactionState.userReaction}
          position={pickerPosition}
          isLoading={isInFlight}
        />
      )}

      {showReactionViewer && currentReactionState.totalCount > 0 && (
        <ReactionViewer
          isOpen={showReactionViewer}
          onClose={() => setShowReactionViewer(false)}
          postId={postId}
          objectType="image"
          objectId={currentImage.id}
        />
      )}

      {/* Full resolution ImageModal - shared with single-image posts */}
      <ImageModal
        src={currentImage.originalUrl}
        alt={`Full resolution image ${currentIndex + 1} of ${totalImages}`}
        isOpen={showExpandedView}
        onClose={() => setShowExpandedView(false)}
      />
    </div>
  )
}
