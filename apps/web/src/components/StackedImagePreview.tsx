"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"

/**
 * Image data for multi-image posts.
 * Uses medium variant for feed display.
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

interface StackedImagePreviewProps {
  images: PostImage[]
  onImageClick: (index: number) => void
  className?: string
}

/**
 * StackedImagePreview displays multiple images as stacked cards in the feed.
 *
 * Visual behavior:
 * - Primary image (position 0) is fully visible using medium variant
 * - Up to 2 shadow cards appear behind with subtle offset
 * - If >3 images: centered indicator shows total count
 * - Image display is uniform regardless of post type
 *
 * Interaction:
 * - Clicking opens fullscreen viewer at the selected image index
 * - Feed display is passive (no hover carousel or auto-rotation)
 */
export default function StackedImagePreview({
  images,
  onImageClick,
  className = ""
}: StackedImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sort images by position to ensure correct order
  const sortedImages = [...images].sort((a, b) => a.position - b.position)
  const primaryImage = sortedImages[0]
  const totalImages = sortedImages.length

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleImageLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const handleClick = () => {
    if (!hasError && !isLoading) {
      onImageClick(0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  // Show 1-3 stacked cards based on total images
  const visibleStackCount = Math.min(totalImages, 3)

  return (
    <div
      ref={containerRef}
      className={`relative mt-4 cursor-pointer group ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`View ${totalImages} image${totalImages > 1 ? 's' : ''}`}
      style={{
        // Add padding to prevent clipping of offset cards
        paddingBottom: visibleStackCount >= 3 ? '16px' : visibleStackCount >= 2 ? '8px' : '0',
        paddingRight: visibleStackCount >= 3 ? '10px' : visibleStackCount >= 2 ? '6px' : '0'
      }}
    >
      {/* Stacked cards container */}
      <div className="relative">
        {/* Background stacked cards with actual thumbnails */}
        {visibleStackCount >= 3 && sortedImages[2] && (
          <div
            className="absolute inset-0 rounded-lg overflow-hidden shadow-sm border border-gray-200/50"
            style={{
              transform: 'translateY(14px) translateX(8px) rotate(1.5deg)',
              zIndex: 1
            }}
          >
            <img
              src={sortedImages[2].thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              aria-hidden="true"
            />
          </div>
        )}
        {visibleStackCount >= 2 && sortedImages[1] && (
          <div
            className="absolute inset-0 rounded-lg overflow-hidden shadow-sm border border-gray-200/50"
            style={{
              transform: 'translateY(7px) translateX(4px) rotate(0.75deg)',
              zIndex: 2
            }}
          >
            <img
              src={sortedImages[1].thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Primary image card */}
        <div
          className="relative rounded-lg overflow-hidden bg-gray-50 shadow-md"
          style={{
            zIndex: 3,
            aspectRatio: primaryImage?.width && primaryImage?.height
              ? `${primaryImage.width} / ${primaryImage.height}`
              : '16 / 9',
            maxHeight: '500px'
          }}
        >
          {/* Loading State */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" data-testid="loading-spinner" />
                <span className="text-sm text-gray-500">Loading image...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="flex flex-col items-center space-y-2 text-gray-500">
                <AlertCircle className="h-8 w-8" />
                <span className="text-sm">Failed to load image</span>
              </div>
            </div>
          )}

          {/* Primary image - lazy loaded */}
          {isVisible && primaryImage && (
            <img
              src={primaryImage.mediumUrl}
              alt="Post image"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
            />
          )}

          {/* Hover overlay */}
          {!isLoading && !hasError && (
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                {totalImages > 1 ? `View ${totalImages} images` : 'Click to expand'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image count indicator for >3 images */}
      {totalImages > 3 && !isLoading && !hasError && (
        <div className="absolute bottom-3 right-3 z-10 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-xs font-medium">
          +{totalImages - 1} more
        </div>
      )}

      {/* Multi-image indicator dots for 2-3 images */}
      {totalImages >= 2 && totalImages <= 3 && !isLoading && !hasError && (
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-10 flex items-center space-x-1.5">
          {sortedImages.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full ${
                index === 0 ? 'bg-white' : 'bg-white bg-opacity-50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
