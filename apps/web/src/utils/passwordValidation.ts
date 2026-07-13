/**
 * Shared frontend password validation — mirrors backend
 * BaseService.validate_field_length(password, "password", 128, 8).
 *
 * This is the canonical frontend implementation. Backend is the security
 * boundary; frontend validation is purely an immediate UX improvement.
 */

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

export interface PasswordValidationResult {
  valid: boolean
  message: string | null
}

/** Validates password length against backend policy (min 8, max 128). */
export function validatePasswordFormat(password: string): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` }
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters long` }
  }
  return { valid: true, message: null }
}

/** Validates password and confirmation match. Returns null when they match. */
export function validatePasswordConfirmation(password: string, confirmPassword: string): string | null {
  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }
  return null
}
