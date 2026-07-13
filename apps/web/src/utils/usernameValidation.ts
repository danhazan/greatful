/**
 * Shared username validation utility.
 *
 * This is the canonical frontend implementation — matches backend
 * validate_username_format() in app/core/validators.py exactly.
 *
 * For mention/navigation parsing, see mentionUtils.ts and idGuards.ts
 * (intentionally broader charset — different problem domain).
 */

const USERNAME_REGEX = /^[a-z0-9_]+$/

export interface UsernameValidationResult {
  valid: boolean
  message: string | null
}

export function normalizeUsername(username: string): string {
  return username.toLowerCase()
}

/** Validates username: normalizes internally (lowercases), checks length (3–30) and charset. */
export function validateUsernameFormat(username: string): UsernameValidationResult {
  if (username.length < 3 || username.length > 30) {
    return { valid: false, message: 'Username must be between 3 and 30 characters.' }
  }
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers, and underscores.' }
  }
  return { valid: true, message: null }
}
