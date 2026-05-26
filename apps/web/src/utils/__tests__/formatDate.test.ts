import { formatDate } from '../formatDate'

describe('formatDate', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('relative mode', () => {
    it('shows Just now for less than 1 minute', () => {
      const date = new Date('2024-01-15T11:59:30Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('Just now')
    })

    it('shows minutes ago', () => {
      const date = new Date('2024-01-15T11:55:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('5m ago')
    })

    it('shows hours ago', () => {
      const date = new Date('2024-01-15T09:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('3h ago')
    })

    it('shows days ago', () => {
      const date = new Date('2024-01-12T12:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('3d ago')
    })

    it('shows weeks ago', () => {
      const date = new Date('2024-01-01T12:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('2w ago')
    })

    it('shows months ago for 60+ days', () => {
      const date = new Date('2023-11-16T12:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('2mo ago')
    })

    it('shows years ago', () => {
      const date = new Date('2022-01-15T12:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('2y ago')
    })

    it('handles exactly 1 minute', () => {
      const date = new Date('2024-01-15T11:59:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('1m ago')
    })

    it('handles exactly 1 hour', () => {
      const date = new Date('2024-01-15T11:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('1h ago')
    })

    it('handles exactly 1 day', () => {
      const date = new Date('2024-01-14T12:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('1d ago')
    })

    it('handles exactly 1 week', () => {
      const date = new Date('2024-01-08T12:00:00Z').toISOString()
      expect(formatDate(date, { mode: 'relative' })).toBe('1w ago')
    })
  })

  describe('adaptive mode', () => {
    it('shows relative time under 24 hours', () => {
      const date = new Date('2024-01-15T10:00:00Z').toISOString()
      expect(formatDate(date)).toBe('2h ago')
    })

    it('shows calendar date after 24 hours', () => {
      const date = new Date('2024-01-13T12:00:00Z').toISOString()
      const result = formatDate(date)
      expect(result).not.toContain('ago')
      expect(result).not.toBe('Just now')
    })

    it('shows locale-aware calendar date after 24 hours', () => {
      const date = new Date('2024-01-13T12:00:00Z').toISOString()
      const us = formatDate(date, { locale: 'en-US' })
      const fr = formatDate(date, { locale: 'fr-FR' })
      expect(us).toMatch(/1\/13/)
      expect(fr).toBe('13/01/2024')
    })

    it('uses the now parameter for relative computation', () => {
      const date = new Date('2024-01-15T11:55:00Z').toISOString()
      const laterNow = new Date('2024-01-15T12:05:00Z')
      expect(formatDate(date, { now: laterNow })).toBe('10m ago')
    })

    it('uses Just now for same timestamp', () => {
      const date = new Date('2024-01-15T12:00:00Z').toISOString()
      expect(formatDate(date)).toBe('Just now')
    })

    it('shows future dates as Just now', () => {
      const future = new Date('2024-01-16T12:00:00Z').toISOString()
      expect(formatDate(future)).toBe('Just now')
    })
  })

  describe('calendar mode', () => {
    it('formats date in US locale (MM/DD/YYYY)', () => {
      const date = '2024-01-15T12:00:00Z'
      const result = formatDate(date, { mode: 'calendar', locale: 'en-US' })
      expect(result).toMatch(/1\/15\/2024|1\/15\/24/)
    })

    it('formats date in French locale (DD/MM/YYYY)', () => {
      const date = '2024-01-15T12:00:00Z'
      const result = formatDate(date, { mode: 'calendar', locale: 'fr-FR' })
      expect(result).toBe('15/01/2024')
    })
  })

  describe('monthYear mode', () => {
    it('formats in English', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'en-US' })
      expect(result).toBe('September 2024')
    })

    it('formats in French with capitalized month', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'fr-FR' })
      expect(result).toBe('Septembre 2024')
    })

    it('formats different months correctly', () => {
      const date = '2025-03-01T00:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'en-US' })
      expect(result).toBe('March 2025')
    })

    it('formats profile Joined date format', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'en-US' })
      expect(result).toMatch(/^[A-Z][a-z]+ 2024$/)
    })

    it('capitalizes German month name', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'de-DE' })
      expect(result).toBe('September 2024')
    })

    it('capitalizes Swedish month name', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'sv-SE' })
      expect(result).toBe('September 2024')
    })

    it('capitalizes Italian month name', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'it-IT' })
      expect(result).toBe('Settembre 2024')
    })

    it('does not affect calendar mode locale format', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'calendar', locale: 'fr-FR' })
      expect(result).toBe('15/09/2024')
    })

    it('preserves year in monthYear output', () => {
      const date = '2024-09-15T12:00:00Z'
      const result = formatDate(date, { mode: 'monthYear', locale: 'en-US' })
      expect(result).toContain('2024')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for null date', () => {
      expect(formatDate(null)).toBe('')
    })

    it('returns empty string for undefined date', () => {
      expect(formatDate(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(formatDate('')).toBe('')
    })

    it('handles invalid date string gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      expect(formatDate('not-a-date')).toBe('')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('defaults to adaptive mode', () => {
      const date = new Date('2024-01-15T10:00:00Z').toISOString()
      expect(formatDate(date)).toBe('2h ago')
    })

    it('uses runtime default locale when no locale available', () => {
      const { navigator } = globalThis
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        configurable: true
      })
      const date = '2024-01-15T12:00:00Z'
      const result = formatDate(date, { mode: 'calendar' })
      expect(result).toBeTruthy()
      Object.defineProperty(globalThis, 'navigator', {
        value: navigator,
        configurable: true
      })
    })
  })
})
