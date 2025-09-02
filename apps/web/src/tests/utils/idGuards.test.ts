/**
 * Tests for ID validation utilities
 */

import { validProfileId, looksLikeUsername, normalizeProfileId, isValidProfileId } from '@/utils/idGuards'

describe('idGuards', () => {
  describe('validProfileId', () => {
    it('should accept numeric IDs', () => {
      expect(validProfileId('123')).toBe(true)
      expect(validProfileId(123)).toBe(true)
      expect(validProfileId('1')).toBe(true)
      expect(validProfileId('999999')).toBe(true)
    })

    it('should accept UUID format', () => {
      expect(validProfileId('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(validProfileId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
      expect(validProfileId('6ba7b811-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    it('should reject usernames', () => {
      expect(validProfileId('Bob7')).toBe(false)
      expect(validProfileId('alice_smith')).toBe(false)
      expect(validProfileId('user-name')).toBe(false)
      expect(validProfileId('testuser')).toBe(false)
    })

    it('should reject invalid values', () => {
      expect(validProfileId('')).toBe(false)
      expect(validProfileId('  ')).toBe(false)
      expect(validProfileId(null)).toBe(false)
      expect(validProfileId(undefined)).toBe(false)
      expect(validProfileId(0)).toBe(false)
      expect(validProfileId(-1)).toBe(false)
      expect(validProfileId('0')).toBe(false)
      expect(validProfileId('-1')).toBe(false)
    })

    it('should reject malformed UUIDs', () => {
      expect(validProfileId('550e8400-e29b-41d4-a716')).toBe(false)
      expect(validProfileId('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false)
      expect(validProfileId('not-a-uuid-at-all')).toBe(false)
    })
  })

  describe('looksLikeUsername', () => {
    it('should identify usernames', () => {
      expect(looksLikeUsername('Bob7')).toBe(true)
      expect(looksLikeUsername('alice_smith')).toBe(true)
      expect(looksLikeUsername('user-name')).toBe(true)
      expect(looksLikeUsername('testuser')).toBe(true)
      expect(looksLikeUsername('a')).toBe(true)
    })

    it('should reject valid IDs', () => {
      expect(looksLikeUsername('123')).toBe(false)
      expect(looksLikeUsername(123)).toBe(false)
      expect(looksLikeUsername('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
    })

    it('should reject invalid values', () => {
      expect(looksLikeUsername('')).toBe(false)
      expect(looksLikeUsername('  ')).toBe(false)
      expect(looksLikeUsername(null)).toBe(false)
      expect(looksLikeUsername(undefined)).toBe(false)
    })

    it('should reject usernames with invalid characters', () => {
      expect(looksLikeUsername('user@name')).toBe(false)
      expect(looksLikeUsername('user name')).toBe(false)
      expect(looksLikeUsername('user.name')).toBe(false)
      expect(looksLikeUsername('user#name')).toBe(false)
    })
  })

  describe('normalizeProfileId', () => {
    it('should normalize valid IDs', () => {
      expect(normalizeProfileId('123')).toBe('123')
      expect(normalizeProfileId(123)).toBe('123')
      expect(normalizeProfileId('  456  ')).toBe('456')
      expect(normalizeProfileId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('should return null for invalid IDs', () => {
      expect(normalizeProfileId('Bob7')).toBe(null)
      expect(normalizeProfileId('')).toBe(null)
      expect(normalizeProfileId(null)).toBe(null)
      expect(normalizeProfileId(undefined)).toBe(null)
      expect(normalizeProfileId(0)).toBe(null)
    })
  })

  describe('isValidProfileId', () => {
    it('should work as a type guard', () => {
      const value: any = '123'
      if (isValidProfileId(value)) {
        // TypeScript should know value is string | number here
        expect(typeof value === 'string' || typeof value === 'number').toBe(true)
      }
    })

    it('should match validProfileId behavior', () => {
      const testValues = ['123', 123, 'Bob7', '', null, undefined, '550e8400-e29b-41d4-a716-446655440000']
      
      testValues.forEach(value => {
        expect(isValidProfileId(value)).toBe(validProfileId(value))
      })
    })
  })
})