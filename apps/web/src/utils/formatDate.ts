import { resolveLocale } from './locale'

export type DateMode = 'relative' | 'adaptive' | 'calendar' | 'monthYear'

export interface FormatDateOptions {
  mode?: DateMode
  now?: Date
  locale?: string
}

function formatCalendarDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

function capitalizeFirstLetter(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatMonthYear(date: Date, locale: string): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
  }).format(date)
  return capitalizeFirstLetter(formatted)
}

export function formatDate(
  dateString: string | undefined | null,
  options?: FormatDateOptions
): string {
  const { mode = 'adaptive', now: nowOption, locale: localeOption } = options ?? {}

  const locale = localeOption ?? resolveLocale()

  if (!dateString) return ''

  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    console.warn('Invalid date string:', dateString)
    return ''
  }

  if (mode === 'calendar') {
    return formatCalendarDate(date, locale)
  }

  if (mode === 'monthYear') {
    return formatMonthYear(date, locale)
  }

  const now = nowOption ?? new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return 'Just now'

  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) return 'Just now'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  if (mode === 'adaptive') {
    return formatCalendarDate(date, locale)
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}w ago`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`

  const diffYears = Math.floor(diffDays / 365)
  return `${diffYears}y ago`
}
