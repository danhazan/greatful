/**
 * Canonical date filter conversion utilities.
 *
 * All local→UTC conversion flows through getUtcRangeFromLocalDates().
 * No duplicate date boundary logic exists elsewhere.
 */

export type DateFilterPreset =
  | 'today'
  | 'last_3_days'
  | 'last_week'
  | 'last_2_weeks'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'last_year'

export const DATE_FILTER_PRESETS: Array<{ key: DateFilterPreset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'last_3_days', label: 'Last 3 Days' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'last_2_weeks', label: 'Last 2 Weeks' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3_months', label: 'Last 3 Months' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_year', label: 'Past Year' },
]

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/**
 * Convert a Date to YYYY-MM-DD for <input type="date"> value binding.
 */
export function formatDateForInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Convert local YYYY-MM-DD start/end dates to UTC ISO boundaries.
 *
 * Both boundaries are interpreted in local browser timezone.
 * Start: local midnight of startLocal.
 * End:   local midnight of the day AFTER endLocal (exclusive end).
 *
 * Returns UTC ISO strings suitable for the backend API.
 */
export function getUtcRangeFromLocalDates(
  startLocal: string,
  endLocal: string
): { startDate: string; endDate: string } {
  const [sy, sm, sd] = startLocal.split('-').map(Number)
  const [ey, em, ed] = endLocal.split('-').map(Number)

  const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0)
  const end = new Date(ey, em - 1, ed, 0, 0, 0, 0)
  end.setDate(end.getDate() + 1)

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

/**
 * Convert a preset key to local YYYY-MM-DD dates.
 *
 * All calculations use local midnight. No UTC conversion happens here.
 * The result is intended for direct binding to modal inputs and draft state.
 */
export function getPresetDates(
  preset: DateFilterPreset
): { startLocal: string; endLocal: string } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayStr = formatDateForInput(today)

  switch (preset) {
    case 'today':
      return { startLocal: todayStr, endLocal: todayStr }

    case 'last_3_days': {
      const start = new Date(today)
      start.setDate(start.getDate() - 2)
      return { startLocal: formatDateForInput(start), endLocal: todayStr }
    }

    case 'last_week': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { startLocal: formatDateForInput(start), endLocal: todayStr }
    }

    case 'last_2_weeks': {
      const start = new Date(today)
      start.setDate(start.getDate() - 13)
      return { startLocal: formatDateForInput(start), endLocal: todayStr }
    }

    case 'last_month': {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return { startLocal: formatDateForInput(start), endLocal: todayStr }
    }

    case 'last_3_months': {
      const start = new Date(today)
      start.setDate(start.getDate() - 89)
      return { startLocal: formatDateForInput(start), endLocal: todayStr }
    }

    case 'this_year': {
      const start = formatDateForInput(new Date(now.getFullYear(), 0, 1))
      const end = formatDateForInput(new Date(now.getFullYear(), 11, 31))
      return { startLocal: start, endLocal: end }
    }

    case 'last_year': {
      const start = new Date(today)
      start.setFullYear(start.getFullYear() - 1)
      return { startLocal: formatDateForInput(start), endLocal: todayStr }
    }

    default:
      return null
  }
}
