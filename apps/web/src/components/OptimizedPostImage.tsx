"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import ImageModal from "./ImageModal"

interface OptimizedPostImageProps {
  src: string
  alt: string
  postType: "daily" | "photo" | "spontaneous"
  className?: string
}

interface ImageDimensions {
  width: number
  height: number
  aspectRatio: number
}

export default function OptimizedPostImage({ 
  src, 
  alt, 
  postType, 
  className = "" 
}: OptimizedPostImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    // Check if IntersectionObserver is available (not in test environment)
    if (typeof IntersectionObserver === 'undefined') {
      // In test environment, immediately set visible
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

  // Handle image load to get dimensions
  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget
    const dimensions = {
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatio: img.naturalWidth / img.naturalHeight
    }
    
    setImageDimensions(dimensions)
    setIsLoading(false)
    setHasError(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const handleImageClick = () => {
    if (!hasError && !isLoading) {
      setShowModal(true)
    }
  }

  // Get container styling - use natural image dimensions
  const getContainerStyling = () => {
    const baseClasses = "relative rounded-lg overflow-hidden bg-gray-50 w-full cursor-pointer hover:opacity-95 transition-opacity"
    
    switch (postType) {
      case 'daily':
        return `${baseClasses} mt-4`
      case 'photo':
        return `${baseClasses} mt-4`
      default: // spontaneous
        return `${baseClasses} mt-3`
    }
  }

  // Get dynamic container style based on image aspect ratio
  const getContainerStyle = () => {
    if (!imageDimensions) {
      // Default aspect ratio while loading to prevent layout shift
      return { aspectRatio: '16 / 9' }
    }

    const { aspectRatio } = imageDimensions
    
    // Set max heights based on post type to prevent extremely tall images
    const maxHeights = {
      daily: 600,    // 600px max for daily posts
      photo: 500,    // 500px max for photo posts
      spontaneous: 400 // 400px max for spontaneous posts
    }
    
    const maxHeight = maxHeights[postType]
    
    // Calculate what the height would be at full width
    // Assuming container width is around 500px (typical post width)
    const estimatedWidth = 500
    const naturalHeight = estimatedWidth / aspectRatio
    
    // If natural height exceeds max, constrain the aspect ratio
    if (naturalHeight > maxHeight) {
      const constrainedAspectRatio = estimatedWidth / maxHeight
      return { aspectRatio: `${constrainedAspectRatio.toFixed(3)} / 1` }
    }
    
    // Use natural aspect ratio for optimal display
    return { aspectRatio: `${aspectRatio.toFixed(3)} / 1` }
  }

  const containerClasses = getContainerStyling()
  const containerStyle = getContainerStyle()

  return (
    <>
      <div 
        ref={containerRef}
        className={`${containerClasses} ${className}`}
        style={containerStyle}
        onClick={handleImageClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleImageClick()
          }
        }}
        aria-label="Click to view full image"
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

        {/* Image - only load when visible (lazy loading) */}
        {isVisible && (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        )}

        {/* Click indicator overlay */}
        {!isLoading && !hasError && (
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
            <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              Click to expand
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal
        src={src}
        alt={alt}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  )
}