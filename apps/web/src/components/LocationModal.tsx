"use client"

import React, { useState } from "react"
import { X, MapPin } from "lucide-react"
import LocationAutocomplete from "./LocationAutocomplete"

interface LocationResult {
  displayName: string
  lat: number
  lon: number
  placeId?: string
  address: {
    city?: string
    state?: string
    country?: string
    countryCode?: string
  }
  importance?: number
  type?: string
}

interface LocationModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationSelect: (location: LocationResult | null) => void
  initialValue?: string
}

export default function LocationModal({
  isOpen,
  onClose,
  onLocationSelect,
  initialValue = ""
}: LocationModalProps) {
  const [locationQuery, setLocationQuery] = useState(initialValue)

  // Update locationQuery when initialValue changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocationQuery(initialValue)
    }
  }, [isOpen, initialValue])

  if (!isOpen) return null

  const handleLocationSelect = (location: LocationResult | null) => {
    if (location) {
      // Only close modal when a location is actually selected
      onLocationSelect(location)
      onClose()
    } else {
      // If location is cleared, just update the parent but don't close modal
      onLocationSelect(null)
    }
  }

  const handleLocationQueryChange = (value: string) => {
    setLocationQuery(value)
    // Don't automatically clear location or close modal when typing
  }

  const handleClose = () => {
    // Reset the query but don't clear the selected location
    setLocationQuery(initialValue)
    onClose()
  }

  return (
    <div
      data-location-modal
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => {
          // Prevent clicks inside the modal from bubbling up
          e.stopPropagation()
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Location</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search for a location
            </label>
            <LocationAutocomplete
              value={locationQuery}
              onChange={handleLocationQueryChange}
              onLocationSelect={handleLocationSelect}
              placeholder="Enter city, neighborhood, or place..."
              className="w-full"
            />
          </div>

          <div className="text-xs text-gray-500">
            <MapPin className="h-3 w-3 inline mr-1" />
            Your location will be visible to others who can see your post
            {initialValue && (
              <div className="mt-2 text-xs text-green-600">
                ✓ Current: {initialValue}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between p-4 border-t border-gray-200">
          <button
            onClick={() => {
              onLocationSelect(null)
              onClose()
            }}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            Clear Location
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}