"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"
import ImageModal from "./ImageModal"

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
 * - Zoom and pan support (inherited from ImageModal pattern)
 * - Simple fade transition between images
 * - Background scroll lock
 */
export default function MultiImageModal({
  images,
  initialIndex,
  isOpen,
  onClose
}: MultiImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const [showExpandedView, setShowExpandedView] = useState(false)

  // Touch tracking for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [lastTouchDistance, setLastTouchDistance] = useState(0)

  const imageRef = useRef<HTMLImageElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Sort images by position
  const sortedImages = [...images].sort((a, b) => a.position - b.position)
  const totalImages = sortedImages.length
  const currentImage = sortedImages[currentIndex]

  // Reset state when modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setScale(1)
      setPosition({ x: 0, y: 0 })
      setIsLoading(true)
      setIsFading(false)
      setShowExpandedView(false)
    }
  }, [isOpen, initialIndex])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Navigate to next/previous image with fade transition
  const navigateTo = useCallback((index: number) => {
    if (index < 0 || index >= totalImages) return
    if (index === currentIndex) return

    setIsFading(true)
    setTimeout(() => {
      setCurrentIndex(index)
      setScale(1)
      setPosition({ x: 0, y: 0 })
      setIsLoading(true)
      setIsFading(false)
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
    if (e.touches.length === 2) {
      // Pinch zoom start
      setLastTouchDistance(getTouchDistance(e.touches))
      return
    }

    // Single touch - potential swipe
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)

    // Also track for drag when zoomed
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const currentDistance = getTouchDistance(e.touches)
      if (lastTouchDistance > 0) {
        const scaleChange = currentDistance / lastTouchDistance
        const newScale = Math.max(0.5, Math.min(5, scale * scaleChange))
        setScale(newScale)
      }
      setLastTouchDistance(currentDistance)
      return
    }

    if (scale > 1 && isDragging) {
      // Pan when zoomed
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
      return
    }

    // Track swipe end position
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    setIsDragging(false)
    setLastTouchDistance(0)

    if (!touchStart || !touchEnd) return
    if (scale > 1) return // Don't swipe when zoomed

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

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.max(0.5, Math.min(5, scale + delta))
    setScale(newScale)
  }

  // Mouse drag when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
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
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'opacity 0.3s' : 'transform 0.1s ease-out, opacity 0.3s'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          if (e.target === imageRef.current) {
            e.stopPropagation()
          }
        }}
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

      {/* Mobile swipe hint (shown briefly) */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 rounded-full px-4 py-2 md:hidden">
        Swipe to navigate • Pinch to zoom
      </div>

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
