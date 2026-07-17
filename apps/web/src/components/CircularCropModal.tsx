'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { X, Check, RotateCcw } from 'lucide-react'
import { lockScroll, unlockScroll } from '@/utils/scrollLock'

interface CropData {
  x: number
  y: number
  radius: number
}

interface CircularCropModalProps {
  isOpen: boolean
  onClose: () => void
  imageFile: File
  onCropComplete: (cropData: CropData, croppedImageBlob: Blob) => void
  className?: string
}

// Default crop radius, shared by the initial-load computation and the "reset to center"
// button so they always agree — proportional to the visible viewport (not the full,
// possibly-larger image), so it still scales sensibly across desktop/mobile/responsive.
function computeDefaultRadius(vpWidth: number, vpHeight: number, maxR: number): number {
  return Math.min(Math.min(vpWidth, vpHeight) / 4, maxR)
}

// Clamps a crop circle so it stays fully within the currently visible (panned) area of the
// image, not just within the full image bounds — otherwise the circle could be dragged to a
// position that's currently scrolled out of view.
function clampCropToVisible(
  x: number,
  y: number,
  radius: number,
  offsetX: number,
  offsetY: number,
  vpWidth: number,
  vpHeight: number,
  imgWidth: number,
  imgHeight: number
): { x: number; y: number } {
  const minX = Math.max(radius, -offsetX + radius)
  const maxX = Math.min(imgWidth - radius, vpWidth - offsetX - radius)
  const minY = Math.max(radius, -offsetY + radius)
  const maxY = Math.min(imgHeight - radius, vpHeight - offsetY - radius)

  const loX = Math.min(minX, maxX)
  const hiX = Math.max(minX, maxX)
  const loY = Math.min(minY, maxY)
  const hiY = Math.max(minY, maxY)

  return {
    x: Math.min(Math.max(x, loX), hiX),
    y: Math.min(Math.max(y, loY), hiY)
  }
}

export default function CircularCropModal({
  isOpen,
  onClose,
  imageFile,
  onCropComplete,
  className = ''
}: CircularCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const cropInitialized = useRef(false)
  const userHasPanned = useRef(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [cropData, setCropData] = useState<CropData>({ x: 0, y: 0, radius: 100 })
  const [imageUrl, setImageUrl] = useState<string>('')
  const [cropError, setCropError] = useState('')
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  // imageDisplaySize: the full rendered size of the image (may exceed the visible viewport)
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 })
  // viewportSize: the visible "window" the modal actually wraps around. When the image is
  // larger than the available space, viewportSize stays capped and the image pans inside it.
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  // panOffset: translation (in px, <= 0) applied to the image so it can be dragged within
  // the viewport when it doesn't fully fit.
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const panOffsetRef = useRef(panOffset)
  useEffect(() => { panOffsetRef.current = panOffset }, [panOffset])
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 })
  const [minRadius, setMinRadius] = useState(50)
  const [maxRadius, setMaxRadius] = useState(200)

  // Handle image load
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return

    const img = imageRef.current
    const container = containerRef.current

    // Store natural image size
    setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })

    // Calculate available space based on the viewport. NOTE: this intentionally does NOT
    // read the container's own getBoundingClientRect(). This modal is a full-screen overlay,
    // so window size is the correct source of truth — and using the container's rect here
    // used to create a circular dependency (container size -> measured rect -> computed size)
    // that only "worked" by accident, converging over several recalculation passes as the
    // container grew. That growth path relied on the container being allowed to render at
    // its full imageDisplaySize even when oversized (i.e. before panning existed, oversized
    // images were just clipped). Now that the container is deliberately capped to a smaller,
    // pannable viewport, that growth loop can't run, so we compute directly from the window
    // instead of bootstrapping off a stale, tiny first measurement.
    const availableWidth = window.innerWidth * 0.8 // Account for modal padding
    const availableHeight = window.innerHeight * 0.6 // Leave space for header and controls

    // Ensure minimum dimensions
    const minWidth = 300
    const minHeight = 300
    const maxWidth = Math.max(availableWidth, minWidth)
    const maxHeight = Math.max(availableHeight, minHeight)

    const imageAspectRatio = img.naturalWidth / img.naturalHeight

    let displayWidth, displayHeight

    // Calculate size to fit within available space while maintaining aspect ratio
    if (imageAspectRatio > 1) {
      // Landscape image
      displayWidth = Math.min(maxWidth, maxHeight * imageAspectRatio)
      displayHeight = displayWidth / imageAspectRatio

      // If height exceeds available space, constrain by height
      if (displayHeight > maxHeight) {
        displayHeight = maxHeight
        displayWidth = displayHeight * imageAspectRatio
      }
    } else {
      // Portrait or square image
      displayHeight = Math.min(maxHeight, maxWidth / imageAspectRatio)
      displayWidth = displayHeight * imageAspectRatio

      // If width exceeds available space, constrain by width
      if (displayWidth > maxWidth) {
        displayWidth = maxWidth
        displayHeight = displayWidth / imageAspectRatio
      }
    }

    // Ensure the image is not too small
    const minDisplaySize = 250
    if (displayWidth < minDisplaySize || displayHeight < minDisplaySize) {
      if (displayWidth < displayHeight) {
        displayWidth = minDisplaySize
        displayHeight = displayWidth / imageAspectRatio
      } else {
        displayHeight = minDisplaySize
        displayWidth = displayHeight * imageAspectRatio
      }
    }

    // NOTE: the minDisplaySize floor above can push the image bigger than the real
    // available space (e.g. on short mobile viewports). Rather than letting that overflow
    // get clipped, we cap the *visible viewport* to the available space and let the user
    // pan the (larger) image inside it.
    const viewportWidth = Math.min(displayWidth, maxWidth)
    const viewportHeight = Math.min(displayHeight, maxHeight)

    setImageDisplaySize({ width: displayWidth, height: displayHeight })
    setViewportSize({ width: viewportWidth, height: viewportHeight })

    // Initialize/re-center pan offset until the user actually pans (covers both first load
    // and later recalculations, e.g. resize/orientation change), then just clamp it into the
    // new bounds so a manual pan isn't undone by a recalculation.
    const maxOffsetX = Math.max(0, displayWidth - viewportWidth)
    const maxOffsetY = Math.max(0, displayHeight - viewportHeight)
    const panX = userHasPanned.current
      ? Math.max(-maxOffsetX, Math.min(0, panOffsetRef.current.x))
      : -maxOffsetX / 2
    const panY = userHasPanned.current
      ? Math.max(-maxOffsetY, Math.min(0, panOffsetRef.current.y))
      : -maxOffsetY / 2
    setPanOffset({ x: panX, y: panY })

    // Set radius constraints based on the *visible viewport*, not the full image — otherwise
    // the circle could be sized larger than the area the user can actually see.
    const minR = Math.min(50, Math.min(viewportWidth, viewportHeight) / 8)
    const maxR = Math.min(viewportWidth, viewportHeight) / 2 // Allow circle to reach viewport edges

    setMinRadius(minR)
    setMaxRadius(maxR)

    if (!cropInitialized.current) {
      // First load for this image: center the crop circle within the visible area.
      const defaultRadius = computeDefaultRadius(viewportWidth, viewportHeight, maxR)
      const centered = clampCropToVisible(
        displayWidth / 2, displayHeight / 2, defaultRadius,
        panX, panY, viewportWidth, viewportHeight, displayWidth, displayHeight
      )
      setCropData({ x: centered.x, y: centered.y, radius: defaultRadius })
      cropInitialized.current = true
    } else {
      // Recalculation (e.g. resize): keep the existing crop, but make sure it's still fully
      // within the currently visible area.
      setCropData(prev => {
        const radius = Math.min(prev.radius, maxR)
        const clamped = clampCropToVisible(
          prev.x, prev.y, radius, panX, panY, viewportWidth, viewportHeight, displayWidth, displayHeight
        )
        return { x: clamped.x, y: clamped.y, radius }
      })
    }

    setImageLoaded(true)
  }, [])

  // Create image URL when modal opens or image file changes
  useEffect(() => {
    if (isOpen && imageFile) {
      // Reset crop/pan initialization for new image — ensures Image B doesn't
      // inherit Image A's crop position or pan offset. Safe because this effect runs
      // BEFORE the image loads (blob URL creation triggers a re-render
      // which sets the img src, and only then does the img load).
      cropInitialized.current = false
      userHasPanned.current = false

      const url = URL.createObjectURL(imageFile)
      setImageUrl(url)
      setImageLoaded(false)
      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [isOpen, imageFile])

  // Handle container resize
  useEffect(() => {
    if (!isOpen) return

    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })

        // Recalculate image size if image is loaded
        if (imageLoaded && imageRef.current) {
          handleImageLoad()
        }
      }
    }

    // Initial size calculation
    const timer = setTimeout(updateContainerSize, 100) // Small delay to ensure DOM is ready

    window.addEventListener('resize', updateContainerSize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateContainerSize)
    }
  }, [isOpen, imageLoaded, handleImageLoad])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [isOpen])

  // Convert display coordinates to natural image coordinates
  const displayToNatural = useCallback((displayCoords: CropData): CropData => {
    if (!imageDisplaySize.width || !imageDisplaySize.height) return displayCoords

    const scaleX = imageNaturalSize.width / imageDisplaySize.width
    const scaleY = imageNaturalSize.height / imageDisplaySize.height

    return {
      x: displayCoords.x * scaleX,
      y: displayCoords.y * scaleY,
      radius: displayCoords.radius * Math.min(scaleX, scaleY)
    }
  }, [imageDisplaySize, imageNaturalSize])

  // Handle mouse/touch events for dragging the crop circle, or panning the image
  // when it's larger than the visible viewport.
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!imageLoaded) return

    e.preventDefault()

    // currentTarget is the overlay, which is sized to the full image (imageDisplaySize),
    // so its bounding rect already reflects any pan translation — coordinates below stay
    // in image space regardless of pan, so all existing crop math keeps working unchanged.
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if click is within crop circle
    const dx = x - cropData.x
    const dy = y - cropData.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance <= cropData.radius) {
      setIsDragging(true)

      // Start dragging from current position
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const newX = moveEvent.clientX - rect.left
        const newY = moveEvent.clientY - rect.top

        const clamped = clampCropToVisible(
          newX, newY, cropData.radius,
          panOffsetRef.current.x, panOffsetRef.current.y,
          viewportSize.width, viewportSize.height,
          imageDisplaySize.width, imageDisplaySize.height
        )

        setCropData(prev => ({ ...prev, x: clamped.x, y: clamped.y }))
      }

      const handlePointerUp = () => {
        setIsDragging(false)
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    } else {
      // Outside the crop circle: pan the image, but only if there's actually room to pan
      // (i.e. the image is bigger than the current viewport).
      const maxOffsetX = Math.max(0, imageDisplaySize.width - viewportSize.width)
      const maxOffsetY = Math.max(0, imageDisplaySize.height - viewportSize.height)
      if (maxOffsetX === 0 && maxOffsetY === 0) return

      userHasPanned.current = true
      setIsPanning(true)

      const startClientX = e.clientX
      const startClientY = e.clientY
      const startOffset = { ...panOffset }

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startClientX
        const deltaY = moveEvent.clientY - startClientY

        const newX = Math.max(-maxOffsetX, Math.min(0, startOffset.x + deltaX))
        const newY = Math.max(-maxOffsetY, Math.min(0, startOffset.y + deltaY))

        setPanOffset({ x: newX, y: newY })
      }

      const handlePointerUp = () => {
        setIsPanning(false)
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    }
  }, [imageLoaded, cropData, imageDisplaySize, viewportSize, panOffset])

  // Handle mouse wheel to adjust crop circle size
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!imageLoaded) return
    e.preventDefault()
    e.stopPropagation()

    const delta = e.deltaY > 0 ? -5 : 5

    setCropData(prev => {
      const newRadius = Math.max(minRadius, Math.min(maxRadius, prev.radius + delta))
      const currPan = panOffsetRef.current
      const clamped = clampCropToVisible(
        prev.x, prev.y, newRadius,
        currPan.x, currPan.y,
        viewportSize.width, viewportSize.height,
        imageDisplaySize.width, imageDisplaySize.height
      )
      return { x: clamped.x, y: clamped.y, radius: newRadius }
    })
  }, [imageLoaded, minRadius, maxRadius, viewportSize, imageDisplaySize])

  // Handle radius change from slider
  const handleRadiusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newRadius = parseInt(e.target.value)

    const clamped = clampCropToVisible(
      cropData.x, cropData.y, newRadius,
      panOffset.x, panOffset.y,
      viewportSize.width, viewportSize.height,
      imageDisplaySize.width, imageDisplaySize.height
    )

    setCropData({ x: clamped.x, y: clamped.y, radius: newRadius })
  }, [cropData, imageDisplaySize, viewportSize, panOffset])

  // Reset crop to center (and re-center the pan, if the image is pannable)
  const handleReset = useCallback(() => {
    if (!imageDisplaySize.width || !imageDisplaySize.height || !viewportSize.width || !viewportSize.height) return

    const maxOffsetX = Math.max(0, imageDisplaySize.width - viewportSize.width)
    const maxOffsetY = Math.max(0, imageDisplaySize.height - viewportSize.height)
    const centeredOffset = { x: -maxOffsetX / 2, y: -maxOffsetY / 2 }

    userHasPanned.current = false
    setPanOffset(centeredOffset)

    const defaultRadius = computeDefaultRadius(viewportSize.width, viewportSize.height, maxRadius)
    const centeredCrop = clampCropToVisible(
      imageDisplaySize.width / 2, imageDisplaySize.height / 2, defaultRadius,
      centeredOffset.x, centeredOffset.y,
      viewportSize.width, viewportSize.height,
      imageDisplaySize.width, imageDisplaySize.height
    )
    setCropData({ x: centeredCrop.x, y: centeredCrop.y, radius: defaultRadius })
  }, [imageDisplaySize, viewportSize, maxRadius])

  // Generate cropped image
  const generateCroppedImage = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!imageRef.current || !canvasRef.current) {
        reject(new Error('Image or canvas not available'))
        return
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

  // Convert display coordinates to natural image coordinates
      const naturalCrop = displayToNatural(cropData)

      // Set canvas size to crop diameter
      const cropSize = naturalCrop.radius * 2
      canvas.width = cropSize
      canvas.height = cropSize

      // Create circular clipping path
      ctx.save()
      ctx.beginPath()
      ctx.arc(cropSize / 2, cropSize / 2, naturalCrop.radius, 0, 2 * Math.PI)
      ctx.clip()

      // Draw the cropped portion of the image
      ctx.drawImage(
        imageRef.current,
        naturalCrop.x - naturalCrop.radius, // source x
        naturalCrop.y - naturalCrop.radius, // source y
        cropSize, // source width
        cropSize, // source height
        0, // dest x
        0, // dest y
        cropSize, // dest width
        cropSize  // dest height
      )

      ctx.restore()

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      }, 'image/jpeg', 0.9)
    })
  }, [cropData, displayToNatural])

  // Handle crop completion
  const handleComplete = useCallback(async () => {
    setCropError('')
    try {
      const croppedBlob = await generateCroppedImage()
      const naturalCrop = displayToNatural(cropData)
      onCropComplete(naturalCrop, croppedBlob)
    } catch (error) {
      console.error('Error generating cropped image:', error)
      setCropError('Failed to crop image. Please try again.')
    }
  }, [generateCroppedImage, displayToNatural, cropData, onCropComplete])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-white rounded-xl shadow-2xl w-auto max-h-[90vh] flex flex-col" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Crop Profile Photo</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="flex-1 p-2 overflow-hidden min-h-0">
          <div
            ref={containerRef}
            className="relative flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden"
            style={{
              width: viewportSize.width ? `${viewportSize.width}px` : 'auto',
              height: viewportSize.height ? `${viewportSize.height}px` : 'auto',
              minWidth: imageLoaded ? undefined : '300px',
              minHeight: imageLoaded ? undefined : '300px'
            }}
          >
            {imageUrl && (
              <>
                {/* Hidden image for loading and natural size detection */}
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Crop preview"
                  className="hidden"
                  onLoad={handleImageLoad}
                />

                {/* Visible image for cropping — absolutely positioned and translated by
                    panOffset so it can be dragged within the (possibly smaller) viewport. */}
                {imageLoaded && (
                  <div
                    className="absolute top-0 left-0"
                    style={{
                      width: imageDisplaySize.width,
                      height: imageDisplaySize.height,
                      transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`
                    }}
                  >
                    <img
                      src={imageUrl}
                      alt="Crop preview"
                      style={{
                        width: imageDisplaySize.width,
                        height: imageDisplaySize.height
                      }}
                      className="block"
                      draggable={false}
                    />

                    {/* Crop overlay */}
                    <div
                      className="absolute inset-0 cursor-move"
                      onPointerDown={handlePointerDown}
                      onWheel={handleWheel}
                      style={{ touchAction: 'none' }}
                    >
                      {/* Dark overlay with hole */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{
                          width: imageDisplaySize.width,
                          height: imageDisplaySize.height
                        }}
                      >
                        <defs>
                          <mask id="crop-mask">
                            <rect width="100%" height="100%" fill="white" />
                            <circle
                              cx={cropData.x}
                              cy={cropData.y}
                              r={cropData.radius}
                              fill="black"
                            />
                          </mask>
                        </defs>
                        <rect
                          width="100%"
                          height="100%"
                          fill="rgba(0, 0, 0, 0.5)"
                          mask="url(#crop-mask)"
                        />
                      </svg>

                      {/* Crop circle border */}
                      <div
                        className="absolute border-2 border-purple-500 rounded-full pointer-events-none"
                        style={{
                          left: cropData.x - cropData.radius,
                          top: cropData.y - cropData.radius,
                          width: cropData.radius * 2,
                          height: cropData.radius * 2,
                          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.5)'
                        }}
                      />

                      {/* Center dot */}
                      <div
                        className="absolute w-2 h-2 bg-purple-500 rounded-full pointer-events-none transform -translate-x-1 -translate-y-1"
                        style={{
                          left: cropData.x,
                          top: cropData.y
                        }}
                      />
                    </div>
                  </div>
                )}

                {!imageLoaded && (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-2 text-gray-600">Loading image...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        {imageLoaded && (
          <div
            className="p-3 border-t border-gray-200 bg-gray-50"
            style={{ maxWidth: viewportSize.width ? `${viewportSize.width}px` : undefined }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-4 flex-1">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Crop Size:
                </label>
                <input
                  type="range"
                  min={minRadius}
                  max={maxRadius}
                  value={cropData.radius}
                  onChange={handleRadiusChange}
                  data-allow-scroll="true"
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${((cropData.radius - minRadius) / (maxRadius - minRadius)) * 100}%, #E5E7EB ${((cropData.radius - minRadius) / (maxRadius - minRadius)) * 100}%, #E5E7EB 100%)`
                  }}
                />
                <button
                  onClick={handleReset}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                  title="Reset to center"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error message */}
            {cropError && (
              <p className="text-sm text-red-600 text-center mb-2">{cropError}</p>
            )}

            {/* Buttons - aligned and consistent */}
            <div className="flex justify-center space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden canvas for generating cropped image */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #8B5CF6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #8B5CF6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}
