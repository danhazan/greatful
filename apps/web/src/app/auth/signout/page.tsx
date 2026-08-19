"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'

/**
 * /auth/signout — web session clearing for the native Social WebView (SW2-P2).
 *
 * Reuses the existing logout implementation exclusively: the access token is
 * cleared from localStorage and the httpOnly refresh/signup cookies are
 * cleared through the existing /api/auth/logout proxy. The UserContext state
 * transition then emits SESSION_STATE=anonymous through the WebView bridge —
 * only once anonymous is confirmed may the native app perform a subsequent
 * identity bootstrap.
 */
export default function SignOutPage() {
  const router = useRouter()
  const { logout } = useUser()
  const [status, setStatus] = useState<'signing-out' | 'done'>('signing-out')
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    // The existing logout implementation clears localStorage credentials and
    // best-effort clears the httpOnly cookies via /api/auth/logout.
    logout()

    setStatus('done')
    router.replace('/auth/login')
  }, [logout, router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            {status === 'signing-out' ? (
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'signing-out' ? 'Signing out...' : 'Signed out'}
          </h1>
          <p className="text-gray-600">
            {status === 'signing-out'
              ? 'Clearing your Social session.'
              : 'Your Social session has been cleared.'}
          </p>
        </div>
      </div>
    </div>
  )
}