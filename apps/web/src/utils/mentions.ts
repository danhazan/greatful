/**
 * Utility functions for handling mentions in rich text content
 */

/**
 * Wraps @username plain text mentions with HTML spans for editing
 */
export function wrapMentions(html: string): string {
  // Convert @username plain text to mention spans in HTML for edit mode
  return html.replace(/@([a-zA-Z0-9_.-]+)/g, '<span class="mention" data-username="$1">@$1</span>')
}

/**
 * Converts mention spans back to plain text @username format
 */
export function mentionsToPlainText(html: string): string {
  if (typeof document === 'undefined') {
    // Server-side fallback - use regex
    return html.replace(/<span[^>]*class="mention"[^>]*data-username="([^"]*)"[^>]*>@[^<]*<\/span>/g, '@$1')
  }
  
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  
  // Convert mention spans to plain text @username
  tmp.querySelectorAll('.mention').forEach(el => {
    const uname = el.getAttribute('data-username') || el.textContent?.replace('@', '')
    if (uname) {
      el.replaceWith(document.createTextNode(`@${uname}`))
    }
  })
  
  return tmp.textContent || ''
}

/**
 * Extracts plain text from HTML while preserving mention structure
 */
export function extractPlainTextWithMentions(html: string): string {
  if (!html) return ''
  
  // If it's already plain text, return as is
  if (!html.includes('<')) {
    return html
  }
  
  return mentionsToPlainText(html)
}