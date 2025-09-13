"use client"

import { useRef, useEffect } from "react"
import { X, MapPin } from "lucide-react"

interface LocationData {
  display_name: string
  lat: number
  lon: number
  place_id?: string
  address: {
    city?: string
    state?: string
    country?: string
    country_code?: string
  }
  importance?: number
  type?: string
}

interface LocationDisplayModalProps {
  isOpen: boolean
  onClose: () => void
  location?: string
  locationData?: LocationData
  position?: { x: number, y: number }
}

export default function LocationDisplayModal({ 
  isOpen, 
  onClose, 
  location,
  locationData,
  position = { x: 0, y: 0 }
}: LocationDisplayModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

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

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
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

  if (!isOpen) return null

  // Get the display text - prefer locationData.display_name over location string
  const displayText = locationData?.display_name || location || "Unknown location"

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-25 z-40" />
      
      {/* Small Popup Modal */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-modal-title"
        aria-describedby="location-modal-description"
        className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-32px)]"
        style={{
          left: Math.max(16, Math.min(position.x - 140, window.innerWidth - 320 - 16)),
          top: Math.max(16, Math.min(position.y - 120, window.innerHeight - 200 - 16)),
        }}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 id="location-modal-title" className="text-sm font-semibold text-gray-900">Location</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md p-1"
            aria-label="Close location modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Location Display */}
        <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-left flex-1">
            <p 
              id="location-modal-description" 
              className="text-sm text-gray-900 leading-relaxed break-words"
            >
              {displayText}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            📍 Post location
          </p>
        </div>
      </div>
    </>
  )
}