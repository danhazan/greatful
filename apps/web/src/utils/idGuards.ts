/**
 * ID validation utilities for profile navigation
 */

/**
 * Check if a value is a valid profile ID (numeric or UUID)
 * @param id - The ID to validate
 * @returns true if the ID is valid for profile navigation
 */
export function validProfileId(id: string | number | undefined | null): boolean {
  if (id === undefined || id === null || id === '') {
    return false
  }

  const idStr = String(id).trim()
  
  // Check for empty string after trimming
  if (idStr === '') {
    return false
  }

  // Check for numeric ID (positive integer)
  if (/^\d+$/.test(idStr)) {
    const num = parseInt(idStr, 10)
    return num > 0 && num <= Number.MAX_SAFE_INTEGER
  }

  // Check for UUID format (8-4-4-4-12 hex digits)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuidRegex.test(idStr)) {
    return true
  }

  // Not a valid ID format
  return false
}

/**
 * Check if a value looks like a username (not a valid ID)
 * @param value - The value to check
 * @returns true if the value looks like a username
 */
export function looksLikeUsername(value: string | number | undefined | null): boolean {
  if (value === undefined || value === null) {
    return false
  }

  const valueStr = String(value).trim()
  
  // Empty string is not a username
  if (valueStr === '') {
    return false
  }

  // If it's a valid profile ID, it's not a username
  if (validProfileId(valueStr)) {
    return false
  }

  // Check if it looks like a username (alphanumeric with underscores, hyphens)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/
  return usernameRegex.test(valueStr) && valueStr.length >= 1 && valueStr.length <= 50
}

/**
 * Normalize an ID to a string format suitable for URLs
 * @param id - The ID to normalize
 * @returns normalized ID string or null if invalid
 */
export function normalizeProfileId(id: string | number | undefined | null): string | null {
  if (!validProfileId(id)) {
    return null
  }

  return String(id).trim()
}

/**
 * Type guard to check if a value is a valid profile ID
 * @param id - The ID to check
 * @returns type predicate indicating if the ID is valid
 */
export function isValidProfileId(id: any): id is string | number {
  return validProfileId(id)
}