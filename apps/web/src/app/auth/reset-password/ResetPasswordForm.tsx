"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import PasswordInput from "@/components/PasswordInput"
import { validatePasswordFormat, validatePasswordConfirmation } from "@/utils/passwordValidation"
import { extractErrorMessage } from "@/lib/extract-api-error"

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    new_password: "",
    confirm_password: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("No reset token found. Please request a new password reset link.")
    } else {
      setError("")
    }
  }, [token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError("")
    if (name === 'new_password') {
      setPasswordError("")
      setConfirmPasswordError("")
    }
    if (name === 'confirm_password') {
      setConfirmPasswordError("")
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target
    if (name === 'confirm_password' && formData.confirm_password) {
      const pwResult = validatePasswordFormat(formData.new_password)
      if (!pwResult.valid) {
        setPasswordError(pwResult.message ?? "")
        setConfirmPasswordError("")
        return
      }
      setPasswordError("")
      const matchErr = validatePasswordConfirmation(formData.new_password, formData.confirm_password)
      setConfirmPasswordError(matchErr ?? "")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const pwResult = validatePasswordFormat(formData.new_password)
    setPasswordError(pwResult.message ?? "")
    if (!pwResult.valid) {
      setConfirmPasswordError("")
      return
    }

    const matchErr = validatePasswordConfirmation(formData.new_password, formData.confirm_password)
    setConfirmPasswordError(matchErr ?? "")
    if (matchErr) return

    if (!token) {
      setError("Missing reset token.")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, new_password: formData.new_password }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => router.push("/auth/login"), 3000)
      } else {
        setError(extractErrorMessage(data, "Failed to reset password. The link may be invalid or expired."))
      }
    } catch (err) {
      setError("Network error. Please check your connection.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
            <p className="text-gray-600">Enter your new password below.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success ? (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm">Password has been reset successfully! Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <PasswordInput
                id="new_password"
                name="new_password"
                value={formData.new_password}
                onChange={handleChange}
                onBlur={handleBlur}
                label="New Password"
                placeholder="Enter your new password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                helperText="Must be at least 8 characters long"
                required
                error={passwordError}
              />
              <PasswordInput
                id="confirm_password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                onBlur={handleBlur}
                label="Confirm New Password"
                placeholder="Confirm your new password"
                autoComplete="new-password"
                required
                error={confirmPasswordError}
              />
              <button
                type="submit"
                data-testid="reset-submit"
                disabled={isLoading || !token}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              <Link href="/auth/login" className="text-purple-600 hover:text-purple-700 font-medium">
                Back to Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
