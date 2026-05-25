export function resolveLocale(): string {
  if (typeof navigator === 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
  }

  const languages = navigator.languages || [navigator.language || 'en-US']

  if (languages.length === 0) return 'en-US'

  const testDate = new Date(2000, 0, 15)

  for (const lang of languages) {
    try {
      const loc = new Intl.Locale(lang)
      if (loc.language !== 'en') return lang
    } catch {
      continue
    }
  }

  for (const lang of languages) {
    try {
      const parts = new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(testDate)
      const dayIdx = parts.findIndex((p) => p.type === 'day')
      const monthIdx = parts.findIndex((p) => p.type === 'month')
      if (dayIdx >= 0 && monthIdx >= 0 && dayIdx < monthIdx) return lang
    } catch {
      continue
    }
  }

  return languages[0]
}
