'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export const LOGIN_REDIRECT_STORAGE_KEY = 'post_login_redirect'
export const AUTH_LOGOUT_KEY = 'auth_logout_flag'
export const DEFAULT_POST_LOGIN_REDIRECT = '/feed'

function isSafeRedirect(path: string | null): path is string {
  if (!path) return false
  if (typeof path !== 'string') return false
  if (path.length === 0) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  return true
}

export function buildLoginRedirectUrl(returnTo: string): string {
  const encoded = encodeURIComponent(returnTo)
  return `/auth/login?redirect=${encoded}`
}

export function useRequireAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useCallback(() => {
    if (pathname.startsWith('/auth/')) return

    try {
      if (sessionStorage.getItem(AUTH_LOGOUT_KEY)) {
        sessionStorage.removeItem(AUTH_LOGOUT_KEY)
        return
      }
    } catch {}

    const currentQuery = searchParams.toString()
    const fullPath = currentQuery ? `${pathname}?${currentQuery}` : pathname

    try {
      sessionStorage.setItem(LOGIN_REDIRECT_STORAGE_KEY, fullPath)
    } catch {}

    router.replace(buildLoginRedirectUrl(fullPath))
  }, [router, pathname, searchParams])
}

export function usePostLoginRedirect(
  defaultPath = DEFAULT_POST_LOGIN_REDIRECT
): { redirectTo: string; clearRedirect: () => void } {
  const searchParams = useSearchParams()

  const redirectTo = useMemo(() => {
    const param = searchParams.get('redirect')
    if (isSafeRedirect(param)) return param

    try {
      const stored = sessionStorage.getItem(LOGIN_REDIRECT_STORAGE_KEY)
      if (isSafeRedirect(stored)) return stored
    } catch {}

    return defaultPath
  }, [searchParams, defaultPath])

  const clearRedirect = useCallback(() => {
    try {
      sessionStorage.removeItem(LOGIN_REDIRECT_STORAGE_KEY)
    } catch {}
  }, [])

  return { redirectTo, clearRedirect }
}
