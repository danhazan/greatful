'use client'

import { useState, useEffect } from 'react'
import { resolveLocale } from '@/utils/locale'

let cached: string | undefined

export function useLocale(): string {
  const [locale, setLocale] = useState<string>(() => {
    if (cached) return cached
    if (typeof navigator === 'undefined') return 'en-US'
    cached = resolveLocale()
    return cached
  })

  useEffect(() => {
    if (!cached) {
      cached = resolveLocale()
    }
    setLocale(cached)
  }, [])

  return locale
}
