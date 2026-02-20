/**
 * Image utility functions
 */

// Get the API base URL from environment variables
const getApiBaseUrl = (): string => {
  return process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'
}

/**
 * Convert relative image URL to absolute URL
 */
export function getImageUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) return null

  // If it's already an absolute URL, return as is
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl
  }

  // If it's a relative URL, prepend the backend base URL
  return `${getApiBaseUrl()}${relativeUrl}`
}