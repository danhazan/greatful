import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import {
  UserProvider,
  useUser,
  resetCurrentUserBootstrapForTests,
} from '@/contexts/UserContext'
import { apiClient } from '@/utils/apiClient'
import * as auth from '@/utils/auth'
import { handleSessionExpired } from '@/utils/authFailureHandler'
import {
  emitSessionIdentity,
  emitSessionState,
} from '@/utils/webViewSessionBridge'

jest.mock('@/utils/apiClient')
jest.mock('@/utils/auth')
jest.mock('@/utils/webViewSessionBridge')

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>
const mockedAuth = auth as jest.Mocked<typeof auth>
const mockedEmitState = emitSessionState as jest.MockedFunction<typeof emitSessionState>
const mockedEmitIdentity = emitSessionIdentity as jest.MockedFunction<typeof emitSessionIdentity>

function SessionProbe() {
  const { currentUser, logout } = useUser()
  return (
    <button onClick={logout} data-testid="logout">
      {currentUser ? currentUser.id : 'anon'}
    </button>
  )
}

describe('UserContext -> WebView session bridge (SW2-P2)', () => {
  afterEach(() => {
    jest.clearAllMocks()
    resetCurrentUserBootstrapForTests()
  })

  it('emits SESSION_STATE=authenticated + SESSION_IDENTITY after user hydration', async () => {
    mockedAuth.getAccessToken.mockReturnValue('mock-token')
    mockedApiClient.getCurrentUserProfile.mockResolvedValue({
      id: 123,
      name: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(
      <UserProvider>
        <SessionProbe />
      </UserProvider>,
    )

    await waitFor(() => expect(mockedEmitState).toHaveBeenCalledWith('authenticated'))
    expect(mockedEmitIdentity).toHaveBeenCalledWith('123')
  })

  it('emits SESSION_STATE=anonymous + passive_loss when no credential exists', async () => {
    mockedAuth.getAccessToken.mockReturnValue(null)

    render(
      <UserProvider>
        <SessionProbe />
      </UserProvider>,
    )

    // Initial load with no credential: no explicit logout happened, so the
    // reason defaults to passive_loss (never a reconnect-blocking reason).
    await waitFor(() => expect(mockedEmitState).toHaveBeenCalledWith('anonymous', 'passive_loss'))
    expect(mockedEmitIdentity).not.toHaveBeenCalled()
  })

  it('clears identity on logout — anonymous + explicit_logout never exposes stale identity', async () => {
    mockedAuth.getAccessToken.mockReturnValue('mock-token')
    mockedApiClient.getCurrentUserProfile.mockResolvedValue({
      id: 123,
      name: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
    })

    const { getByTestId } = render(
      <UserProvider>
        <SessionProbe />
      </UserProvider>,
    )

    await waitFor(() => expect(mockedEmitState).toHaveBeenCalledWith('authenticated'))
    expect(mockedEmitIdentity).toHaveBeenCalledWith('123')

    // Explicit logout: token removed + currentUser null -> anonymous with the
    // explicit_logout discriminator (SW2-P3.0) so the native coordinator
    // never silently re-authenticates the WebView.
    mockedAuth.getAccessToken.mockReturnValue(null)
    getByTestId('logout').click()

    await waitFor(() =>
      expect(mockedEmitState).toHaveBeenCalledWith('anonymous', 'explicit_logout'),
    )
    // No NEW identity emission after logout — the authenticated emission
    // (with '123') remains the only one; anonymous never re-emits identity.
    expect(mockedEmitIdentity).toHaveBeenCalledTimes(1)
  })

  it('emits anonymous + passive_loss on passive session expiry (refresh failure)', async () => {
    mockedAuth.getAccessToken.mockReturnValue('mock-token')
    mockedApiClient.getCurrentUserProfile.mockResolvedValue({
      id: 123,
      name: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(
      <UserProvider>
        <SessionProbe />
      </UserProvider>,
    )

    await waitFor(() => expect(mockedEmitState).toHaveBeenCalledWith('authenticated'))

    // Passive session loss: apiClient dispatches the session-expired event
    // after an irrecoverable refresh failure; the cleanup must carry the
    // passive_loss discriminator (automatic reconnect stays permitted).
    mockedAuth.getAccessToken.mockReturnValue(null)
    await act(async () => {
      handleSessionExpired()
    })

    await waitFor(() =>
      expect(mockedEmitState).toHaveBeenCalledWith('anonymous', 'passive_loss'),
    )
  })
})