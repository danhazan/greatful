"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'

/**
 * /social-session — native-session bootstrap entry (SW2-P2).
 *
 * The native app navigates the Social WebView to
 *   /social-session#bootstrap=<opaque-token>
 *
 * The fragment token is read once, immediately stripped from browser history
 * via history.replaceState, exchanged server-side through /api/auth/social-session
 * (which forwards to the backend consume endpoint and sets the auth cookies),
 * and the session is established through the existing mechanisms (login +
 * reloadUser). The bootstrap token is never placed in localStorage, cookies,
 * analytics, query strings, logs, or navigation state.
 */
export default function SocialSessionPage() {
  const router = useRouter()
  const { reloadUser } = useUser()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const establishSession = async () => {
      try {
        const rawHash = window.location.hash
        if (!rawHash) {
          setStatus('error')
          setMessage('Session linking is unavailable. Please close and try again.')
          return
        }

        // 1. Read the fragment and strip it from browser history immediately
        //    so a back-navigation or history dump never resurfaces the token.
        const params = new URLSearchParams(rawHash.slice(1))
        const bootstrapToken = params.get('bootstrap')
        window.history.replaceState(null, '', window.location.pathname + window.location.search)

        if (!bootstrapToken) {
          setStatus('error')
          setMessage('Session linking is unavailable. Please close and try again.')
          return
        }

        // 2. Exchange the token server-side (sets httpOnly auth cookies).
        const response = await fetch('/api/auth/social-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bootstrap_token: bootstrapToken }),
        })

        if (!response.ok) {
          setStatus('error')
          setMessage('Session linking failed. Please try again from the app.')
          return
        }

        const data = await response.json()

        // 3. Establish the session through the existing auth machinery.
        const { normalizeAuthResponse } = await import('@/utils/authNormalization')
        const result = normalizeAuthResponse(data)
        const accessToken = result.accessToken

        if (!accessToken) {
          setStatus('error')
          setMessage('Session linking failed. Please try again from the app.')
          return
        }

        const { login } = await import('@/utils/auth')
        login(accessToken)

        // 4. Reload the current user (emits SESSION_STATE=authenticated +
        //    SESSION_IDENTITY through the WebView bridge on success).
        await reloadUser()

        setStatus('success')
        setMessage('Social session linked.')
        // 5. Redirect to the standard post-auth destination. The bootstrap
        //    consume always returns is_new_user=false (the account already
        //    exists in the native session), so /feed is the correct target.
        router.replace('/feed')
      } catch (error) {
        console.error('[social-session] establishment error', error)
        setStatus('error')
        setMessage('Session linking failed. Please try again from the app.')
      }
    }

    establishSession()
  }, [router, reloadUser])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            {status === 'loading' && <Loader2 className="w-8 h-8 animate-spin text-purple-600" />}
            {status === 'success' && <CheckCircle className="w-8 h-8 text-green-600" />}
            {status === 'error' && <AlertCircle className="w-8 h-8 text-red-600" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'loading' && 'Linking Social...'}
            {status === 'success' && 'Linked!'}
            {status === 'error' && 'Link Failed'}
          </h1>
          <p className={`text-gray-600 ${status === 'error' ? 'text-red-600' : ''}`}>
            {message || 'Please wait while we link your Social session.'}
          </p>
        </div>
      </div>
    </div>
  )
}