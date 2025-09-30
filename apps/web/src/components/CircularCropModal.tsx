'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { X, Check, RotateCcw } from 'lucide-react'

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

  const [imageLoaded, setImageLoaded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [cropData, setCropData] = useState<CropData>({ x: 0, y: 0, radius: 100 })
  const [imageUrl, setImageUrl] = useState<string>('')
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 })
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

    // Calculate available space more accurately
    const containerRect = container.getBoundingClientRect()

    // Account for modal padding, header, controls, and some buffer
    const availableWidth = Math.min(containerRect.width - 32, window.innerWidth * 0.8) // 32px for container padding
    const availableHeight = Math.min(containerRect.height - 32, window.innerHeight * 0.6) // Leave space for header and controls

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

    setImageDisplaySize({ width: displayWidth, height: displayHeight })

    // Calculate initial crop position (center) and radius constraints
    const centerX = displayWidth / 2
    const centerY = displayHeight / 2

    // Set radius constraints based on image size
    const minR = Math.min(50, Math.min(displayWidth, displayHeight) / 8)
    const maxR = Math.min(displayWidth, displayHeight) / 2 // Allow circle to reach borders

    setMinRadius(minR)
    setMaxRadius(maxR)

    // Set initial crop data
    const initialRadius = Math.min(Math.min(displayWidth, displayHeight) / 4, maxR)
    setCropData({ x: centerX, y: centerY, radius: initialRadius })

    setImageLoaded(true)
  }, [])

  // Create image URL when modal opens
  useEffect(() => {
    if (isOpen && imageFile) {
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

  // Handle mouse/touch events for dragging
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!imageLoaded) return

    e.preventDefault()
    setIsDragging(true)

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if click is within crop circle
    const dx = x - cropData.x
    const dy = y - cropData.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance <= cropData.radius) {
      // Start dragging from current position
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const newX = moveEvent.clientX - rect.left
        const newY = moveEvent.clientY - rect.top

        // Constrain to image bounds
        const constrainedX = Math.max(cropData.radius, Math.min(imageDisplaySize.width - cropData.radius, newX))
        const constrainedY = Math.max(cropData.radius, Math.min(imageDisplaySize.height - cropData.radius, newY))

        setCropData(prev => ({ ...prev, x: constrainedX, y: constrainedY }))
      }

      const handlePointerUp = () => {
        setIsDragging(false)
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    }
  }, [imageLoaded, cropData, imageDisplaySize])

  // Handle radius change from slider
  const handleRadiusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newRadius = parseInt(e.target.value)

    // Constrain crop circle to stay within image bounds
    const maxX = imageDisplaySize.width - newRadius
    const maxY = imageDisplaySize.height - newRadius

    const constrainedX = Math.max(newRadius, Math.min(maxX, cropData.x))
    const constrainedY = Math.max(newRadius, Math.min(maxY, cropData.y))

    setCropData({ x: constrainedX, y: constrainedY, radius: newRadius })
  }, [cropData, imageDisplaySize])

  // Reset crop to center
  const handleReset = useCallback(() => {
    if (!imageDisplaySize.width || !imageDisplaySize.height) return

    const centerX = imageDisplaySize.width / 2
    const centerY = imageDisplaySize.height / 2
    const defaultRadius = Math.min(100, maxRadius)

    setCropData({ x: centerX, y: centerY, radius: defaultRadius })
  }, [imageDisplaySize, maxRadius])

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
    try {
      const croppedBlob = await generateCroppedImage()
      const naturalCrop = displayToNatural(cropData)
      onCropComplete(naturalCrop, croppedBlob)
    } catch (error) {
      console.error('Error generating cropped image:', error)
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
            className="relative flex items-center justify-center bg-gray-50 rounded-lg"
            style={{
              width: imageDisplaySize.width ? `${imageDisplaySize.width}px` : 'auto',
              height: imageDisplaySize.height ? `${imageDisplaySize.height}px` : 'auto',
              minWidth: '300px',
              minHeight: '300px'
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

                {/* Visible image for cropping */}
                {imageLoaded && (
                  <div className="relative">
                    <img
                      src={imageUrl}
                      alt="Crop preview"
                      style={{
                        width: imageDisplaySize.width,
                        height: imageDisplaySize.height,
                        maxWidth: '100%',
                        maxHeight: '100%'
                      }}
                      className="block"
                      draggable={false}
                    />

                    {/* Crop overlay */}
                    <div
                      className="absolute inset-0 cursor-move"
                      onPointerDown={handlePointerDown}
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
          <div className="p-3 border-t border-gray-200 bg-gray-50">
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

            {/* Instruction text - hidden on small screens */}
            <div className="mb-3 hidden sm:block">
              <p className="text-sm text-gray-600">
                Drag the circle to position your crop area
              </p>
            </div>

            {/* Buttons - aligned and consistent */}
            <div className="flex justify-end space-x-3">
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