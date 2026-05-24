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
