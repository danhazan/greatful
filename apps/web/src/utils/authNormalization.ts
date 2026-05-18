/**
 * Centralized authentication response normalization and validation.
 * Enforces a single contract boundary between Next.js proxy and frontend consumers.
 */

export interface NormalizedAuthData {
  user: {
    id: string
    username: string
    email: string
    displayName?: string
    profileImageUrl?: string
    [key: string]: any
  }
  accessToken: string
  tokenType: string
  isNewUser: boolean
}

/**
 * Dev-only runtime schema assertion to prevent silent auth regressions.
 */
export function assertHasAuthShape(data: any): void {
  if (process.env.NODE_ENV === 'development') {
    if (!data) {
      throw new Error('Auth response data is null or undefined')
    }
    const target = data.data || data
    if (!target.accessToken && !target.access_token) {
      throw new Error('Auth response missing required field: accessToken (or access_token)')
    }
    if (!target.user && !target.User) {
      throw new Error('Auth response missing required field: user')
    }
  }
}

/**
 * Single authoritative function for normalizing authentication responses.
 * Enforces snake_case -> camelCase mapping, token extraction, and user extraction.
 */
export function normalizeAuthResponse(data: any): NormalizedAuthData {
  // 1. Runtime schema assertion in development
  assertHasAuthShape(data)

  // 2. Extract payload whether wrapped in canonical 'data' property or raw
  const payload = data?.data || data || {}

  // 3. Extract accessToken (handling snake_case or camelCase)
  const accessToken = payload.accessToken || payload.access_token || ''

  // 4. Extract tokenType
  const tokenType = payload.tokenType || payload.token_type || 'bearer'

  // 5. Extract isNewUser
  const isNewUser = Boolean(payload.isNewUser ?? payload.is_new_user ?? false)

  // 6. Extract user object
  const rawUser = payload.user || payload.User || {}
  const user = {
    id: String(rawUser.id || rawUser.sub || ''),
    username: String(rawUser.username || rawUser.email?.split('@')[0] || ''),
    email: String(rawUser.email || ''),
    displayName: rawUser.displayName || rawUser.display_name || rawUser.name,
    profileImageUrl: rawUser.profileImageUrl || rawUser.profile_image_url || rawUser.picture,
    ...rawUser
  }

  return {
    user,
    accessToken,
    tokenType,
    isNewUser
  }
}
