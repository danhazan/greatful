/**
 * Authentication utility functions
 */

/**
 * Check if user is currently authenticated
 * @returns boolean indicating if user has a valid token
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') {
    // Server-side rendering - no access to localStorage
    return false
  }
  
  const token = localStorage.getItem('access_token')
  return !!token
}

/**
 * Get the current user's access token
 * @returns string token or null if not authenticated
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  return localStorage.getItem('access_token')
}

/**
 * Check if user can interact with posts (logged in)
 * @returns boolean indicating if user can perform interactions
 */
export function canInteract(): boolean {
  return isAuthenticated()
}