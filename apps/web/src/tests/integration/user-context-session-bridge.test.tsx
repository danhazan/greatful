import React from 'react'
import { render, waitFor } from '@testing-library/react'
import {
  UserProvider,
  useUser,
  resetCurrentUserBootstrapForTests,
} from '@/contexts/UserContext'
import { apiClient } from '@/utils/apiClient'
import * as auth from '@/utils/auth'
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

  it('emits SESSION_STATE=anonymous when no credential exists', async () => {
    mockedAuth.getAccessToken.mockReturnValue(null)

    render(
      <UserProvider>
        <SessionProbe />
      </UserProvider>,
    )

    await waitFor(() => expect(mockedEmitState).toHaveBeenCalledWith('anonymous'))
    expect(mockedEmitIdentity).not.toHaveBeenCalled()
  })

  it('clears identity on logout — anonymous state never exposes stale identity', async () => {
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

    // Explicit logout: token removed + currentUser null -> anonymous
    mockedAuth.getAccessToken.mockReturnValue(null)
    getByTestId('logout').click()

    await waitFor(() => expect(mockedEmitState).toHaveBeenCalledWith('anonymous'))
    // No NEW identity emission after logout — the authenticated emission
    // (with '123') remains the only one; anonymous never re-emits identity.
    expect(mockedEmitIdentity).toHaveBeenCalledTimes(1)
  })
})