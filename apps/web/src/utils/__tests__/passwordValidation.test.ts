import { describe, it, expect } from '@jest/globals'
import { validatePasswordFormat, validatePasswordConfirmation } from '../passwordValidation'

describe('validatePasswordFormat', () => {
  // Valid cases — frontend min 8, max 128 matches backend validate_field_length
  it('accepts minimum valid length (8)', () => {
    const r = validatePasswordFormat('12345678')
    expect(r.valid).toBe(true)
    expect(r.message).toBeNull()
  })

  it('accepts maximum valid length (128)', () => {
    const r = validatePasswordFormat('a'.repeat(128))
    expect(r.valid).toBe(true)
    expect(r.message).toBeNull()
  })

  it('accepts typical strong password', () => {
    expect(validatePasswordFormat('SecureP@ss1').valid).toBe(true)
  })

  // Invalid cases
  it('rejects too short (< 8)', () => {
    const r = validatePasswordFormat('1234567')
    expect(r.valid).toBe(false)
    expect(r.message).toMatch('at least 8')
  })

  it('rejects empty string', () => {
    const r = validatePasswordFormat('')
    expect(r.valid).toBe(false)
    expect(r.message).toMatch('at least 8')
  })

  it('rejects too long (> 128)', () => {
    const r = validatePasswordFormat('a'.repeat(129))
    expect(r.valid).toBe(false)
    expect(r.message).toMatch('at most 128')
  })
})

describe('validatePasswordConfirmation', () => {
  it('returns null when passwords match', () => {
    expect(validatePasswordConfirmation('password123', 'password123')).toBeNull()
  })

  it('returns message when passwords do not match', () => {
    const result = validatePasswordConfirmation('password123', 'different')
    expect(result).toBe('Passwords do not match')
  })

  it('returns message when confirmation is empty', () => {
    expect(validatePasswordConfirmation('password123', '')).toBe('Passwords do not match')
  })
})
