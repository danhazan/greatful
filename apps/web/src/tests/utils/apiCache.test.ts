import { apiCache, resetGlobalInFlightGetRequestsForTests, userProfileCache } from '@/utils/apiCache'

describe('APICache global GET deduplication', () => {
  afterEach(() => {
    apiCache.clear()
    userProfileCache.clear()
    resetGlobalInFlightGetRequestsForTests()
    jest.restoreAllMocks()
    delete (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch
  })

  it('deduplicates identical GET requests across cache instances', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 123 } }),
    } as Response)
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch

    const [first, second] = await Promise.all([
      apiCache.fetch('/api/users/me/profile', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      }),
      userProfileCache.fetch('/api/users/me/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      }),
    ])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ success: true, data: { id: 123 } })
    expect(second).toEqual({ success: true, data: { id: 123 } })
  })
})
