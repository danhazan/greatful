/**
 * Authentication utilities
 */

import { smartNotificationPoller } from './smartNotificationPoller'

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('access_token')
}

/**
 * Get access token from localStorage
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

/**
 * Set access token in localStorage
 */
export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('access_token', token)
}

/**
 * Comprehensive logout function that cleans up all user-related state
 */
export function logout(): void {
  console.trace('[logout] called')
  if (typeof window === 'undefined') return

  // 1. Remove access token
  localStorage.removeItem('access_token')

  // 2. Stop notification polling to prevent polling with old user ID
  smartNotificationPoller.stop()

  // 3. Clear any other auth-related localStorage items
  // Add more items here if needed in the future
}

/**
 * Login function that sets up user session
 */
export function login(token: string): void {
  if (typeof window === 'undefined') return
  
  // Set the access token
  setAccessToken(token)
}