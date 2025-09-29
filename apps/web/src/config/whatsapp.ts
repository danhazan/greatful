/**
 * WhatsApp sharing configuration
 * 
 * IMPORTANT: Always use the web URL (https://wa.me/) as it works reliably
 * on all platforms and browsers. The whatsapp:// scheme causes blank pages.
 */

export const WHATSAPP_CONFIG = {
  // Primary WhatsApp Web URL - works on all platforms and browsers
  WEB_URL: 'https://wa.me/',
  
  // Alternative WhatsApp Web URL (also works, but wa.me is preferred)
  WEB_URL_ALT: 'https://api.whatsapp.com/send',
  
  // Default share message template
  SHARE_MESSAGE_TEMPLATE: 'Check out this gratitude post:',
} as const

/**
 * Get the WhatsApp Web URL (single source of truth)
 */
export function getWhatsAppBaseURL(): string {
  return WHATSAPP_CONFIG.WEB_URL
}

/**
 * Build complete WhatsApp share URL with text parameter
 */
export function buildWhatsAppURL(text: string): string {
  const baseUrl = getWhatsAppBaseURL()
  const encodedText = encodeURIComponent(text)
  return `${baseUrl}?text=${encodedText}`
}