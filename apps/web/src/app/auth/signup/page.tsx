"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getCompleteInputStyling } from "@/utils/inputStyles"
import PasswordInput from "@/components/PasswordInput"
import OAuthIconButton from "@/components/OAuthIconButton"
import AccountLinkingDialog from "@/components/AccountLinkingDialog"
import { useOAuth } from "@/hooks/useOAuth"

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showLinkingDialog, setShowLinkingDialog] = useState(false)
  const [linkingData, setLinkingData] = useState<any>(null)
  
  const { 
    providers, 
    isLoading: oauthLoading, 
    error: oauthError, 
    isAvailable: oauthAvailable,
    handleOAuthLogin,
    clearError: clearOAuthError
  } = useOAuth()

  const [usernameError, setUsernameError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Re-validate username on submit
    if (!validateUsername(formData.username)) {
      setIsLoading(false)
      return
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Store the access token if returned (backend wraps response in data field)
        const accessToken = data.data?.access_token || data.access_token
        if (accessToken) {
          localStorage.setItem("access_token", accessToken)
        }
        
        // Redirect to feed or login
        router.push(accessToken ? "/feed" : "/auth/login")
      } else {
        // Handle structured error responses from backend
        let errorMessage = "Signup failed. Please try again."
        
        try {
          if (data.detail) {
            if (Array.isArray(data.detail)) {
              // Handle validation errors (array of error objects)
              errorMessage = data.detail.map((err: any) => {
                if (typeof err === 'string') return err
                if (typeof err === 'object' && err !== null) {
                  return err.msg || err.message || JSON.stringify(err)
                }
                return String(err)
              }).join(', ')
            } else if (typeof data.detail === 'string') {
              // Handle simple string errors
              errorMessage = data.detail
            } else if (typeof data.detail === 'object' && data.detail !== null) {
              // Handle error objects with message property
              errorMessage = data.detail.message || JSON.stringify(data.detail)
            } else {
              errorMessage = String(data.detail)
            }
          } else if (data.message && typeof data.message === 'string') {
            errorMessage = data.message
          } else if (data.error && typeof data.error === 'string') {
            errorMessage = data.error
          } else if (data.error && typeof data.error === 'object' && data.error !== null) {
            errorMessage = data.error.message || JSON.stringify(data.error)
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError)
          errorMessage = "Signup failed. Please try again."
        }
        
        // Ensure errorMessage is always a string
        if (typeof errorMessage !== 'string') {
          errorMessage = "Signup failed. Please try again."
        }
        
        setError(errorMessage)
      }
    } catch (error) {
      setError("Network error. Please check your connection.")
    } finally {
      setIsLoading(false)
    }
  }

  const validateUsername = (value: string): boolean => {
    if (value.length < 3 || value.length > 30) {
      setUsernameError('Username must be 3-30 characters long.');
      return false;
    }
    const regex = /^[a-z0-9_]+$/;
    if (!regex.test(value)) {
      setUsernameError('Only letters, numbers, and underscores are allowed.');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'username') {
      const lowerCaseUsername = value.toLowerCase();
      setFormData({ ...formData, [name]: lowerCaseUsername });
      validateUsername(lowerCaseUsername);
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  }

  const handleOAuthLoginClick = async (provider: 'google' | 'facebook') => {
    try {
      setError("")
      clearOAuthError()
      await handleOAuthLogin(provider)
    } catch (error: any) {
      // Check if this is an account linking scenario
      if (error?.details?.existing_user) {
        setLinkingData({
          provider,
          existingUser: error.details.existing_user
        })
        setShowLinkingDialog(true)
      } else {
        setError(error?.message || `Failed to sign up with ${provider}`)
      }
    }
  }

  const handleAccountLinking = async () => {
    // This would typically make an API call to link accounts
    // For now, we'll just close the dialog and show success
    setShowLinkingDialog(false)
    setLinkingData(null)
    // In a real implementation, you would call an account linking API here
  }

  const handleLinkingCancel = () => {
    setShowLinkingDialog(false)
    setLinkingData(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <span className="text-3xl">💜</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Grateful</h1>
            <p className="text-gray-600">Start your gratitude journey today</p>
          </div>

          {/* Error Message */}
          {(error || oauthError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error || oauthError}</p>
            </div>
          )}



          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${getCompleteInputStyling().className}`}
                style={getCompleteInputStyling().style}
                placeholder="Choose a username"
                minLength={3}
                maxLength={30}
              />
              {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${getCompleteInputStyling().className}`}
                style={getCompleteInputStyling().style}
                placeholder="Enter your email"
              />
            </div>

            <PasswordInput
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              label="Password"
              placeholder="Create a password"
              autoComplete="new-password"
              minLength={8}
              helperText="Must be at least 8 characters long"
              required
            />

            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              label="Confirm Password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-purple-600 hover:text-purple-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>

          {/* OAuth Icon Buttons */}
          {oauthAvailable && providers && (providers.providers.google || providers.providers.facebook) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600 mb-3">Or continue with</p>
              <div className="flex justify-center gap-3">
                {providers.providers.google && (
                  <OAuthIconButton
                    provider="google"
                    onOAuthLogin={handleOAuthLoginClick}
                    disabled={isLoading || oauthLoading}
                  />
                )}
                {/* Facebook - Always show but disabled */}
                <OAuthIconButton
                  provider="facebook"
                  onOAuthLogin={handleOAuthLoginClick}
                  disabled={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Account Linking Dialog */}
        {showLinkingDialog && linkingData && (
          <AccountLinkingDialog
            isOpen={showLinkingDialog}
            onClose={handleLinkingCancel}
            onConfirm={handleAccountLinking}
            onCancel={handleLinkingCancel}
            existingUser={linkingData.existingUser}
            oauthProvider={linkingData.provider}
            isLoading={false}
          />
        )}
      </div>
    </div>
  )
}