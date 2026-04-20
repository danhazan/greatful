/**
 * Feed configuration constants
 * 
 * These values can be overridden via environment variables at build time.
 * Format: NEXT_PUBLIC_<CONSTANT_NAME>
 */

export const FEED_CONFIG = {
  // Filter debounce delay in milliseconds
  FILTER_DEBOUNCE_MS: parseInt(process.env['NEXT_PUBLIC_FEED_FILTER_DEBOUNCE_MS'] || '1500', 10),
  
  // Refresh cooldown in milliseconds (prevents rapid re-refreshes)
  REFRESH_COOLDOWN_MS: parseInt(process.env['NEXT_PUBLIC_FEED_REFRESH_COOLDOWN_MS'] || '750', 10),
  
  // Default page size for feed requests
  DEFAULT_PAGE_SIZE: parseInt(process.env['NEXT_PUBLIC_FEED_DEFAULT_PAGE_SIZE'] || '10', 10),
} as const

export type FeedConfig = typeof FEED_CONFIG