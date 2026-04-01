/**
 * @jest-environment node
 */

import { handleUserProfilePutRequest } from '@/lib/user-profile-api'
import { proxyApiRequest } from '@/lib/api-proxy'

jest.mock('@/lib/api-proxy', () => ({
  proxyApiRequest: jest.fn()
}))

describe('handleUserProfilePutRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(proxyApiRequest as jest.Mock).mockResolvedValue({
      status: 200
    })
  })

  it('transforms camelCase profile payload to snake_case before proxying', async () => {
    const request = new Request('http://localhost:3000/api/users/me/profile', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        displayName: 'Updated Name',
        locationData: {
          displayName: 'Barcelona, Spain',
          lat: 1,
          lon: 2
        },
        websites: ['https://example.com']
      })
    })

    await handleUserProfilePutRequest(request)

    const proxiedRequest = (proxyApiRequest as jest.Mock).mock.calls[0][0] as Request
    const proxiedBody = await proxiedRequest.json()

    expect((proxyApiRequest as jest.Mock).mock.calls[0][1]).toBe('/api/v1/users/me/profile')
    expect(proxiedBody).toEqual({
      display_name: 'Updated Name',
      location_data: {
        display_name: 'Barcelona, Spain',
        lat: 1,
        lon: 2
      },
      websites: ['https://example.com']
    })
  })
})
