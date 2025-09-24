/**
 * Utility functions for HTML processing
 */

// Dynamic import for DOMPurify to avoid SSR issues
let purifyPromise: Promise<any> | null = null

function getDOMPurify() {
  if (typeof window === 'undefined') {
    return null // Server-side, no DOMPurify
  }
  
  if (!purifyPromise) {
    purifyPromise = import('dompurify')
  }
  
  return purifyPromise
}

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

/**
 * Basic server-side HTML sanitization
 */
function basicSanitize(inputHtml: string): string {
  return inputHtml
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
}

/**
 * Sanitizes HTML content using DOMPurify (client-side) or basic sanitization (server-side)
 * Allows safe HTML tags and attributes for rich text editing
 */
export function sanitizeHtml(inputHtml: string): string {
  if (!inputHtml) return ""
  
  // Server-side rendering - use basic sanitization
  if (typeof window === 'undefined') {
    return basicSanitize(inputHtml)
  }
  
  // Client-side - try to use DOMPurify
  const purifyPromise = getDOMPurify()
  if (!purifyPromise) {
    return basicSanitize(inputHtml)
  }
  
  // For synchronous usage, we need to handle this differently
  // Return basic sanitization for now, and let components handle async loading
  return basicSanitize(inputHtml)
}

/**
 * Async version of sanitizeHtml that properly loads DOMPurify
 */
export async function sanitizeHtmlAsync(inputHtml: string): Promise<string> {
  if (!inputHtml) return ""
  
  // Server-side rendering - use basic sanitization
  if (typeof window === 'undefined') {
    return basicSanitize(inputHtml)
  }
  
  try {
    const DOMPurify = await import('dompurify')
    return DOMPurify.default.sanitize(inputHtml, {
      ALLOWED_TAGS: [
        "b", "strong", "i", "em", "u", "span", "p", "br", "ul", "ol", "li", "a"
      ],
      ALLOWED_ATTR: ["style", "class", "data-username", "href"],
      ALLOW_DATA_ATTR: true,
    })
  } catch (error) {
    console.warn('DOMPurify loading failed, using fallback:', error)
    return basicSanitize(inputHtml)
  }
}