"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { lockScroll, unlockScroll } from '@/utils/scrollLock'
import { SharedImageZoom, SharedImageZoomRef } from "./SharedImageZoom"
import { IMAGE_GALLERY_CONFIG } from "../config/imageGalleryConfig"

interface ImageModalProps {
  src: string
  alt: string
  isOpen: boolean
  onClose: () => void
}

export default function ImageModal({ src, alt, isOpen, onClose }: ImageModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [scale, setScale] = useState<number>(IMAGE_GALLERY_CONFIG.DEFAULT_SCALE)
  const imageRef = useRef<HTMLImageElement>(null)
  const zoomRef = useRef<SharedImageZoomRef>(null)

  // Reset loading state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setScale(IMAGE_GALLERY_CONFIG.DEFAULT_SCALE)
      // Small timeout to ensure DOM is ready before resetting zoom
      setTimeout(() => zoomRef.current?.resetZoom(), 0)
    }
  }, [isOpen])

  // Handle escape key and scroll lock
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      lockScroll()
      
      return () => {
        document.removeEventListener('keydown', handleEscape)
        unlockScroll()
      }
    }
  }, [isOpen, onClose])

  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Close if clicking directly on the backdrop area outside the image
    if (e.currentTarget === e.target) {
      onClose()
    }
  }

  const handleImageLoad = () => {
    setIsLoading(false)
  }

  if (!isOpen) return null

  // Ensure this runs only on client logic (due to createPortal needing document).
  if (typeof window === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black bg-opacity-95 flex items-center justify-center w-screen h-screen overflow-hidden"
      onClick={handleBackdropClick}
      style={{ touchAction: 'none' }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[90] p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
        aria-label="Close image modal"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {/* Transform Wrapper */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <SharedImageZoom
          ref={zoomRef}
          isGalleryMode={false}
          onScaleChange={setScale}
        >
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              display: 'block',
              maxWidth: '100vw',
              maxHeight: '100vh',
            }}
            onLoad={handleImageLoad}
            draggable={false}
          />
        </SharedImageZoom>

        {/* Zoom controls - Always visible, centered at bottom */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-black bg-opacity-50 rounded-full px-5 py-2.5 z-[80] shadow-lg border border-white/10 backdrop-blur-sm">
          <button
            onClick={() => zoomRef.current?.zoomOut()}
            className="text-white hover:text-gray-300 transition-colors h-10 w-10 flex items-center justify-center active:scale-95"
            aria-label="Zoom out"
          >
            <span className="text-2xl font-light">−</span>
          </button>
          <div className="w-[1px] h-4 bg-white/20 mx-1" />
          <span className="text-white text-sm font-medium min-w-[3.5rem] text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <div className="w-[1px] h-4 bg-white/20 mx-1" />
          <button
            onClick={() => zoomRef.current?.zoomIn()}
            className="text-white hover:text-gray-300 transition-colors h-10 w-10 flex items-center justify-center active:scale-95"
            aria-label="Zoom in"
          >
            <span className="text-2xl font-light">+</span>
          </button>
          <button
            onClick={() => zoomRef.current?.resetZoom()}
            className="ml-2 px-3 py-1 bg-white/10 text-white text-xs font-medium rounded-full hover:bg-white/20 transition-colors active:scale-95"
            aria-label="Reset zoom"
          >
            Reset
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}