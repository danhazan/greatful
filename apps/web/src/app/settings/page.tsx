"use client"

import { useState, useEffect, useCallback } from 'react'
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
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react'

import { UserPreferences } from '@/types/user'
import { useToast } from '@/contexts/ToastContext'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/utils/apiClient'


export default function SettingsPage() {
  const router = useRouter()
  const { showError: showErrorToast } = useToast()
  const { currentUser, logout } = useUser()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)


  const loadPreferences = useCallback(async () => {
    try {
      const data = await apiClient.get<UserPreferences>('/preferences')
      setPreferences(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const savePreferences = async () => {
    if (!preferences) return

    setSaving(true)
    setError(null)

    try {
      const updatedPreferences = await apiClient.put<UserPreferences>('/preferences', {
        allowSharing: preferences.allowSharing,
        allowMentions: preferences.allowMentions,
        privacyLevel: preferences.privacyLevel,
        notificationSettings: preferences.notificationSettings,
      })
      setPreferences(updatedPreferences)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save preferences'
      setError(msg)
      showErrorToast('Save Failed', msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== currentUser?.username) {
      setDeleteError('Username does not match')
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await apiClient.delete('/users/me', {
        body: { confirmation: deleteConfirmation },
      })
      logout()
      router.push('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account'
      setDeleteError(msg)
      showErrorToast('Deletion Failed', msg)
    } finally {
      setIsDeleting(false)
    }
  }

  const updatePreference = (key: keyof UserPreferences, value: any) => {
    if (!preferences) return
    setPreferences({ ...preferences, [key]: value })
  }

  const updateNotificationSetting = (key: keyof UserPreferences['notificationSettings'], value: boolean) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      notificationSettings: {
        ...preferences.notificationSettings,
        [key]: value,
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your settings...</p>
        </div>
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center">
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
                      name="privacyLevel"
                      value="public"
                      checked={preferences.privacyLevel === 'public'}
                      onChange={(e) => updatePreference('privacyLevel', e.target.value as any)}
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
                      name="privacyLevel"
                      value="followers"
                      checked={preferences.privacyLevel === 'followers'}
                      onChange={(e) => updatePreference('privacyLevel', e.target.value as any)}
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
                      name="privacyLevel"
                      value="private"
                      checked={preferences.privacyLevel === 'private'}
                      onChange={(e) => updatePreference('privacyLevel', e.target.value as any)}
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
                      checked={preferences.allowSharing}
                      onChange={(e) => updatePreference('allowSharing', e.target.checked)}
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
                      checked={preferences.allowMentions}
                      onChange={(e) => updatePreference('allowMentions', e.target.checked)}
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
                shareNotifications: 'Share Notifications',
                mentionNotifications: 'Mention Notifications',
                reactionNotifications: 'Reaction Notifications',
                followNotifications: 'Follow Notifications',
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-600">
                      Get notified when someone {key.replace('Notifications', 's').replace(/[A-Z]/g, (m) => ` ${m.toLowerCase()}`)} your content
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.notificationSettings[key as keyof typeof preferences.notificationSettings]}
                      onChange={(e) => updateNotificationSetting(key as keyof typeof preferences.notificationSettings, e.target.checked)}
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

          {/* Delete Account Section */}
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-semibold text-red-900">Delete Account</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
              </div>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); setDeleteError(null) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              This will permanently delete your account and all associated data.
              <strong> This action cannot be undone.</strong>
            </p>

            <p className="text-sm text-gray-600 mb-2">
              Type <strong>{currentUser?.username}</strong> to confirm:
            </p>

            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={currentUser?.username}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 placeholder-gray-400 mb-4"
            />

            {deleteError && (
              <p className="text-red-600 text-sm mb-4">{deleteError}</p>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); setDeleteError(null) }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation !== currentUser?.username}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  'Delete My Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}