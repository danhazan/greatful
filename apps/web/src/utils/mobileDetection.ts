/**
 * Mobile detection utilities for WhatsApp sharing
 */

/**
 * Detect if the user is on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'mobile'
  ]

  const isMobileUserAgent = mobileKeywords.some(keyword => 
    userAgent.includes(keyword)
  )

  // Check for touch support
  const hasTouchSupport = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0

  // Check screen size (mobile-like dimensions)
  const isMobileScreen = window.innerWidth <= 768

  return isMobileUserAgent || (hasTouchSupport && isMobileScreen)
}

/**
 * Detect if the user is on iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

/**
 * Detect if the user is on Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent.toLowerCase()
  return /android/.test(userAgent)
}

/**
 * Generate WhatsApp URL based on device type
 */
export function generateWhatsAppURL(text: string): string {
  const encodedText = encodeURIComponent(text)
  
  if (isMobileDevice()) {
    // Use WhatsApp app URL scheme for mobile devices
    return `whatsapp://send?text=${encodedText}`
  } else {
    // Use WhatsApp Web for desktop
    return `https://wa.me/?text=${encodedText}`
  }
}

/**
 * Format share text for WhatsApp
 */
export function formatWhatsAppShareText(postContent: string, postUrl: string): string {
  // Don't include post content, just share the link
  return `Check out this gratitude post:\n${postUrl}`
}