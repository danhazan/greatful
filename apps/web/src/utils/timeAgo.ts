import { formatDate } from './formatDate'

export function formatTimeAgo(dateString: string): string {
  return formatDate(dateString, { mode: 'relative' })
}
