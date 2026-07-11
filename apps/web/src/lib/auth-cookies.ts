import { NextResponse } from 'next/server'

export function setAuthCookies(
  response: NextResponse,
  payload: Record<string, any> | undefined,
  secureFlag: boolean,
): void {
  if (!payload) return

  const refreshToken = payload['refresh_token']
  const signupToken = payload['signup_token']

  if (payload['refresh_token']) delete payload['refresh_token']
  if (payload['signup_token']) delete payload['signup_token']

  if (refreshToken) {
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: secureFlag,
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })
  }

  if (signupToken) {
    response.cookies.set('signup_token', signupToken, {
      httpOnly: true,
      secure: secureFlag,
      sameSite: 'lax' as const,
      maxAge: 15 * 60,
      path: '/',
    })
  }
}
