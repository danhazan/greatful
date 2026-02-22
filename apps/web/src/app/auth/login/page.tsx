"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getCompleteInputStyling } from "@/utils/inputStyles"
import PasswordInput from "@/components/PasswordInput"
import OAuthIconButton from "@/components/OAuthIconButton"
import AccountLinkingDialog from "@/components/AccountLinkingDialog"
import { useOAuth } from "@/hooks/useOAuth"
import { useUser } from "@/contexts/UserContext"

export default function LoginPage() {
  const router = useRouter()
  const { reloadUser } = useUser()
  const [formData, setFormData] = useState({
    email: "",
    password: ""
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        // Store the access token from normalized camelCase response
        const accessToken = data.data?.accessToken || data.accessToken
        localStorage.setItem("access_token", accessToken)
        
        // Trigger UserContext to reload user data with the new token
        await reloadUser()
        
        // Redirect to feed
        router.push("/feed")
      } else {
        // Handle structured error responses from backend
        let errorMessage = "Login failed. Please try again."
        
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
          errorMessage = "Login failed. Please try again."
        }
        
        // Ensure errorMessage is always a string
        if (typeof errorMessage !== 'string') {
          errorMessage = "Login failed. Please try again."
        }
        
        setError(errorMessage)
      }
    } catch (error) {
      setError("Network error. Please check your connection.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
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
        setError(error?.message || `Failed to sign in with ${provider}`)
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-600">Sign in to continue sharing your gratitude</p>
          </div>

          {/* Error Message */}
          {(error || oauthError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error || oauthError}</p>
            </div>
          )}



          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
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
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            >
              <div className="text-right mt-2">
                <Link href="/auth/forgot-password" className="text-sm text-purple-600 hover:text-purple-700">
                  Forgot your password?
                </Link>
              </div>
            </PasswordInput>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <Link href="/auth/signup" className="text-purple-600 hover:text-purple-700 font-medium">
                Sign up
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
