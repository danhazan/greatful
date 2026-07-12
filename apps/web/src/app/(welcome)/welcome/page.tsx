'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/utils/apiClient'
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload'
import ProfileInformationForm from '@/components/settings/ProfileInformationForm'
import AccountSettingsForm from '@/components/settings/AccountSettingsForm'
import { useLocaleWithUpdate } from '@/hooks/useLocale'
import { getUserPreferencesKey } from '@/utils/localStorage'

interface CropData {
  x: number
  y: number
  radius: number
}

interface OnboardingData {
  username: string
  displayName: string
  bio: string
  city: string
  institutions: string[]
  websites: string[]
  selectedLocation: any
  photoBlob: Blob | null
  cropData: CropData | null
  regionalDateFormat: string | null
  photoRemoved: boolean
}

interface Slide {
  id: string
  type: 'setup' | 'info'
}

const SLIDES: Slide[] = [
  { id: 'welcome-photo', type: 'setup' },
  { id: 'profile', type: 'setup' },
  { id: 'account', type: 'setup' },
  { id: 'info', type: 'info' },
]

const initialData: OnboardingData = {
  username: '',
  displayName: '',
  bio: '',
  city: '',
  institutions: [],
  websites: [],
  selectedLocation: null,
  photoBlob: null,
  cropData: null,
  regionalDateFormat: null,
  photoRemoved: false,
}

export default function WelcomePage() {
  const router = useRouter()
  const { currentUser, isLoading, reloadUser } = useUser()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [data, setData] = useState<OnboardingData>(initialData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isUsernameEditable, setIsUsernameEditable] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const { updatePreference } = useLocaleWithUpdate()

  // Pre-populate from existing user data on mount. Runs once when currentUser
  // loads; data fields are guaranteed empty at first render.
  useEffect(() => {
    if (!currentUser) return

    const updates: Partial<OnboardingData> = {}
    if (currentUser.username) updates.username = currentUser.username
    if (currentUser.displayName) updates.displayName = currentUser.displayName

    if (Object.keys(updates).length > 0) {
      setData(prev => ({ ...prev, ...updates }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  // Route protection: redirect if not authenticated or signup token absent/expired
  useEffect(() => {
    if (isLoading) return
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (!currentUser.signupEligible) {
      router.push('/profile')
    }
  }, [currentUser, isLoading, router])

  const updateData = (partial: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...partial }))
  }

  const handleControlledFile = useCallback((blob: Blob, crop: CropData) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    updateData({ photoBlob: blob, cropData: crop, photoRemoved: false })
    setPreviewUrl(URL.createObjectURL(blob))
  }, [previewUrl])

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  if (isLoading || !currentUser || !currentUser.signupEligible) return null

  const slide = SLIDES[currentSlide]
  const isFirstSlide = currentSlide === 0
  const isLastSlide = currentSlide === SLIDES.length - 1

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const handleToggleUsernameEdit = () => setIsUsernameEditable(true)

  const handleCancelUsernameEdit = () => {
    setIsUsernameEditable(false)
    updateData({ username: currentUser?.username || '' })
    setFieldErrors(prev => { const { username: _removed, ...rest } = prev; return rest })
  }

  // ponytail: Build FormData once, submit once via apiClient (auto-adds auth).
  // Map field errors to slides by convention.
  const buildFormData = (): FormData => {
    const fd = new FormData()
    if (data.username) fd.append('username', data.username)
    if (data.displayName) fd.append('display_name', data.displayName)
    if (data.bio) fd.append('bio', data.bio)
    if (data.city) fd.append('city', data.city)
    if (data.regionalDateFormat) fd.append('regional_date_format', data.regionalDateFormat)
    if (data.institutions.length > 0) fd.append('institutions', JSON.stringify(data.institutions))
    if (data.websites.length > 0) fd.append('websites', JSON.stringify(data.websites))
    if (data.photoBlob) {
      fd.append('file', data.photoBlob, 'profile-photo.jpg')
    } else if (data.photoRemoved) {
      fd.append('remove_profile_image', 'true')
    }
    return fd
  }

  // ponytail: One-entry map. Extend when backend returns more error codes.
  const ERROR_FIELD_MAP: Record<string, string> = {
    already_exists: 'username',
  }

  const FIELD_SLIDE_MAP: Record<string, number> = {
    username: 2,
    display_name: 1,
    bio: 1,
    city: 1,
    file: 0,
  }

  const handleFinish = () => {
    setShowConfirmDialog(true)
  }

  const handleConfirmFinish = async () => {
    setIsSubmitting(true)
    setServerError('')
    setFieldErrors({})

    try {
      const formData = buildFormData()
      const response = await apiClient.requestRaw('/users/me/onboarding', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        if (data.regionalDateFormat && currentUser?.id) {
          try {
            const prefsKey = getUserPreferencesKey(currentUser.id)
            const stored = localStorage.getItem(prefsKey)
            const prefs = stored ? JSON.parse(stored) : {}
            prefs.regionalDateFormat = data.regionalDateFormat
            localStorage.setItem(prefsKey, JSON.stringify(prefs))
          } catch {}
          updatePreference(data.regionalDateFormat)
        }
        await reloadUser()
        router.push('/profile')
        return
      }

      if (response.status === 409 || response.status === 422) {
        const errData = await response.json().catch(() => ({}))
        const apiError = errData.error || {}
        const code = apiError.code || ''

        // Handle both middleware-shaped errors (error.message) and
        // FastAPI-native 422 validation arrays ({ detail: [{ msg, loc }] })
        const rawDetail = errData.detail
        const detailMessage = Array.isArray(rawDetail)
          ? rawDetail.map((e: any) => e.msg).filter(Boolean).join(', ')
          : typeof rawDetail === 'string' ? rawDetail : ''
        const message = apiError.message || detailMessage

        if (code && ERROR_FIELD_MAP[code]) {
          const field = ERROR_FIELD_MAP[code]
          const slide = FIELD_SLIDE_MAP[field]
          setFieldErrors({ [field]: message })
          if (slide !== undefined) setCurrentSlide(slide)
          else setServerError(message)
        } else if (message) {
          setServerError(message)
          setCurrentSlide(0)
        }
        return
      }

      setServerError('Something went wrong. Please try again.')
    } catch {
      setServerError('Network error. Please check your connection.')
    } finally {
      setIsSubmitting(false)
      setShowConfirmDialog(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-4 sm:p-8">
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(i)}
              className={`w-3 h-3 rounded-full transition-colors ${
                i === currentSlide ? 'bg-purple-600' : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Slide content */}
        <div className="mb-8">
          {slide.id === 'welcome-photo' && (
            <div>
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-6">
                  <span className="text-4xl">💜</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Grateful</h1>
                <p className="text-gray-500 text-base max-w-md mx-auto mb-6">
                  Choose your profile photo
                </p>
              </div>
              <ProfilePhotoUpload
                currentPhotoUrl={data.photoRemoved ? undefined : currentUser?.profileImageUrl}
                onPhotoUpdate={() => { setPreviewUrl(undefined); updateData({ photoBlob: null, cropData: null, photoRemoved: !!currentUser?.profileImageUrl }) }}
                onControlledFile={handleControlledFile}
                previewUrl={previewUrl}
              />
            </div>
          )}

          {slide.id === 'profile' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Profile Information</h2>
              <p className="text-gray-600 text-sm mb-6">Tell others a bit about yourself.</p>
              <ProfileInformationForm
                value={{
                  displayName: data.displayName,
                  bio: data.bio,
                  city: data.city,
                  institutions: data.institutions,
                  websites: data.websites,
                }}
                onChange={(val) => updateData({
                  displayName: val.displayName,
                  bio: val.bio,
                  city: val.city,
                  institutions: val.institutions,
                  websites: val.websites,
                })}
                selectedLocation={data.selectedLocation}
                onLocationSelect={(loc: any) => updateData({ selectedLocation: loc, city: loc?.displayName || loc?.display_name || '' })}
                hideHeader
              />
              {fieldErrors['display_name'] && (
                <p className="text-xs text-red-600 mt-2">{fieldErrors['display_name']}</p>
              )}
            </div>
          )}

          {slide.id === 'account' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Account Settings</h2>
              <p className="text-gray-600 text-sm mb-6">Choose your username and preferences.</p>
              <AccountSettingsForm
                mode="onboarding"
                user={{ email: currentUser?.email, oauthProvider: null, username: currentUser?.username }}
                value={{ username: data.username }}
                onChange={(val) => {
                  updateData({ username: val.username })
                  setFieldErrors(prev => { const { username: _removed, ...rest } = prev; return rest })
                }}
                onRegionalDateFormatChange={(val) => updateData({ regionalDateFormat: val })}
                regionalDateFormat={data.regionalDateFormat}
                isUsernameEditable={isUsernameEditable}
                onToggleUsernameEdit={handleToggleUsernameEdit}
                onCancelUsernameEdit={handleCancelUsernameEdit}
                hideHeader
                usernameError={fieldErrors['username']}
              />
            </div>
          )}

          {slide.id === 'info' && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-6">
                <span className="text-4xl">💜</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">All set!</h2>
              <p className="text-gray-600 text-lg max-w-md mx-auto">
                You can now start sharing your gratitude with the world.
              </p>
            </div>
          )}
        </div>

        {/* Server error */}
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{serverError}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-end pt-4 border-t border-gray-200 gap-3">
          {!isFirstSlide && (
            <button
              onClick={handlePrev}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
          )}

          {!isLastSlide && (
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          )}

          {isLastSlide && (
            <button
              onClick={handleFinish}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Finish'}
            </button>
          )}
        </div>

        {/* Finish confirmation dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <p className="text-gray-700 leading-relaxed">
                  Your profile can always be edited later from your Profile page.
                </p>
              </div>
              <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmFinish}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Finish'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
