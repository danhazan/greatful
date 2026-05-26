'use client'

import { useLocaleContext } from '@/contexts/LocaleContext'

export function useLocale(): string {
  const { locale } = useLocaleContext()
  return locale
}

export function useLocaleWithUpdate(): { locale: string; updatePreference: (locale: string | null) => void } {
  const { locale, updatePreference } = useLocaleContext()
  return { locale, updatePreference }
}
