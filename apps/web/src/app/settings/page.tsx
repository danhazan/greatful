"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, 
  Shield, 
  Bell, 
  Share2, 
  AtSign, 
  Eye, 
  EyeOff, 
  Users, 
  Globe,
  Lock,
  Save,
  ArrowLeft
} from 'lucide-react'

interface UserPreferences {
  user_id: number
  allow_sharing: boolean
  allow_mentions: boolean
  privacy_level: 'public' | 'followers' | 'private'
  notification_settings: {
    share_notifications: boolean
    mention_notifications: boolean
    reaction_notifications: boolean
    follow_notifications: boolean
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const response = await fetch('/api/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load preferences')
      }

      const data = await response.json()
      setPreferences(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    if (!preferences) return

    setSaving(true)
    setError(null)

    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allow_sharing: preferences.allow_sharing,
          allow_mentions: preferences.allow_mentions,
          privacy_level: preferences.privacy_level,
          notification_settings: preferences.notification_settings,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to save preferences')
      }

      const updatedPreferences = await response.json()
      setPreferences(updatedPreferences)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (key: keyof UserPreferences, value: any) => {
    if (!preferences) return
    setPreferences({ ...preferences, [key]: value })
  }

  const updateNotificationSetting = (key: string, value: boolean) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      notification_settings: {
        ...preferences.notification_settings,
        [key]: value,
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your settings...</p>
        </div>
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load preferences</p>
          <button 
            onClick={loadPreferences}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Privacy & Settings</h1>
              <p className="text-gray-600">Manage your account privacy and notification preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Save className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">Settings saved successfully!</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Privacy Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
            </div>

            <div className="space-y-6">
              {/* Privacy Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Account Privacy Level
                </label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy_level"
                      value="public"
                      checked={preferences.privacy_level === 'public'}
                      onChange={(e) => updatePreference('privacy_level', e.target.value)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <Globe className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">Public</p>
                      <p className="text-sm text-gray-600">Anyone can see your posts and interact with you</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy_level"
                      value="followers"
                      checked={preferences.privacy_level === 'followers'}
                      onChange={(e) => updatePreference('privacy_level', e.target.value)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Followers Only</p>
                      <p className="text-sm text-gray-600">Only your followers can see your posts and mention you</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="privacy_level"
                      value="private"
                      checked={preferences.privacy_level === 'private'}
                      onChange={(e) => updatePreference('privacy_level', e.target.value)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <Lock className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-gray-900">Private</p>
                      <p className="text-sm text-gray-600">Only you can see your posts and control all interactions</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sharing Settings */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Share2 className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">Allow Sharing</p>
                      <p className="text-sm text-gray-600">Let others share your posts</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.allow_sharing}
                      onChange={(e) => updatePreference('allow_sharing', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              {/* Mentions Settings */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <AtSign className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">Allow Mentions</p>
                      <p className="text-sm text-gray-600">Let others mention you in posts and messages</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.allow_mentions}
                      onChange={(e) => updatePreference('allow_mentions', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Bell className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
            </div>

            <div className="space-y-4">
              {Object.entries({
                share_notifications: 'Share Notifications',
                mention_notifications: 'Mention Notifications',
                reaction_notifications: 'Reaction Notifications',
                follow_notifications: 'Follow Notifications',
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-600">
                      Get notified when someone {key.replace('_notifications', 's').replace('_', ' ')} your content
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.notification_settings[key as keyof typeof preferences.notification_settings]}
                      onChange={(e) => updateNotificationSetting(key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}