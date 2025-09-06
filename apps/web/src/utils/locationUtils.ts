/**
 * Utility functions for location handling
 */

/**
 * Truncate location display name to a reasonable length
 * @param displayName - The full location display name
 * @param maxLength - Maximum length (default: 150)
 * @returns Truncated display name with ellipsis if needed
 */
export function truncateLocationName(displayName: string, maxLength: number = 150): string {
  if (!displayName || displayName.length <= maxLength) {
    return displayName
  }
  
  return displayName.substring(0, maxLength - 3) + '...'
}

/**
 * Create a short location summary from address components
 * @param address - Address object from location data
 * @returns Short location string (e.g., "City, Country")
 */
export function createShortLocationSummary(address: {
  city?: string
  state?: string
  country?: string
  country_code?: string
}): string {
  const parts = [
    address.city,
    address.state,
    address.country
  ].filter(Boolean)
  
  return parts.slice(0, 2).join(', ')
}

/**
 * Validate location display name length
 * @param displayName - Location display name to validate
 * @param maxLength - Maximum allowed length (default: 150)
 * @returns True if valid, false if too long
 */
export function isValidLocationLength(displayName: string, maxLength: number = 150): boolean {
  return !displayName || displayName.length <= maxLength
}