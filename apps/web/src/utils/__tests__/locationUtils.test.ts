/**
 * Tests for location utility functions
 */

import { 
  truncateLocationName, 
  createShortLocationSummary, 
  isValidLocationLength 
} from '../locationUtils'

describe('locationUtils', () => {
  describe('truncateLocationName', () => {
    it('should not truncate short location names', () => {
      const shortName = 'New York, NY, USA'
      const result = truncateLocationName(shortName)
      
      expect(result).toBe(shortName)
      expect(result).not.toContain('...')
    })

    it('should truncate long location names with default max length', () => {
      const longName = 'Condomínio Jerusa, 920, Meireles, Fortaleza, Região Geográfica Imediata de Fortaleza, Região Geográfica Intermediária de Fortaleza, Ceará, Northeast Region, 60165-070, Brazil'
      const result = truncateLocationName(longName)
      
      expect(result.length).toBeLessThanOrEqual(150)
      expect(result).toContain('...')
      expect(result).toBe(longName.substring(0, 147) + '...')
    })

    it('should truncate with custom max length', () => {
      const longName = 'This is a very long location name that should be truncated'
      const result = truncateLocationName(longName, 30)
      
      expect(result.length).toBeLessThanOrEqual(30)
      expect(result).toContain('...')
      expect(result).toBe('This is a very long locatio...')
    })

    it('should handle empty or null input', () => {
      expect(truncateLocationName('')).toBe('')
      expect(truncateLocationName(null as any)).toBe(null)
      expect(truncateLocationName(undefined as any)).toBe(undefined)
    })

    it('should handle exact length match', () => {
      const exactName = 'A'.repeat(150)
      const result = truncateLocationName(exactName, 150)
      
      expect(result).toBe(exactName)
      expect(result).not.toContain('...')
    })
  })

  describe('createShortLocationSummary', () => {
    it('should create summary with city and country', () => {
      const address = {
        city: 'New York',
        state: 'NY',
        country: 'USA',
        country_code: 'us'
      }
      
      const result = createShortLocationSummary(address)
      expect(result).toBe('New York, NY')
    })

    it('should handle missing city', () => {
      const address = {
        state: 'California',
        country: 'USA'
      }
      
      const result = createShortLocationSummary(address)
      expect(result).toBe('California, USA')
    })

    it('should handle only country', () => {
      const address = {
        country: 'Brazil'
      }
      
      const result = createShortLocationSummary(address)
      expect(result).toBe('Brazil')
    })

    it('should handle empty address', () => {
      const address = {}
      const result = createShortLocationSummary(address)
      expect(result).toBe('')
    })

    it('should limit to first two components', () => {
      const address = {
        city: 'São Paulo',
        state: 'São Paulo',
        country: 'Brazil'
      }
      
      const result = createShortLocationSummary(address)
      expect(result).toBe('São Paulo, São Paulo')
    })
  })

  describe('isValidLocationLength', () => {
    it('should return true for valid length locations', () => {
      expect(isValidLocationLength('Short location')).toBe(true)
      expect(isValidLocationLength('A'.repeat(150))).toBe(true)
      expect(isValidLocationLength('')).toBe(true)
    })

    it('should return false for too long locations', () => {
      expect(isValidLocationLength('A'.repeat(151))).toBe(false)
      expect(isValidLocationLength('A'.repeat(200))).toBe(false)
    })

    it('should handle custom max length', () => {
      expect(isValidLocationLength('Short', 10)).toBe(true)
      expect(isValidLocationLength('Too long for limit', 10)).toBe(false)
    })

    it('should handle null/undefined input', () => {
      expect(isValidLocationLength(null as any)).toBe(true)
      expect(isValidLocationLength(undefined as any)).toBe(true)
    })
  })
})