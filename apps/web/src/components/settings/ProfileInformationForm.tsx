"use client"

import React, { useState } from "react"
import { Building, Globe, Trash2 } from "lucide-react"
import LocationAutocomplete from "@/components/LocationAutocomplete"
import { getCompleteInputStyling } from "@/utils/inputStyles"

export interface ProfileFormData {
  displayName: string
  bio: string
  city: string
  institutions: string[]
  websites: string[]
}

export interface ProfileInformationFormProps {
  value: ProfileFormData
  onChange: (value: ProfileFormData) => void
  selectedLocation: any
  onLocationSelect: (location: any) => void
  hideHeader?: boolean
}

export default function ProfileInformationForm({
  value,
  onChange,
  selectedLocation,
  onLocationSelect,
  hideHeader = false
}: ProfileInformationFormProps) {
  const [pendingInstitution, setPendingInstitution] = useState("")
  const [pendingWebsite, setPendingWebsite] = useState("")
  const [institutionError, setInstitutionError] = useState("")
  const [websiteError, setWebsiteError] = useState("")

  const inputStyling = getCompleteInputStyling()

  const addInstitution = () => {
    const trimmed = pendingInstitution.trim()
    if (!trimmed) {
      setInstitutionError("Institution name cannot be empty")
      return
    }

    const institutions = Array.isArray(value.institutions) ? value.institutions : []
    if (institutions.length >= 10) {
      setInstitutionError("Maximum 10 institutions allowed")
      return
    }

    if (institutions.includes(trimmed)) {
      setInstitutionError("Institution already added")
      return
    }

    onChange({
      ...value,
      institutions: [...institutions, trimmed]
    })
    setPendingInstitution("")
    setInstitutionError("")
  }

  const removeInstitution = (index: number) => {
    const institutions = Array.isArray(value.institutions) ? value.institutions : []
    const newInstitutions = institutions.filter((_, i) => i !== index)
    onChange({
      ...value,
      institutions: newInstitutions
    })
  }

  const addWebsite = () => {
    const trimmed = pendingWebsite.trim()
    if (!trimmed) {
      setWebsiteError("Website URL cannot be empty")
      return
    }

    // Normalize URL (add https:// if not present)
    const normalizedUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`

    // Strict URL validation to match backend requirements
    const urlPattern = /^https?:\/\/(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/?|[\/\?]\S+)$/i

    if (!urlPattern.test(normalizedUrl)) {
      setWebsiteError("Please enter a valid website URL (e.g., example.com or https://example.com)")
      return
    }

    try {
      const url = new URL(normalizedUrl)
      if (url.hostname.includes('@') || (!url.hostname.includes('.') && url.hostname !== 'localhost')) {
        throw new Error("Invalid hostname")
      }
    } catch {
      setWebsiteError("Please enter a valid website URL (e.g., example.com or https://example.com)")
      return
    }

    const websites = Array.isArray(value.websites) ? value.websites : []
    if (websites.length >= 5) {
      setWebsiteError("Maximum 5 websites allowed")
      return
    }

    if (websites.includes(normalizedUrl)) {
      setWebsiteError("Website already added")
      return
    }

    onChange({
      ...value,
      websites: [...websites, normalizedUrl]
    })
    setPendingWebsite("")
    setWebsiteError("")
  }

  const removeWebsite = (index: number) => {
    const websites = Array.isArray(value.websites) ? value.websites : []
    const newWebsites = websites.filter((_, i) => i !== index)
    onChange({
      ...value,
      websites: newWebsites
    })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {!hideHeader && (
        <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Profile Information</h2>
      )}

      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Display Name
        </label>
        <input
          type="text"
          value={value.displayName}
          onChange={(e) => onChange({ ...value, displayName: e.target.value })}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${inputStyling.className}`}
          style={inputStyling.style}
          maxLength={100}
          placeholder="How you want to be displayed"
        />
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bio
        </label>
        <textarea
          value={value.bio}
          onChange={(e) => onChange({ ...value, bio: e.target.value })}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${inputStyling.className}`}
          style={inputStyling.style}
          rows={3}
          maxLength={500}
          placeholder="Tell us about yourself..."
        />
        <p className="text-xs text-gray-500 mt-1">
          {(value.bio || "").length}/500 characters
        </p>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Location
        </label>
        <LocationAutocomplete
          value={value.city}
          onChange={(cityValue) => onChange({ ...value, city: cityValue })}
          onLocationSelect={onLocationSelect}
          placeholder="Enter city, neighborhood, or place..."
        />
        {selectedLocation && (
          <p className="text-xs text-gray-500 mt-1">
            Selected: {selectedLocation.displayName || selectedLocation.display_name}
          </p>
        )}
      </div>

      {/* Institutions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Institutions (School, Company, Foundation)
        </label>
        <div className="space-y-2">
          {Array.isArray(value.institutions) && value.institutions.map((institution, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                {String(institution)}
              </div>
              <button
                type="button"
                onClick={() => removeInstitution(index)}
                className="p-2 text-red-500 hover:text-red-700 transition-colors"
                title="Remove institution"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {Array.isArray(value.institutions) && value.institutions.length < 10 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={pendingInstitution}
                  onChange={(e) => {
                    setPendingInstitution(e.target.value)
                    setInstitutionError("")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pendingInstitution.trim()) {
                      e.preventDefault()
                      addInstitution()
                    }
                  }}
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${inputStyling.className}`}
                  style={inputStyling.style}
                  maxLength={100}
                  placeholder="Institution name"
                />
                <button
                  type="button"
                  onClick={addInstitution}
                  disabled={!pendingInstitution.trim()}
                  className="p-2 text-purple-600 hover:text-purple-700 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                  title="Save institution"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                  </svg>
                </button>
              </div>
              {institutionError && (
                <p className="text-xs text-red-600 ml-6">{institutionError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Websites */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Websites
        </label>
        <div className="space-y-2">
          {Array.isArray(value.websites) && value.websites.map((website, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                {String(website)}
              </div>
              <button
                type="button"
                onClick={() => removeWebsite(index)}
                className="p-2 text-red-500 hover:text-red-700 transition-colors"
                title="Remove website"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {Array.isArray(value.websites) && value.websites.length < 5 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="url"
                  value={pendingWebsite}
                  onChange={(e) => {
                    setPendingWebsite(e.target.value)
                    setWebsiteError("")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pendingWebsite.trim()) {
                      e.preventDefault()
                      addWebsite()
                    }
                  }}
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${inputStyling.className}`}
                  style={inputStyling.style}
                  placeholder="https://example.com"
                />
                <button
                  type="button"
                  onClick={addWebsite}
                  disabled={!pendingWebsite.trim()}
                  className="p-2 text-purple-600 hover:text-purple-700 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                  title="Save website"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                  </svg>
                </button>
              </div>
              {websiteError && (
                <p className="text-xs text-red-600 ml-6">{websiteError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
