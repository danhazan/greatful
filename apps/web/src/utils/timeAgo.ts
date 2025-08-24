/**
 * Format a date as time ago (e.g., "2m", "1h", "3d", "5w", "7m", "1y")
 */
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 52) {
    return `${diffInWeeks}w`
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears}y`
}