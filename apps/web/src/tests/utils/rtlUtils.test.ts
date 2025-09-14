import { describe, it, expect } from '@jest/globals'
import {
  isRTLCharacter,
  hasRTLCharacters,
  getTextDirection,
  getTextAlignmentClass,
  getDirectionAttribute,
  hasMixedDirectionContent
} from '@/utils/rtlUtils'

describe('RTL Utils', () => {
  describe('isRTLCharacter', () => {
    it('should detect Hebrew characters', () => {
      expect(isRTLCharacter('א')).toBe(true)
      expect(isRTLCharacter('ב')).toBe(true)
      expect(isRTLCharacter('ש')).toBe(true)
      expect(isRTLCharacter('ת')).toBe(true)
    })

    it('should detect Arabic characters', () => {
      expect(isRTLCharacter('ا')).toBe(true)
      expect(isRTLCharacter('ب')).toBe(true)
      expect(isRTLCharacter('ع')).toBe(true)
      expect(isRTLCharacter('ي')).toBe(true)
    })

    it('should not detect LTR characters as RTL', () => {
      expect(isRTLCharacter('a')).toBe(false)
      expect(isRTLCharacter('A')).toBe(false)
      expect(isRTLCharacter('1')).toBe(false)
      expect(isRTLCharacter(' ')).toBe(false)
      expect(isRTLCharacter('!')).toBe(false)
    })

    it('should handle empty or invalid input', () => {
      expect(isRTLCharacter('')).toBe(false)
    })
  })

  describe('hasRTLCharacters', () => {
    it('should detect Hebrew text', () => {
      expect(hasRTLCharacters('שלום')).toBe(true)
      expect(hasRTLCharacters('שלום עולם')).toBe(true)
    })

    it('should detect Arabic text', () => {
      expect(hasRTLCharacters('مرحبا')).toBe(true)
      expect(hasRTLCharacters('مرحبا بالعالم')).toBe(true)
    })

    it('should detect mixed content with RTL', () => {
      expect(hasRTLCharacters('Hello שלום')).toBe(true)
      expect(hasRTLCharacters('مرحبا World')).toBe(true)
    })

    it('should not detect pure LTR text', () => {
      expect(hasRTLCharacters('Hello World')).toBe(false)
      expect(hasRTLCharacters('123 ABC')).toBe(false)
    })

    it('should handle empty text', () => {
      expect(hasRTLCharacters('')).toBe(false)
      expect(hasRTLCharacters(null as any)).toBe(false)
      expect(hasRTLCharacters(undefined as any)).toBe(false)
    })
  })

  describe('getTextDirection', () => {
    it('should return rtl for Hebrew text', () => {
      expect(getTextDirection('שלום עולם')).toBe('rtl')
      expect(getTextDirection('זה טקסט בעברית')).toBe('rtl')
    })

    it('should return rtl for Arabic text', () => {
      expect(getTextDirection('مرحبا بالعالم')).toBe('rtl')
      expect(getTextDirection('هذا نص عربي')).toBe('rtl')
    })

    it('should return ltr for English text', () => {
      expect(getTextDirection('Hello World')).toBe('ltr')
      expect(getTextDirection('This is English text')).toBe('ltr')
    })

    it('should handle mixed content based on majority', () => {
      // More Hebrew than English
      expect(getTextDirection('שלום Hello שלום עולם')).toBe('rtl')
      // More English than Hebrew - but with 10% threshold, this is still RTL
      expect(getTextDirection('Hello World שלום')).toBe('rtl')
    })

    it('should ignore whitespace and punctuation', () => {
      expect(getTextDirection('שלום, עולם!')).toBe('rtl')
      expect(getTextDirection('Hello, World!')).toBe('ltr')
    })

    it('should handle empty or invalid input', () => {
      expect(getTextDirection('')).toBe('ltr')
      expect(getTextDirection('   ')).toBe('ltr')
      expect(getTextDirection('.,!?')).toBe('ltr')
    })
  })

  describe('getTextAlignmentClass', () => {
    it('should return text-right for RTL text', () => {
      expect(getTextAlignmentClass('שלום עולם')).toBe('text-right')
      expect(getTextAlignmentClass('مرحبا بالعالم')).toBe('text-right')
    })

    it('should return text-left for LTR text', () => {
      expect(getTextAlignmentClass('Hello World')).toBe('text-left')
      expect(getTextAlignmentClass('This is English')).toBe('text-left')
    })
  })

  describe('getDirectionAttribute', () => {
    it('should return rtl for RTL text', () => {
      expect(getDirectionAttribute('שלום עולם')).toBe('rtl')
      expect(getDirectionAttribute('مرحبا بالعالم')).toBe('rtl')
    })

    it('should return ltr for LTR text', () => {
      expect(getDirectionAttribute('Hello World')).toBe('ltr')
      expect(getDirectionAttribute('This is English')).toBe('ltr')
    })
  })

  describe('hasMixedDirectionContent', () => {
    it('should detect mixed Hebrew and English', () => {
      expect(hasMixedDirectionContent('Hello שלום')).toBe(true)
      expect(hasMixedDirectionContent('שלום World')).toBe(true)
    })

    it('should detect mixed Arabic and English', () => {
      expect(hasMixedDirectionContent('Hello مرحبا')).toBe(true)
      expect(hasMixedDirectionContent('مرحبا World')).toBe(true)
    })

    it('should not detect pure Hebrew as mixed', () => {
      expect(hasMixedDirectionContent('שלום עולם')).toBe(false)
    })

    it('should not detect pure English as mixed', () => {
      expect(hasMixedDirectionContent('Hello World')).toBe(false)
    })

    it('should not detect pure Arabic as mixed', () => {
      expect(hasMixedDirectionContent('مرحبا بالعالم')).toBe(false)
    })

    it('should handle empty text', () => {
      expect(hasMixedDirectionContent('')).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle text with numbers and RTL', () => {
      expect(getTextDirection('שלום 123')).toBe('rtl')
      expect(getTextDirection('123 שלום')).toBe('rtl')
    })

    it('should handle text with punctuation and RTL', () => {
      expect(getTextDirection('שלום!')).toBe('rtl')
      expect(getTextDirection('!שלום')).toBe('rtl')
    })

    it('should handle mentions in RTL text', () => {
      expect(getTextDirection('שלום @username')).toBe('rtl')
      expect(hasRTLCharacters('שלום @username')).toBe(true)
    })

    it('should handle emojis with RTL text', () => {
      expect(getTextDirection('שלום 😊')).toBe('rtl')
      expect(hasRTLCharacters('שלום 😊')).toBe(true)
    })
  })
})