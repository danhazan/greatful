"use client"

import React, { useRef, useImperativeHandle, forwardRef, ReactNode, useState, useEffect } from "react"
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch"
import { IMAGE_GALLERY_CONFIG, isAtDefaultScale } from "../config/imageGalleryConfig"

export interface SharedImageZoomRef {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  toggleZoom: () => void
  getScale: () => number
}

interface SharedImageZoomProps {
  children: ReactNode
  isGalleryMode?: boolean
  onScaleChange?: (scale: number) => void
}

export const SharedImageZoom = forwardRef<SharedImageZoomRef, SharedImageZoomProps>(
  ({ children, isGalleryMode = false, onScaleChange }, ref) => {
    const transformRef = useRef<ReactZoomPanPinchRef>(null)
    const [currentScale, setCurrentScale] = useState<number>(IMAGE_GALLERY_CONFIG.DEFAULT_SCALE)

    // Touch tracking for double-tap
    const lastTapTime = useRef<number>(0)
    const lastTapPos = useRef<{ x: number, y: number } | null>(null)
    const DOUBLE_TAP_DELAY = 300
    const DOUBLE_TAP_MOVE_THRESHOLD = 20

    const handleTouchEnd = (e: React.TouchEvent) => {
      // Ignore if it's a multi-touch gesture (e.g., pinch)
      if (e.touches.length > 0 || e.changedTouches.length > 1) {
        return
      }

      const touch = e.changedTouches[0]
      const currentTime = new Date().getTime()
      const tapDuration = currentTime - lastTapTime.current

      if (tapDuration < DOUBLE_TAP_DELAY && tapDuration > 0) {
        // Check if movement between taps was small
        if (lastTapPos.current) {
          const dx = touch.clientX - lastTapPos.current.x
          const dy = touch.clientY - lastTapPos.current.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < DOUBLE_TAP_MOVE_THRESHOLD) {
            // It's a double tap!
            e.preventDefault() // Prevent any default browser behavior
            toggleZoomImpl()
            lastTapTime.current = 0 // Reset
            return
          }
        }
      }

      // Record this tap for potential double-tap
      lastTapTime.current = currentTime
      lastTapPos.current = { x: touch.clientX, y: touch.clientY }
    }

    const toggleZoomImpl = () => {
      if (!transformRef.current) return

      const scale = transformRef.current.state.scale
      if (isAtDefaultScale(scale)) {
        transformRef.current.centerView(IMAGE_GALLERY_CONFIG.DOUBLE_TAP_TARGET_SCALE, IMAGE_GALLERY_CONFIG.ANIMATION_DURATION)
      } else {
        transformRef.current.resetTransform(IMAGE_GALLERY_CONFIG.ANIMATION_DURATION)
      }
    }

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (transformRef.current) {
          transformRef.current.zoomIn(IMAGE_GALLERY_CONFIG.ZOOM_STEP, IMAGE_GALLERY_CONFIG.ANIMATION_DURATION)
        }
      },
      zoomOut: () => {
        if (transformRef.current) {
          transformRef.current.zoomOut(IMAGE_GALLERY_CONFIG.ZOOM_STEP, IMAGE_GALLERY_CONFIG.ANIMATION_DURATION)
        }
      },
      resetZoom: () => {
        if (transformRef.current) {
          transformRef.current.resetTransform(IMAGE_GALLERY_CONFIG.ANIMATION_DURATION)
        }
      },
      toggleZoom: toggleZoomImpl,
      getScale: () => {
        return transformRef.current?.state.scale ?? IMAGE_GALLERY_CONFIG.DEFAULT_SCALE
      }
    }))

    const handleDoubleClick = (e: React.MouseEvent) => {
      e.preventDefault()
      toggleZoomImpl()
    }

    const handleTransformed = (ref: ReactZoomPanPinchRef) => {
      const scale = ref.state.scale
      setCurrentScale(scale)
      if (onScaleChange) {
        onScaleChange(scale)
      }
    }

    // Wheel zoom on desktop trackpads (horizontal swipe can be interpreted as wheel)
    // The library has wheel.wheelDisabled, which we leave false, but wheel.activationKeys can be empty
    return (
      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
        onDoubleClick={handleDoubleClick}
        onTouchEnd={handleTouchEnd}
      >
        <TransformWrapper
          ref={transformRef}
          centerOnInit
          minScale={IMAGE_GALLERY_CONFIG.MIN_SCALE}
          maxScale={IMAGE_GALLERY_CONFIG.MAX_SCALE}
          initialScale={IMAGE_GALLERY_CONFIG.DEFAULT_SCALE}
          doubleClick={{ disabled: true }} // Disable built-in buggy double click
          panning={{ disabled: isGalleryMode }} // Explicitly disable panning in gallery mode
          wheel={{ 
            step: IMAGE_GALLERY_CONFIG.WHEEL_STEP,
          }}
          onTransform={handleTransformed}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            contentStyle={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            {children}
          </TransformComponent>
        </TransformWrapper>
      </div>
    )
  }
)

SharedImageZoom.displayName = "SharedImageZoom"
