import { 
  isMobileDevice, 
  isIOS, 
  isAndroid, 
  generateWhatsAppURL, 
  formatWhatsAppShareText 
} from '@/utils/mobileDetection'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// Mock window and navigator
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768
}

const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  maxTouchPoints: 0
}

describe('mobileDetection', () => {
  beforeEach(() => {
    // Reset mocks
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true,
    })
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    })
  })

  afterEach(() => {
    // Reset to defaults
    mockWindow.innerWidth = 1024
    mockWindow.innerHeight = 768
    mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    mockNavigator.maxTouchPoints = 0
  })

  describe('isMobileDevice', () => {
    it('returns false for desktop user agent', () => {
      expect(isMobileDevice()).toBe(false)
    })

    it('returns true for mobile user agent', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      expect(isMobileDevice()).toBe(true)
    })

    it('returns true for Android user agent', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G975F)'
      expect(isMobileDevice()).toBe(true)
    })

    it('returns true for very small screen with touch support and no desktop indicators', () => {
      mockWindow.innerWidth = 400 // Very small screen
      mockNavigator.maxTouchPoints = 1
      mockNavigator.userAgent = 'Mozilla/5.0 (Mobile; rv:40.0) Gecko/40.0 Firefox/40.0' // No desktop indicators
      expect(isMobileDevice()).toBe(true)
    })

    it('returns false for small screen with desktop indicators', () => {
      mockWindow.innerWidth = 400
      mockNavigator.maxTouchPoints = 1
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' // Has desktop indicators
      expect(isMobileDevice()).toBe(false)
    })

    it('returns false for medium screen with touch support', () => {
      mockWindow.innerWidth = 600 // Medium screen
      mockNavigator.maxTouchPoints = 1
      expect(isMobileDevice()).toBe(false)
    })

    it('returns false when window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      })
      expect(isMobileDevice()).toBe(false)
    })
  })

  describe('isIOS', () => {
    it('returns false for non-iOS user agent', () => {
      expect(isIOS()).toBe(false)
    })

    it('returns true for iPhone user agent', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      expect(isIOS()).toBe(true)
    })

    it('returns true for iPad user agent', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)'
      expect(isIOS()).toBe(true)
    })

    it('returns false when window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      })
      expect(isIOS()).toBe(false)
    })
  })

  describe('isAndroid', () => {
    it('returns false for non-Android user agent', () => {
      expect(isAndroid()).toBe(false)
    })

    it('returns true for Android user agent', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G975F)'
      expect(isAndroid()).toBe(true)
    })

    it('returns false when window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      })
      expect(isAndroid()).toBe(false)
    })
  })

  describe('generateWhatsAppURL', () => {
    it('always generates WhatsApp Web URL for reliability', () => {
      const text = 'Hello World'
      const url = generateWhatsAppURL(text)
      expect(url).toBe('https://wa.me/?text=Hello%20World')
    })

    it('generates WhatsApp Web URL even for mobile devices', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      const text = 'Hello World'
      const url = generateWhatsAppURL(text)
      expect(url).toBe('https://wa.me/?text=Hello%20World')
    })

    it('properly encodes special characters', () => {
      const text = 'Hello & Welcome! Check this: https://example.com'
      const url = generateWhatsAppURL(text)
      expect(url).toBe('https://wa.me/?text=Hello%20%26%20Welcome!%20Check%20this%3A%20https%3A%2F%2Fexample.com')
    })
  })

  describe('formatWhatsAppShareText', () => {
    it('formats share text correctly for short content', () => {
      const content = 'Short gratitude post'
      const postUrl = 'https://example.com/post/123'
      const result = formatWhatsAppShareText(content, postUrl)
      
      expect(result).toBe('Check out this gratitude post:\nhttps://example.com/post/123')
    })

    it('handles long content by excluding it', () => {
      const content = 'This is a very long gratitude post that exceeds the 100 character limit and should be truncated with ellipsis'
      const postUrl = 'https://example.com/post/123'
      const result = formatWhatsAppShareText(content, postUrl)
      
      expect(result).toBe('Check out this gratitude post:\nhttps://example.com/post/123')
      expect(result.includes('Check out this gratitude post:')).toBe(true)
      expect(result.includes(postUrl)).toBe(true)
      // Content should not be included
      expect(result.includes(content)).toBe(false)
    })

    it('handles any length content by excluding it', () => {
      const content = '1234567890'.repeat(10) // Exactly 100 characters
      const postUrl = 'https://example.com/post/123'
      const result = formatWhatsAppShareText(content, postUrl)
      
      expect(result).toBe(`Check out this gratitude post:\n${postUrl}`)
      // Content should not be included regardless of length
      expect(result.includes(content)).toBe(false)
    })
  })
})