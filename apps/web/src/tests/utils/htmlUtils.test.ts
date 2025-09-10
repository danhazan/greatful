/**
 * Tests for HTML utility functions
 */

import { describe, it, expect } from '@jest/globals'
import { stripHtmlTags, htmlToPlainText, containsHtml } from '@/utils/htmlUtils'

describe('htmlUtils', () => {
  describe('stripHtmlTags', () => {
    it('should strip HTML tags and return plain text', () => {
      const html = 'Bob3 mentioned you in a post: hi </spa......'
      const result = stripHtmlTags(html)
      expect(result).toBe('Bob3 mentioned you in a post: hi')
    })

    it('should handle complex HTML with mentions and formatting', () => {
      const html = 'Thanks <span class="mention" data-username="bob">@bob</span> for the <strong>amazing</strong> work!'
      const result = stripHtmlTags(html)
      expect(result).toBe('Thanks @bob for the amazing work!')
    })

    it('should decode HTML entities', () => {
      const html = 'Check this &lt;code&gt; example &amp; &quot;quotes&quot;'
      const result = stripHtmlTags(html)
      expect(result).toBe('Check this <code> example & "quotes"')
    })

    it('should handle empty or null input', () => {
      expect(stripHtmlTags('')).toBe('')
      expect(stripHtmlTags(null as any)).toBe('')
      expect(stripHtmlTags(undefined as any)).toBe('')
    })

    it('should preserve plain text without HTML', () => {
      const text = 'This is plain text without any HTML'
      const result = stripHtmlTags(text)
      expect(result).toBe(text)
    })

    it('should clean up extra whitespace', () => {
      const html = '<p>Text   with    extra   spaces</p>'
      const result = stripHtmlTags(html)
      expect(result).toBe('Text with extra spaces')
    })
  })

  describe('htmlToPlainText', () => {
    it('should convert HTML to plain text', () => {
      const html = '<p>Hello <strong>world</strong>!</p>'
      const result = htmlToPlainText(html)
      expect(result).toBe('Hello world!')
    })

    it('should handle HTML entities', () => {
      const html = 'Test &nbsp; &amp; &lt;example&gt;'
      const result = htmlToPlainText(html)
      // htmlToPlainText preserves entities when no HTML tags are present
      expect(result).toBe('Test &nbsp; &amp; &lt;example&gt;')
    })

    it('should return plain text as-is', () => {
      const text = 'Plain text without HTML'
      const result = htmlToPlainText(text)
      expect(result).toBe(text)
    })
  })

  describe('containsHtml', () => {
    it('should detect HTML content', () => {
      expect(containsHtml('<p>HTML content</p>')).toBe(true)
      expect(containsHtml('Text with <span>HTML</span>')).toBe(true)
      expect(containsHtml('Plain text')).toBe(false)
      // containsHtml simply checks for < and > presence
      expect(containsHtml('Text with < and > but no tags')).toBe(true)
    })
  })
})