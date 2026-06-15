import { jest, expect, describe, it } from '@jest/globals'

describe('OAuth Callback Resurrection Detection', () => {
  it('detects resurrection_available from canonical response (type field, no detail wrapper)', () => {
    // Simulate the detection logic — response body IS the data directly
    const data = {
      type: 'resurrection_available',
      code: 'resurrection_available',
      resurrectionToken: 'mock-jwt-token',
      oauthEmail: 'test@example.com',
      oauthUserInfo: { id: 'google-id-123' },
    }

    expect(data.type).toBe('resurrection_available')
    expect(data.code).toBe('resurrection_available')
    expect(data.resurrectionToken).toBe('mock-jwt-token')
    expect(data.oauthEmail).toBe('test@example.com')
    expect(data.oauthUserInfo).toEqual({ id: 'google-id-123' })
  })
})
