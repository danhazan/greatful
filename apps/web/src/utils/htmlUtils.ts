/**
 * Utility functions for HTML processing
 */

/**
 * Strips HTML tags and returns plain text content
 * Preserves line breaks and basic formatting structure
 */
export function stripHtmlTags(html: string): string {
  if (!html) return ''
  
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    // Fallback for server-side rendering - use regex to strip HTML tags
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }
  
  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Get text content, which automatically strips HTML tags
  let plainText = tempDiv.textContent || tempDiv.innerText || ''
  
  // Clean up extra whitespace but preserve intentional line breaks
  plainText = plainText.replace(/\s+/g, ' ').trim()
  
  return plainText
}

/**
 * Converts HTML content to plain text suitable for editing
 * Handles mentions, line breaks, and formatting
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  
  // If it's already plain text (no HTML tags), return as is
  if (!html.includes('<') && !html.includes('>')) {
    return html
  }
  
  // Handle common HTML entities
  let processed = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  
  return stripHtmlTags(processed)
}

/**
 * Checks if content contains HTML tags
 */
export function containsHtml(content: string): boolean {
  return content.includes('<') && content.includes('>')
}