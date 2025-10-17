"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import oauthService from '@/services/oauthService'
import { useUser } from '@/contexts/UserContext'

export default function OAuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { reloadUser } = useUser()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)

  useEffect(() => {
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



        // Handle real OAuth callback
        console.log('Calling oauth callback:', { provider, code, state })
        const result = await oauthService.handleCallback(provider, code, state || undefined)
        console.log('OAuth callback result', result)

        // Get tokens from the response
        const tokens = result.tokens
        console.log('resolved tokens', tokens)
        
        // Store access token using centralized auth utility
        if (tokens?.access_token) {
          // Use the centralized login function to store token
          const { login } = await import('@/utils/auth')
          login(tokens.access_token)
          
          // Trigger UserContext to reload user data
          await reloadUser()
          
          // optional: save refresh token too
          if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token)
          console.log('Stored access_token via auth utility and reloaded user context, length:', tokens.access_token.length)
        } else {
          console.warn('No access_token in callback response; full result:', result)
        }

        setIsNewUser(result.is_new_user)
        setStatus('success')
        setMessage(
          result.is_new_user 
            ? 'Account created successfully! Welcome to Grateful.' 
            : 'Login successful! Welcome back.'
        )

        // Redirect to feed after a short delay
        setTimeout(() => {
          router.push('/feed')
        }, 2000)

      } catch (error: any) {
        console.error('OAuth callback error:', error)
        setStatus('error')
        setMessage(oauthService.handleOAuthError(error))
      }
    }

    handleCallback()
  }, [searchParams, router])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-600" />
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-600" />
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
            </h1>
          </div>

          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>

          {/* Status Message */}
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
                You will be redirected to your feed shortly.
              </p>
            )}
          </div>

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
                href="/feed"
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors inline-block"
              >
                Continue to Feed
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
    </div>
  )
}