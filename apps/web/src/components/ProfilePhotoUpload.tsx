'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, User, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { validateImageFile, createImagePreview, revokeImagePreview } from '@/utils/imageUpload'
import { getImageUrl } from '@/utils/imageUtils'

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string
  onPhotoUpdate: (photoUrl: string | null) => void
  className?: string
}

interface UploadResponse {
  success: boolean
  data?: {
    profile_image_url: string
    urls: {
      thumbnail: string
      small: string
      medium: string
      large: string
    }
  }
  error?: string
}

export default function ProfilePhotoUpload({ 
  currentPhotoUrl, 
  onPhotoUpdate, 
  className = '' 
}: ProfilePhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showSuccess, showError } = useToast()

  // Use existing validation utility with profile photo specific options
  const profilePhotoOptions = {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] // No GIF for profile photos
  }

  const uploadPhoto = async (file: File) => {
    // Use existing validation utility
    const validation = validateImageFile(file, profilePhotoOptions)
    if (!validation.valid) {
      showError(validation.error || 'Invalid file')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/users/me/profile/photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const result: UploadResponse = await response.json()

      if (response.ok && result.success && result.data) {
        onPhotoUpdate(result.data.profile_image_url)
        showSuccess('Profile photo updated successfully!')
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      showError(
        error instanceof Error ? error.message : 'Failed to upload photo'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const deletePhoto = async () => {
    if (!currentPhotoUrl) return

    setIsUploading(true)

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/users/me/profile/photo', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        onPhotoUpdate(null)
        showSuccess('Profile photo removed successfully!')
      } else {
        throw new Error('Failed to delete photo')
      }
    } catch (error) {
      console.error('Delete error:', error)
      showError('Failed to remove photo')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (file: File) => {
    uploadPhoto(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      handleFileSelect(file)
    }
  }, [])

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`relative ${className}`}>
      {/* Current Photo Display */}
      <div className="relative w-32 h-32 mx-auto mb-4">
        {currentPhotoUrl ? (
          <img
            src={getImageUrl(currentPhotoUrl) || currentPhotoUrl}
            alt="Profile"
            className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-100 to-purple-200 border-4 border-white shadow-lg flex items-center justify-center">
            <User className="w-12 h-12 text-purple-400" />
          </div>
        )}

        {/* Upload/Delete Overlay */}
        <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center group">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
            <button
              onClick={openFileDialog}
              disabled={isUploading}
              className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Upload new photo"
            >
              <Camera className="w-4 h-4 text-gray-700" />
            </button>
            {currentPhotoUrl && (
              <button
                onClick={deletePhoto}
                disabled={isUploading}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Remove photo"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        </div>

        {/* Loading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Drag and Drop Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200
          ${dragActive 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
          }
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-1">
          {dragActive ? 'Drop your photo here' : 'Click to upload or drag and drop'}
        </p>
        <p className="text-xs text-gray-500">
          JPEG, PNG, or WebP (max 5MB)
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isUploading}
      />
    </div>
  )
}