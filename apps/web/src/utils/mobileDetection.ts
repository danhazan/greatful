/**
 * Mobile detection utilities for WhatsApp sharing
 */

import { buildWhatsAppURL, WHATSAPP_CONFIG } from '@/config/whatsapp'

/**
 * Detect if the user is on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // Check user agent for mobile indicators - this is the most reliable method
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

  // If user agent clearly indicates mobile, return true
  if (isMobileUserAgent) {
    return true
  }

  // For edge cases, check if it's a small screen AND has touch support
  // But be more conservative - only consider it mobile if screen is very small
  const hasTouchSupport = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0
  const isVerySmallScreen = window.innerWidth <= 480 // More conservative threshold

  // Only consider it mobile if both conditions are met and no desktop indicators
  const hasDesktopIndicators = userAgent.includes('windows') || 
    userAgent.includes('macintosh') || 
    userAgent.includes('linux') && !userAgent.includes('android')

  return !hasDesktopIndicators && hasTouchSupport && isVerySmallScreen
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
 * Generate WhatsApp URL - always use web URL for reliability
 */
export function generateWhatsAppURL(text: string): string {
  // Use centralized configuration to build WhatsApp URL
  return buildWhatsAppURL(text)
}

/**
 * Format share text for WhatsApp
 */
export function formatWhatsAppShareText(postContent: string, postUrl: string): string {
  // Don't include post content, just share the link
  // postContent parameter kept for API compatibility but not used
  return `${WHATSAPP_CONFIG.SHARE_MESSAGE_TEMPLATE}\n${postUrl}`
}