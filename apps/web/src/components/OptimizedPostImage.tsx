"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"

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

  // Get container styling - now uses aspect ratio for natural scaling
  const getContainerStyling = () => {
    const baseClasses = "relative overflow-hidden rounded-lg bg-gray-50 w-full"
    
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
      // Default aspect ratio while loading
      return { aspectRatio: '16 / 9' }
    }

    const { aspectRatio } = imageDimensions
    
    // Set max heights based on post type to prevent extremely tall images
    const maxHeights = {
      daily: 500,    // 500px max
      photo: 400,    // 400px max  
      spontaneous: 300 // 300px max
    }
    
    const maxHeight = maxHeights[postType]
    
    // Calculate what the height would be at full width
    // Assuming container width is around 500px (typical post width)
    const estimatedWidth = 500
    const naturalHeight = estimatedWidth / aspectRatio
    
    // If natural height exceeds max, constrain it
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
    <div 
      ref={containerRef}
      className={`${containerClasses} ${className}`}
      style={containerStyle}
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


    </div>
  )
}