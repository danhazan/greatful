import { extractErrorMessage } from '../extract-api-error'

describe('extractErrorMessage', () => {
  it('returns fallback for null/undefined input', () => {
    expect(extractErrorMessage(null, 'default')).toBe('default')
    expect(extractErrorMessage(undefined, 'default')).toBe('default')
  })

  it('returns fallback for non-object input', () => {
    expect(extractErrorMessage('just a string', 'fallback')).toBe('fallback')
    expect(extractErrorMessage(42, 'fallback')).toBe('fallback')
  })

  it('extracts string detail', () => {
    const result = extractErrorMessage({ detail: 'Email already registered' }, 'fallback')
    expect(result).toBe('Email already registered')
  })

  it('extracts Pydantic array detail', () => {
    const result = extractErrorMessage({
      detail: [
        { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' }
      ]
    }, 'fallback')
    expect(result).toBe('value is not a valid email address')
  })

  it('joins multiple Pydantic errors', () => {
    const result = extractErrorMessage({
      detail: [
        { loc: ['body', 'email'], msg: 'Invalid email', type: 'value_error' },
        { loc: ['body', 'password'], msg: 'Password too short', type: 'value_error' },
      ]
    }, 'fallback')
    expect(result).toBe('Invalid email, Password too short')
  })

  it('handles array of strings in detail', () => {
    const result = extractErrorMessage({
      detail: ['First error', 'Second error']
    }, 'fallback')
    expect(result).toBe('First error, Second error')
  })

  it('extracts message field', () => {
    const result = extractErrorMessage({ message: 'Something went wrong' }, 'fallback')
    expect(result).toBe('Something went wrong')
  })

  it('extracts error field', () => {
    const result = extractErrorMessage({ error: 'Bad request' }, 'fallback')
    expect(result).toBe('Bad request')
  })

  it('detail takes priority over message', () => {
    const result = extractErrorMessage({ detail: 'Detail error', message: 'Message error' }, 'fallback')
    expect(result).toBe('Detail error')
  })

  it('returns fallback when no known field exists', () => {
    const result = extractErrorMessage({ unknown: 'field' }, 'my fallback')
    expect(result).toBe('my fallback')
  })

  it('handles object detail with message property', () => {
    const result = extractErrorMessage({
      detail: { message: 'Nested error object' }
    }, 'fallback')
    expect(result).toBe('Nested error object')
  })
})
