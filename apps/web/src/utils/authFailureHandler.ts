export const SESSION_EXPIRED_EVENT = 'auth:session-expired'

/**
 * Dispatches a global custom event signaling that the user's session
 * is irrecoverably invalid (refresh token expired, revoked, etc.).
 *
 * The React auth layer (UserContext) listens for this event and
 * orchestrates full state cleanup + redirect.
 *
 * This function is intentionally minimal — it is an event producer only.
 * All side effects are owned by the React layer.
 */
export function handleSessionExpired(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

/**
 * Subscribe to session-expired events.
 * Returns an unsubscribe function for cleanup.
 */
export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = () => handler()
  window.addEventListener(SESSION_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
}

/**
 * Check whether an error represents an authentication failure (401/403).
 * Accepts structured errors ({ status: 401 }), Error objects with
 * message text, and plain strings.
 */
export function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    return status === 401 || status === 403
  }
  if (error instanceof Error) {
    const msg = error.message
    return msg.includes('401') || msg.includes('403') ||
           msg.includes('Session expired') ||
           msg.includes('Unauthorized') ||
           msg.includes('session-expired')
  }
  if (typeof error === 'string') {
    return error.includes('401') || error.includes('403')
  }
  return false
}
