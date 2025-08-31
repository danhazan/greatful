"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MapPin, X, Loader2 } from "lucide-react"

interface LocationResult {
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

interface LocationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onLocationSelect: (location: LocationResult | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function LocationAutocomplete({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Enter city, neighborhood, or place...",
  disabled = false,
  className = ""
}: LocationAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const isSelectingRef = useRef(false)

  // Debounced search function
  const debouncedSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        throw new Error("Authentication required")
      }

      const response = await fetch('/api/users/location/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: query.trim(),
          limit: 8
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data = await response.json()
      setResults(data.data || [])
      setIsOpen(true)
      setSelectedIndex(-1)
    } catch (err) {
      console.error('Location search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      debouncedSearch(newValue)
    }, 300)
  }

  // Handle location selection
  const handleLocationSelect = (location: LocationResult) => {
    isSelectingRef.current = true
    onChange(location.display_name)
    onLocationSelect(location)
    setIsOpen(false)
    setResults([])
    setSelectedIndex(-1)
    inputRef.current?.blur()
    // Reset the flag after a short delay
    setTimeout(() => {
      isSelectingRef.current = false
    }, 100)
  }

  // Handle input blur - clear invalid text
  const handleInputBlur = () => {
    // Don't clear if user is selecting from dropdown
    if (isSelectingRef.current) {
      return
    }
    
    // Delay to allow click events on dropdown items to register first
    setTimeout(() => {
      // Don't clear if user selected something
      if (isSelectingRef.current) {
        return
      }
      
      // If there's text but no valid location selected, clear the input
      if (value && value.trim() && !results.find(r => r.display_name === value)) {
        onChange("")
        onLocationSelect(null)
      }
      setIsOpen(false)
      setSelectedIndex(-1)
    }, 150)
  }

  // Handle clear
  const handleClear = () => {
    onChange("")
    onLocationSelect(null)
    setIsOpen(false)
    setResults([])
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleLocationSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className="h-4 w-4 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-purple-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-300 focus:ring-red-500' : ''}
          `}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-y-0 right-8 flex items-center">
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" data-testid="loading-spinner" />
          </div>
        )}

        {/* Clear Button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 transition-colors"
            aria-label="Clear location"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && (results.length > 0 || isLoading) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {results.map((location, index) => (
            <button
              key={`${location.place_id}-${index}`}
              type="button"
              onMouseDown={() => {
                isSelectingRef.current = true
              }}
              onClick={() => handleLocationSelect(location)}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                border-b border-gray-100 last:border-b-0
                ${index === selectedIndex ? 'bg-purple-50 text-purple-700' : 'text-gray-900'}
              `}
            >
              <div className="flex items-start space-x-3">
                <MapPin className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  index === selectedIndex ? 'text-purple-500' : 'text-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {location.display_name}
                  </p>
                  {location.address.country && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[
                        location.address.city,
                        location.address.state,
                        location.address.country
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
          
          {results.length === 0 && !isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No locations found. Try a different search term.
            </div>
          )}
        </div>
      )}
    </div>
  )
}