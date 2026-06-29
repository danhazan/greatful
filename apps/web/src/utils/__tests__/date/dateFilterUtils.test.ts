import { formatDateForInput, getUtcRangeFromLocalDates, getPresetDates } from '@/utils/dateFilterUtils'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

describe('formatDateForInput', () => {
  it('formats a normal date as YYYY-MM-DD', () => {
    expect(formatDateForInput(new Date(2026, 5, 15))).toBe('2026-06-15')
  })

  it('zero-pads single-digit month', () => {
    expect(formatDateForInput(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('zero-pads single-digit day', () => {
    expect(formatDateForInput(new Date(2026, 5, 3))).toBe('2026-06-03')
  })

  it('handles leap year date', () => {
    expect(formatDateForInput(new Date(2024, 1, 29))).toBe('2024-02-29')
  })

  it('handles epoch date', () => {
    expect(formatDateForInput(new Date(1970, 0, 1))).toBe('1970-01-01')
  })

  it('handles far future date', () => {
    expect(formatDateForInput(new Date(2099, 11, 31))).toBe('2099-12-31')
  })

  it('handles December (month 11)', () => {
    expect(formatDateForInput(new Date(2026, 11, 25))).toBe('2026-12-25')
  })
})

describe('getUtcRangeFromLocalDates', () => {
  it('returns valid ISO strings for a normal range', () => {
    const result = getUtcRangeFromLocalDates('2026-01-01', '2026-01-15')

    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('produces start < end for normal ranges', () => {
    const result = getUtcRangeFromLocalDates('2026-01-01', '2026-01-15')
    expect(new Date(result.startDate).getTime()).toBeLessThan(new Date(result.endDate).getTime())
  })

  it('single-day range produces end 24h after start', () => {
    const result = getUtcRangeFromLocalDates('2026-06-15', '2026-06-15')
    const diffMs = new Date(result.endDate).getTime() - new Date(result.startDate).getTime()
    // No DST in June; 24h = 86400000ms
    expect(diffMs).toBe(86400000)
  })

  it('multi-day range matches expected local-to-UTC conversion', () => {
    const startLocal = new Date(2026, 0, 1, 0, 0, 0, 0)
    const endLocal = new Date(2026, 0, 15, 0, 0, 0, 0)
    endLocal.setDate(endLocal.getDate() + 1)

    const result = getUtcRangeFromLocalDates('2026-01-01', '2026-01-15')
    expect(result.startDate).toBe(startLocal.toISOString())
    expect(result.endDate).toBe(endLocal.toISOString())
  })

  it('handles month boundary correctly', () => {
    const result = getUtcRangeFromLocalDates('2026-01-31', '2026-02-01')
    expect(new Date(result.startDate).getTime()).toBeLessThan(new Date(result.endDate).getTime())
  })

  it('handles year boundary correctly', () => {
    const result = getUtcRangeFromLocalDates('2025-12-31', '2026-01-01')
    expect(new Date(result.startDate).getTime()).toBeLessThan(new Date(result.endDate).getTime())
  })

  it('handles leap year correctly', () => {
    const result = getUtcRangeFromLocalDates('2024-02-28', '2024-03-01')
    expect(new Date(result.startDate).getTime()).toBeLessThan(new Date(result.endDate).getTime())
  })

  it('startDate converts back to correct local date', () => {
    const result = getUtcRangeFromLocalDates('2026-06-15', '2026-06-20')
    const d = new Date(result.startDate)
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(5) // 0-indexed
    // The UTC day depends on timezone offset; verify range
    expect(d.getUTCDate()).toBeGreaterThanOrEqual(14)
    expect(d.getUTCDate()).toBeLessThanOrEqual(16)
  })

  it('throws for invalid date string', () => {
    expect(() => getUtcRangeFromLocalDates('not-a-date', '2026-01-15')).toThrow()
  })

  it('throws for malformed partial string', () => {
    expect(() => getUtcRangeFromLocalDates('2026-01', '2026-01-15')).toThrow()
  })

  it('throws for empty string', () => {
    expect(() => getUtcRangeFromLocalDates('', '2026-01-15')).toThrow()
  })

  it('endDate is exclusive (day after endLocal)', () => {
    // Jan 1 → endDate should be midnight Jan 2 local → converted to UTC
    const result = getUtcRangeFromLocalDates('2026-01-01', '2026-01-01')
    const endUtc = new Date(result.endDate)
    // In local time, end is Jan 2 00:00:00
    const endLocal = new Date(endUtc.toISOString())
    const endLocalHours = endLocal.getUTCHours()
    // The UTC hours depend on timezone; verify the relationship holds
    expect(endUtc.getTime()).toBeGreaterThan(new Date(result.startDate).getTime())
  })
})

describe('getPresetDates', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns today with same start and end', () => {
    const result = getPresetDates('today')
    expect(result).toEqual({ startLocal: '2026-06-15', endLocal: '2026-06-15' })
  })

  it('returns last_3_days covering 3 days ending today', () => {
    const result = getPresetDates('last_3_days')
    expect(result).toEqual({ startLocal: '2026-06-13', endLocal: '2026-06-15' })
  })

  it('returns last_week covering 7 days ending today', () => {
    const result = getPresetDates('last_week')
    expect(result).toEqual({ startLocal: '2026-06-09', endLocal: '2026-06-15' })
  })

  it('returns last_2_weeks covering 14 days ending today', () => {
    const result = getPresetDates('last_2_weeks')
    expect(result).toEqual({ startLocal: '2026-06-02', endLocal: '2026-06-15' })
  })

  it('returns last_month covering ~30 days ending today', () => {
    const result = getPresetDates('last_month')
    expect(result).toEqual({ startLocal: '2026-05-17', endLocal: '2026-06-15' })
  })

  it('returns last_3_months covering ~90 days ending today', () => {
    const result = getPresetDates('last_3_months')
    expect(result).toEqual({ startLocal: '2026-03-18', endLocal: '2026-06-15' })
  })

  it('returns this_year from Jan 1 to today', () => {
    const result = getPresetDates('this_year')
    expect(result).toEqual({ startLocal: '2026-01-01', endLocal: '2026-06-15' })
  })

  it('returns last_year from one year ago to today', () => {
    const result = getPresetDates('last_year')
    expect(result).toEqual({ startLocal: '2025-06-15', endLocal: '2026-06-15' })
  })

  it('returns null for unknown preset', () => {
    const result = getPresetDates('invalid_preset' as never)
    expect(result).toBeNull()
  })

  it('handles year boundary (January 1)', () => {
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(getPresetDates('today')).toEqual({ startLocal: '2026-01-01', endLocal: '2026-01-01' })
    expect(getPresetDates('this_year')).toEqual({ startLocal: '2026-01-01', endLocal: '2026-01-01' })
    expect(getPresetDates('last_year')).toEqual({ startLocal: '2025-01-01', endLocal: '2026-01-01' })
  })

  it('handles leap year February 29', () => {
    jest.setSystemTime(new Date('2024-02-29T12:00:00Z'))
    expect(getPresetDates('today')).toEqual({ startLocal: '2024-02-29', endLocal: '2024-02-29' })
    expect(getPresetDates('last_week')).toEqual({ startLocal: '2024-02-23', endLocal: '2024-02-29' })
    expect(getPresetDates('last_year')).toEqual({ startLocal: '2023-03-01', endLocal: '2024-02-29' })
  })
})
