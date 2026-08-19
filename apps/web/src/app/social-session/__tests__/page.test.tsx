import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import SocialSessionPage from '@/app/social-session/page'

const mockRouter = { replace: jest.fn(), push: jest.fn() }
const mockLogin = jest.fn()
const mockNormalize = jest.fn()
const mockReloadUser = jest.fn().mockResolvedValue(undefined)

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ reloadUser: mockReloadUser }),
}))

jest.mock('@/utils/auth', () => ({ login: (...args: unknown[]) => mockLogin(...args) }))
jest.mock('@/utils/authNormalization', () => ({
  normalizeAuthResponse: (...args: unknown[]) => mockNormalize(...args),
}))

describe('/social-session', () => {
  const originalFetch = global.fetch
  const originalHash = window.location.hash
  let replaceStateSpy: jest.SpyInstance

  const successBody = {
    success: true,
    data: {
      user: { id: 42, email: 'native@example.com', username: 'native' },
      access_token: 'access_token_123',
      refresh_token: 'refresh_token_123',
      token_type: 'bearer',
      is_new_user: false,
    },
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response
  }

  beforeEach(() => {
    mockRouter.replace.mockClear()
    mockRouter.push.mockClear()
    mockLogin.mockClear()
    mockNormalize.mockClear()
    mockReloadUser.mockClear()
    replaceStateSpy = jest.spyOn(history, 'replaceState').mockImplementation(() => {})
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(successBody)) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    window.location.hash = originalHash
    replaceStateSpy.mockRestore()
    jest.restoreAllMocks()
  })

  it('parses the fragment, strips it from history, and establishes the session', async () => {
    window.location.hash = '#bootstrap=opaque.token.value'
    mockNormalize.mockReturnValue({
      accessToken: 'access_token_123',
      tokenType: 'bearer',
      isNewUser: false,
      user: { id: '42' },
    })

    render(<SocialSessionPage />)

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/feed'))

    // Fragment removed immediately via replaceState — the new URL must never
    // retain the bootstrap fragment
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      '',
      expect.not.stringContaining('bootstrap='),
    )

    // Token forwarded server-side only — never into localStorage by the page
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/social-session',
      expect.objectContaining({
        body: JSON.stringify({ bootstrap_token: 'opaque.token.value' }),
      }),
    )
    expect(mockLogin).toHaveBeenCalledWith('access_token_123')
    expect(mockReloadUser).toHaveBeenCalled()
  })

  it('duplicate execution is guarded under StrictMode double effects', async () => {
    window.location.hash = '#bootstrap=opaque.token.value'
    mockNormalize.mockReturnValue({
      accessToken: 'access_token_123',
      tokenType: 'bearer',
      isNewUser: false,
      user: { id: '42' },
    })

    render(
      <React.StrictMode>
        <SocialSessionPage />
      </React.StrictMode>,
    )

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('shows a safe inline error and never redirects on backend failure', async () => {
    window.location.hash = '#bootstrap=opaque.token.value'
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ detail: 'Invalid or expired bootstrap token' }, 401),
    ) as unknown as typeof fetch

    render(<SocialSessionPage />)

    await waitFor(() =>
      expect(
        screen.getByText('Session linking failed. Please try again from the app.'),
      ).toBeInTheDocument(),
    )
    expect(mockRouter.replace).not.toHaveBeenCalled()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('shows an inline error without redirect when no fragment is present', async () => {
    window.location.hash = ''

    render(<SocialSessionPage />)

    await waitFor(() =>
      expect(screen.getByText(/Session linking is unavailable/)).toBeInTheDocument(),
    )
    expect(mockRouter.replace).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('redirects only to the fixed post-auth destination', async () => {
    window.location.hash = '#bootstrap=opaque.token.value'
    mockNormalize.mockReturnValue({
      accessToken: 'access_token_123',
      tokenType: 'bearer',
      isNewUser: false,
      user: { id: '42' },
    })

    render(<SocialSessionPage />)

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1))
    expect(mockRouter.replace.mock.calls[0][0]).toBe('/feed')
  })
})