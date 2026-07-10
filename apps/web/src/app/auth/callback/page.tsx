"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import oauthService from '@/services/oauthService'
import ResurrectionDialog from '@/components/ResurrectionDialog'
import { useUser } from '@/contexts/UserContext'
import { usePostLoginRedirect } from '@/hooks/useAuthRedirect'

export default function OAuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { reloadUser } = useUser()
  const { redirectTo, clearRedirect } = usePostLoginRedirect()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resurrection'>('loading')
  const [message, setMessage] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [resurrectionToken, setResurrectionToken] = useState<string | null>(null)
  const [resurrectionProvider, setResurrectionProvider] = useState<string | null>(null)
  const [resurrectionEmail, setResurrectionEmail] = useState<string | null>(null)
  const [resurrectionUserInfo, setResurrectionUserInfo] = useState<any>(null)
  const [isResurrecting, setIsResurrecting] = useState(false)

  // Prevent double execution in React Strict Mode
  const callbackProcessed = useRef(false)

  useEffect(() => {
    if (callbackProcessed.current) return
    callbackProcessed.current = true

    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // Extract provider from state parameter (format: "provider:randomstate")
        let provider: 'google' | 'facebook' | null = null
        if (state && state.includes(':')) {
          const [stateProvider] = state.split(':')
          if (['google', 'facebook'].includes(stateProvider)) {
            provider = stateProvider as 'google' | 'facebook'
          }
        }

        // Handle OAuth errors from provider
        if (error) {
          let errorMessage = 'Authentication failed'
          if (error === 'access_denied') {
            errorMessage = 'You cancelled the login process. Please try again.'
          } else if (errorDescription) {
            errorMessage = errorDescription
          } else {
            errorMessage = oauthService.handleOAuthError(error)
          }
          setStatus('error')
          setMessage(errorMessage)
          return
        }

        // Validate required parameters
        if (!code || !provider) {
          setStatus('error')
          setMessage('Invalid callback parameters. Please try logging in again.')
          return
        }

        if (!['google', 'facebook'].includes(provider)) {
          setStatus('error')
          setMessage('Unsupported login provider. Please try a different method.')
          return
        }

        // Make the OAuth callback request directly to detect resurrection
        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, code, state }),
        })

        const data = await response.json()

        // Detect canonical resurrection_available
        if (response.status === 409 && data.type === 'resurrection_available') {
          setResurrectionToken(data.resurrectionToken || null)
          setResurrectionProvider(data.provider || provider)
          setResurrectionEmail(data.oauthEmail || null)
          setResurrectionUserInfo(data.oauthUserInfo || null)
          setStatus('resurrection')
          return
        }

        if (!response.ok) {
          let errorMessage = 'OAuth authentication failed. Please try again.'
          if (data.detail) {
            if (typeof data.detail === 'string') {
              errorMessage = data.detail
            } else if (typeof data.detail === 'object' && data.detail.message) {
              errorMessage = data.detail.message
            }
          } else if (data.message) {
            errorMessage = data.message
          }
          setStatus('error')
          setMessage(errorMessage)
          return
        }

        // Success path
        const { normalizeAuthResponse } = await import('@/utils/authNormalization')
        const result = normalizeAuthResponse(data)

        const accessToken = result.accessToken
        if (accessToken) {
          const { login } = await import('@/utils/auth')
          login(accessToken)
          await reloadUser()
        }

        setIsNewUser(result.isNewUser)
        setStatus('success')
        setMessage(
          result.isNewUser
            ? 'Account created successfully! Welcome to Grateful.'
            : 'Login successful! Welcome back.'
        )

        clearRedirect()
        setTimeout(() => {
          router.push(result.isNewUser ? '/welcome' : redirectTo)
        }, 2000)

      } catch (error: any) {
        console.error('OAuth callback error:', error)
        // Check if error contains resurrection data from oauthService
        if (error && error.details && error.details.type === 'resurrection_available') {
          setResurrectionToken(error.details.resurrectionToken || null)
          setResurrectionProvider(error.details.provider || null)
          setStatus('resurrection')
          return
        }
        setStatus('error')
        setMessage(oauthService.handleOAuthError(error))
      }
    }

    handleCallback()
  }, [searchParams, router, reloadUser, clearRedirect, redirectTo])

  const handleResurrect = (action: 'accept' | 'decline') => {
    if (!resurrectionToken) return
    handleResurrectSubmit(action)
  }

  const handleResurrectSubmit = async (action: 'accept' | 'decline') => {
    setIsResurrecting(true)

    try {
      const response = await fetch('/api/auth/oauth-resurrect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resurrection_token: resurrectionToken,
          resurrect_action: action,
          email: resurrectionEmail,
          oauth_user_info: resurrectionUserInfo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        let errorMessage = 'Failed to complete account setup. Please try again.'
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail
          } else if (typeof data.detail === 'object' && data.detail.message) {
            errorMessage = data.detail.message
          } else {
            errorMessage = JSON.stringify(data.detail)
          }
        }
        setStatus('error')
        setMessage(errorMessage)
        setIsResurrecting(false)
        return
      }

      const { normalizeAuthResponse } = await import('@/utils/authNormalization')
      const result = normalizeAuthResponse(data)

      if (result.accessToken) {
        const { login } = await import('@/utils/auth')
        login(result.accessToken)
        await reloadUser()
      }

      setIsNewUser(result.isNewUser)
      setStatus('success')
      setMessage(result.isNewUser ? 'Account created! Welcome to Grateful.' : 'Account restored! Welcome back.')
      setIsResurrecting(false)

      clearRedirect()
      setTimeout(() => {
        router.push('/welcome')
      }, 2000)

    } catch (error) {
      setStatus('error')
      setMessage('Network error. Please check your connection.')
      setIsResurrecting(false)
    }
  }

  const handleResurrectionClose = () => {
    setStatus('error')
    setMessage('Login cancelled.')
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-600" />
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-600" />
      case 'resurrection':
        return null
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-purple-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'resurrection':
        return 'text-purple-600'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <span className="text-3xl">💜</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {status === 'loading' && 'Completing Login...'}
              {status === 'success' && (isNewUser ? 'Welcome to Grateful!' : 'Welcome Back!')}
              {status === 'error' && 'Login Failed'}
              {status === 'resurrection' && 'Account Found'}
            </h1>
          </div>

          {/* Status Icon */}
          {status !== 'resurrection' && (
            <div className="flex justify-center mb-6">
              {getStatusIcon()}
            </div>
          )}

          {/* Status Message */}
          {status !== 'resurrection' && (
            <div className="mb-8">
              <p className={`text-lg ${getStatusColor()}`}>
                {message || 'Processing your login...'}
              </p>

              {status === 'loading' && (
                <p className="text-gray-600 text-sm mt-2">
                  Please wait while we complete your authentication.
                </p>
              )}

              {status === 'success' && (
                <p className="text-gray-600 text-sm mt-2">
                  {isNewUser ? 'You will be redirected to profile setup shortly.' : 'You will be redirected to your feed shortly.'}
                </p>
              )}
            </div>
          )}



          {/* Action Buttons */}
          {status === 'error' && (
            <div className="space-y-4">
              <Link
                href="/auth/login"
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors inline-block"
              >
                Try Again
              </Link>
              <Link
                href="/auth/login"
                className="block text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                ← Back to Login
              </Link>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <Link
                href={isNewUser ? '/welcome' : '/feed'}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors inline-block"
              >
                {isNewUser ? 'Continue to Profile Setup' : 'Continue to Feed'}
              </Link>
            </div>
          )}

          {status === 'loading' && (
            <div className="space-y-4">
              <div className="text-gray-500 text-sm">
                This may take a few moments...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resurrection Dialog */}
      {status === 'resurrection' && (
        <ResurrectionDialog
          isOpen={true}
          identity={resurrectionProvider ? `${resurrectionProvider} account` : 'social account'}
          isLoading={false}
          onRestore={() => handleResurrect('accept')}
          onStartFresh={() => handleResurrect('decline')}
          onClose={handleResurrectionClose}
        />
      )}
    </div>
  )
}
