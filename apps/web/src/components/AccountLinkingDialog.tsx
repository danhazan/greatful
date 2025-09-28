"use client"

import React from 'react'
import { AlertTriangle, User, Mail, X } from 'lucide-react'

interface AccountLinkingDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel: () => void
  existingUser: {
    email: string
    username: string
    provider?: string
  }
  oauthProvider: 'google' | 'facebook'
  isLoading?: boolean
}

const AccountLinkingDialog: React.FC<AccountLinkingDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  existingUser,
  oauthProvider,
  isLoading = false
}) => {
  if (!isOpen) return null

  const getProviderName = (provider: 'google' | 'facebook') => {
    return provider === 'google' ? 'Google' : 'Facebook'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Account Already Exists
          </h2>
          <p className="text-gray-600 text-sm">
            We found an existing account with this email address.
          </p>
        </div>

        {/* Account Information */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {existingUser.username}
                </p>
                <p className="text-xs text-gray-500">Username</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {existingUser.email}
                </p>
                <p className="text-xs text-gray-500">Email address</p>
              </div>
            </div>
            {existingUser.provider && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-xs">🔗</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {getProviderName(existingUser.provider as 'google' | 'facebook')} Account
                  </p>
                  <p className="text-xs text-gray-500">Already linked</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Explanation */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            Would you like to link your {getProviderName(oauthProvider)} account to this existing Grateful account?
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Linking accounts will:</strong>
            </p>
            <ul className="text-xs text-blue-700 mt-1 space-y-1">
              <li>• Allow you to sign in with {getProviderName(oauthProvider)}</li>
              <li>• Keep all your existing posts and data</li>
              <li>• Maintain your current username and settings</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Linking Account...' : `Link ${getProviderName(oauthProvider)} Account`}
          </button>
          
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Alternative Action */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Already have access to this account?{' '}
            <button
              onClick={onClose}
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              Sign in with email instead
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AccountLinkingDialog