"use client"

import React, { useState } from "react"
import { Shield, Eye, EyeOff, Trash2 } from "lucide-react"
import { getCompleteInputStyling } from "@/utils/inputStyles"

export interface AccountFormData {
  username: string
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

export interface AccountSettingsFormProps {
  mode?: "settings" | "onboarding"
  user: {
    email?: string
    oauthProvider?: string | null
    username?: string
  }
  value: AccountFormData
  onChange: (value: AccountFormData) => void
  usernameError?: string
  isUsernameEditable?: boolean
  onToggleUsernameEdit?: () => void
  onCancelUsernameEdit?: () => void
  passwordError?: string
  isPasswordSectionOpen?: boolean
  onTogglePasswordSection?: () => void
  usernameInputRef?: React.Ref<HTMLInputElement>
  passwordSectionRef?: React.Ref<HTMLDivElement>
  regionalDateFormat?: string | null
  onRegionalDateFormatChange?: (val: string | null) => void
  hideHeader?: boolean
  onDeleteAccountClick?: () => void
}

export default function AccountSettingsForm({
  mode = "settings",
  user,
  value,
  onChange,
  usernameError,
  isUsernameEditable = false,
  onToggleUsernameEdit,
  onCancelUsernameEdit,
  passwordError,
  isPasswordSectionOpen = false,
  onTogglePasswordSection,
  usernameInputRef,
  passwordSectionRef,
  regionalDateFormat,
  onRegionalDateFormatChange,
  hideHeader = false,
  onDeleteAccountClick
}: AccountSettingsFormProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const inputStyling = getCompleteInputStyling()
  const isSettings = mode === "settings"
  const isUsernameInputEnabled = onToggleUsernameEdit ? isUsernameEditable : true

  return (
    <div className="space-y-4 max-w-2xl">
      {!hideHeader && (
        <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Account Settings</h2>
      )}

      {/* Email Display (Settings Only) */}
      {isSettings && user.email && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={user.email}
            readOnly
            className={`w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed ${inputStyling.className}`}
            style={inputStyling.style}
          />
        </div>
      )}

      {/* Username Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            ref={usernameInputRef}
            value={value.username}
            readOnly={!isUsernameInputEnabled}
            onChange={(e) => onChange({ ...value, username: e.target.value })}
            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              isUsernameInputEnabled
                ? 'border-gray-300'
                : 'border-gray-200 bg-gray-100 cursor-not-allowed'
            } ${inputStyling.className}`}
            style={inputStyling.style}
            maxLength={50}
            autoComplete="username"
            name="username"
          />
          {onToggleUsernameEdit && (
            <button
              onClick={() => isUsernameEditable && onCancelUsernameEdit ? onCancelUsernameEdit() : onToggleUsernameEdit()}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {isUsernameEditable ? 'Cancel' : 'Change'}
            </button>
          )}
        </div>
        {usernameError && <p className="text-xs text-red-600 mt-1">{usernameError}</p>}
      </div>

      {/* Password Section (Settings Only) */}
      {isSettings && (
        <div ref={passwordSectionRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <div className="flex items-center space-x-2 min-w-0">
            <input
              type="password"
              value="********"
              readOnly
              className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed ${inputStyling.className}`}
              style={inputStyling.style}
            />
            <button
              onClick={onTogglePasswordSection}
              disabled={!!user.oauthProvider}
              title={user.oauthProvider ? `Password management is not available for accounts created with ${user.oauthProvider} login` : undefined}
              className={`px-4 py-2 text-sm border border-gray-300 rounded-lg relative ${
                user.oauthProvider
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "text-gray-700 hover:bg-gray-50 bg-white"
              }`}
            >
              {isPasswordSectionOpen ? "Cancel Change" : "Change Password"}
            </button>
          </div>

          {user.oauthProvider && (
            <p className="mt-2 text-xs text-blue-600 flex items-center">
              <Shield className="w-3 h-3 mr-1" />
              Password management is not available for {user.oauthProvider} accounts
            </p>
          )}

          {isPasswordSectionOpen && !user.oauthProvider && (
            <div className="space-y-2 mt-2 pl-2 border-l-2 border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={value.currentPassword || ""}
                    onChange={(e) => onChange({ ...value, currentPassword: e.target.value })}
                    className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${inputStyling.className}`}
                    style={inputStyling.style}
                    autoComplete="current-password"
                    name="currentPassword"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={value.newPassword || ""}
                    onChange={(e) => onChange({ ...value, newPassword: e.target.value })}
                    className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${inputStyling.className}`}
                    style={inputStyling.style}
                    autoComplete="off"
                    name="newPassword"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={value.confirmPassword || ""}
                    onChange={(e) => onChange({ ...value, confirmPassword: e.target.value })}
                    className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${inputStyling.className}`}
                    style={inputStyling.style}
                    autoComplete="off"
                    name="confirmPassword"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          {passwordError && <p className="text-xs text-red-600 mt-1">{passwordError}</p>}
        </div>
      )}

      {/* Regional Date Format */}
      {onRegionalDateFormatChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Regional date format
          </label>
          <select
            value={regionalDateFormat ?? ''}
            onChange={(e) => onRegionalDateFormatChange(e.target.value || null)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white ${inputStyling.className}`}
            style={inputStyling.style}
          >
            <option value="">Auto detect</option>
            <option value="en-GB">United Kingdom (DD/MM/YYYY)</option>
            <option value="en-US">United States (MM/DD/YYYY)</option>
            <option value="sv-SE">International (YYYY-MM-DD)</option>
          </select>
        </div>
      )}

      {/* Delete Account Section (Settings Only) */}
      {isSettings && onDeleteAccountClick && (
        <>
          <div className="mt-8 pt-6 border-t border-red-200 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start space-x-3 mb-3">
              <Trash2 className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Delete Account</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={onDeleteAccountClick}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Account</span>
            </button>
          </div>
          <div className="mt-8 pt-6 border-t border-red-200 text-center"></div>
        </>
      )}
    </div>
  )
}
