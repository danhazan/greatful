'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { resolveLocaleFromCountry, resolveLocaleFromBrowser } from '@/utils/locale'
import { getUserPreferencesKey } from '@/utils/localStorage'
import { useUser } from './UserContext'

interface LocaleContextValue {
  locale: string
  updatePreference: (locale: string | null) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function resolveInitialLocale(initialCountry?: string): string {
  const geoLocale = resolveLocaleFromCountry(initialCountry)
  if (geoLocale) return geoLocale
  if (typeof navigator === 'undefined') return 'en-US'
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
  } catch {
    return 'en-US'
  }
}

export function LocaleProvider({
  children,
  initialCountry,
}: {
  children: ReactNode
  initialCountry?: string
}) {
  const { currentUser } = useUser()
  const currentUserId = currentUser?.id ?? null

  const [locale, setLocale] = useState<string>(() => resolveInitialLocale(initialCountry))

  useEffect(() => {
    if (currentUserId) {
      const userPref = loadUserPreference(currentUserId)
      if (userPref) {
        setLocale(userPref)
        return
      }
    }

    if (!initialCountry) {
      const browserLocale = resolveLocaleFromBrowser()
      setLocale(browserLocale)
    }
  }, [currentUserId, initialCountry])

  const updatePreference = useCallback((prefLocale: string | null) => {
    if (prefLocale) {
      setLocale(prefLocale)
    } else {
      const geoLocale = resolveLocaleFromCountry(initialCountry)
      if (geoLocale) {
        setLocale(geoLocale)
      } else {
        setLocale(resolveLocaleFromBrowser())
      }
    }
  }, [initialCountry])

  return (
    <LocaleContext.Provider value={{ locale, updatePreference }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocaleContext must be used within a LocaleProvider')
  }
  return ctx
}

function loadUserPreference(userId: string): string | null {
  try {
    const prefsKey = getUserPreferencesKey(userId)
    const stored = localStorage.getItem(prefsKey)
    if (stored) {
      const prefs = JSON.parse(stored)
      return prefs.regionalDateFormat || null
    }
  } catch {}
  return null
}
