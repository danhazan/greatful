/**
 * WebView session-state bridge (SW2-P2).
 *
 * The native app's Social WebView can only learn about the real web
 * authentication state from the web application itself — the injected
 * SESSION_PROBE_SCRIPT only observes localStorage token presence, which
 * cannot detect an expired token whose refresh attempt subsequently fails.
 *
 * This module emits two additive bridge messages:
 *
 *   SESSION_STATE    { v, id, type: 'SESSION_STATE', ts, payload: { state, reason? } }
 *                    v2. state is 'authenticated' | 'anonymous' — the
 *                    authoritative web session state for P2/P3.0 lifecycle
 *                    decisions. Anonymous events ALWAYS carry a reason
 *                    ('explicit_logout' | 'passive_loss') sourced from the
 *                    actual web auth lifecycle (SW2-P3.0).
 *
 *   SESSION_IDENTITY { v, id, type: 'SESSION_IDENTITY', ts, payload: { userId } }
 *                    emitted only when the web app actually knows the
 *                    authenticated current user (Grateful user id only —
 *                    never email, username, profile data, or tokens).
 *
 * Messages are posted ONLY when window.ReactNativeWebView.postMessage exists.
 * Payload values are never logged (the bridge logs nothing at all).
 *
 * Version history: v1 = boolean-only SESSION_STATE (SW2-P2, pre-discriminator;
 * the fixed injected SessionProbe still emits v1). v2 = SESSION_STATE gains the
 * additive anonymous reason discriminator (SW2-P3.0). The mobile bridge treats
 * v1 messages as observed-but-non-authoritative for reconnect decisions and
 * accepts the envelope version from the web app's authoritative emission.
 */

export type WebViewSessionState = 'authenticated' | 'anonymous'

/** SW2-P3.0 logout discriminator — why the web session went anonymous. */
export type WebViewSessionLogoutReason = 'explicit_logout' | 'passive_loss'

const SESSION_BRIDGE_VERSION = 2

interface ReactNativeWebView {
  postMessage(message: string): void
}

function getReactNativeWebView(): ReactNativeWebView | null {
  if (typeof window === 'undefined') return null
  const rn = (window as unknown as { ReactNativeWebView?: ReactNativeWebView }).ReactNativeWebView
  if (!rn || typeof rn.postMessage !== 'function') return null
  return rn
}

function postBridgeMessage(
  type: 'SESSION_STATE' | 'SESSION_IDENTITY',
  payload: Record<string, unknown>,
): void {
  const rn = getReactNativeWebView()
  if (!rn) return

  const message = JSON.stringify({
    v: SESSION_BRIDGE_VERSION,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    ts: Date.now(),
    payload,
  })
  // NOTE: payload values (user ids) must never be logged — post raw.
  rn.postMessage(message)
}

/** Emit the authoritative web session state to the native WebView. */
export function emitSessionState(state: 'authenticated'): void
export function emitSessionState(state: 'anonymous', reason: WebViewSessionLogoutReason): void
export function emitSessionState(
  state: WebViewSessionState,
  reason?: WebViewSessionLogoutReason,
): void {
  // Anonymous MUST carry a reason (SW2-P3.0): the native coordinator uses it
  // to decide whether automatic reconnect is permitted. The overloads enforce
  // this at compile time.
  postBridgeMessage('SESSION_STATE', reason ? { state, reason } : { state })
}

/** Emit the authenticated user identity (Grateful user id only). */
export function emitSessionIdentity(userId: string): void {
  postBridgeMessage('SESSION_IDENTITY', { userId })
}