import { describe, it, expect } from '@jest/globals'
import { isDarkBackground, getTextColorForBackground, extractPrimaryBackgroundColor } from '@/utils/colorUtils'

describe('colorUtils', () => {
  describe('isDarkBackground', () => {
    it('should identify dark colors correctly', () => {
      expect(isDarkBackground('#000000')).toBe(true)
      expect(isDarkBackground('#1F2937')).toBe(true) // elegant-dark background
      expect(isDarkBackground('#333333')).toBe(true)
    })

    it('should identify light colors correctly', () => {
      expect(isDarkBackground('#ffffff')).toBe(false)
      expect(isDarkBackground('#FEF3C7')).toBe(false) // warm-sunset background
      expect(isDarkBackground('#F3E8FF')).toBe(false) // peaceful-purple background
      expect(isDarkBackground('#ECFDF5')).toBe(false) // nature-green background
      expect(isDarkBackground('#EFF6FF')).toBe(false) // ocean-blue background
      expect(isDarkBackground('#FDF2F8')).toBe(false) // rose-gold background
      expect(isDarkBackground('#F9FAFB')).toBe(false) // minimalist-gray background
      expect(isDarkBackground('#FFFBEB')).toBe(false) // gratitude-gold background
    })

    it('should handle transparent and special cases', () => {
      expect(isDarkBackground('transparent')).toBe(false)
      expect(isDarkBackground('white')).toBe(false)
    })

    it('should handle invalid colors gracefully', () => {
      expect(isDarkBackground('invalid-color')).toBe(false)
      expect(isDarkBackground('')).toBe(false)
    })
  })

  describe('getTextColorForBackground', () => {
    it('should return white for dark backgrounds', () => {
      expect(getTextColorForBackground('#000000')).toBe('#ffffff')
      expect(getTextColorForBackground('#1F2937')).toBe('#ffffff')
      expect(getTextColorForBackground('#333333')).toBe('#ffffff')
    })

    it('should return default text color for light backgrounds', () => {
      expect(getTextColorForBackground('#ffffff')).toBe('#374151')
      expect(getTextColorForBackground('#FEF3C7')).toBe('#374151')
      expect(getTextColorForBackground('#F3E8FF')).toBe('#374151')
      expect(getTextColorForBackground('#ECFDF5')).toBe('#374151')
    })

    it('should use custom default text color when provided', () => {
      expect(getTextColorForBackground('#ffffff', '#123456')).toBe('#123456')
      expect(getTextColorForBackground('#FEF3C7', '#654321')).toBe('#654321')
    })
  })

  describe('extractPrimaryBackgroundColor', () => {
    it('should extract first color from linear gradients', () => {
      const gradient = 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)'
      expect(extractPrimaryBackgroundColor(gradient)).toBe('#FEF3C7')
    })

    it('should extract first color from complex gradients', () => {
      const gradient = 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 50%, #C084FC 100%)'
      expect(extractPrimaryBackgroundColor(gradient)).toBe('#F3E8FF')
    })

    it('should return solid colors as-is', () => {
      expect(extractPrimaryBackgroundColor('#FEF3C7')).toBe('#FEF3C7')
      expect(extractPrimaryBackgroundColor('#1F2937')).toBe('#1F2937')
      expect(extractPrimaryBackgroundColor('transparent')).toBe('transparent')
    })

    it('should handle gradients without hex colors', () => {
      const gradient = 'linear-gradient(135deg, rgba(254, 243, 199, 1) 0%, rgba(253, 230, 138, 1) 100%)'
      expect(extractPrimaryBackgroundColor(gradient)).toBe('rgba(254, 243, 199, 1)')
    })

    it('should handle invalid gradients gracefully', () => {
      expect(extractPrimaryBackgroundColor('invalid-gradient')).toBe('invalid-gradient')
      expect(extractPrimaryBackgroundColor('')).toBe('')
    })
  })
})