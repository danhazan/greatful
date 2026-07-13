import { describe, it, expect } from '@jest/globals'
import { normalizeUsername, validateUsernameFormat } from '../usernameValidation'

describe('normalizeUsername', () => {
  it('lowercases uppercase characters', () => {
    expect(normalizeUsername('JohnDoe')).toBe('johndoe')
  })

  it('preserves already-lowercase', () => {
    expect(normalizeUsername('test_user')).toBe('test_user')
  })

  it('handles mixed case with numbers and underscores', () => {
    expect(normalizeUsername('Test_User_123')).toBe('test_user_123')
  })
})

describe('validateUsernameFormat — matches backend validate_username_format', () => {
  // Valid cases — must pass backend too
  it('accepts valid username', () => {
    const r = validateUsernameFormat('test_user')
    expect(r.valid).toBe(true)
    expect(r.message).toBeNull()
  })

  it('accepts min length (3)', () => {
    expect(validateUsernameFormat('abc').valid).toBe(true)
  })

  it('accepts max length (30)', () => {
    expect(validateUsernameFormat('a'.repeat(30)).valid).toBe(true)
  })

  it('accepts lowercase letters, numbers, underscores', () => {
    expect(validateUsernameFormat('__hello__123').valid).toBe(true)
  })

  // Invalid cases — must reject same as backend
  it('rejects too short (< 3)', () => {
    const r = validateUsernameFormat('ab')
    expect(r.valid).toBe(false)
    expect(r.message).toMatch('3 and 30')
  })

  it('rejects too long (> 30)', () => {
    const r = validateUsernameFormat('a'.repeat(31))
    expect(r.valid).toBe(false)
    expect(r.message).toMatch('3 and 30')
  })

  it('rejects empty string', () => {
    expect(validateUsernameFormat('').valid).toBe(false)
  })

  it('rejects special characters', () => {
    expect(validateUsernameFormat('user-name!').valid).toBe(false)
  })

  it('rejects spaces', () => {
    expect(validateUsernameFormat('user name').valid).toBe(false)
  })

  it('rejects dots', () => {
    expect(validateUsernameFormat('user.name').valid).toBe(false)
  })
})
