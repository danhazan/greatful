import {
  assertNoSnakeCaseInTest,
  hasSnakeCaseKeys,
  validateCamelCase
} from '@/utils/contractAssertion'

describe('contractAssertion utilities', () => {
  it('detects snake_case keys recursively', () => {
    const payload = {
      createdAt: '2026-01-01',
      user: {
        profile_image_url: 'https://example.com/a.jpg'
      },
      items: [{ post_id: '1' }]
    }

    const keys = hasSnakeCaseKeys(payload)
    expect(keys).toEqual(expect.arrayContaining(['profile_image_url', 'post_id']))
  })

  it('validates camelCase payloads', () => {
    const payload = {
      createdAt: '2026-01-01',
      user: { profileImageUrl: 'https://example.com/a.jpg' }
    }

    expect(validateCamelCase(payload)).toBe(true)
    expect(() => assertNoSnakeCaseInTest(payload, 'CamelPayload')).not.toThrow()
  })

  it('throws on snake_case payloads in strict mode', () => {
    const payload = {
      access_token: 'token-123',
      user: { displayName: 'Alice' }
    }

    expect(() => assertNoSnakeCaseInTest(payload, 'AuthPayload')).toThrow(
      /Contract violation in AuthPayload/
    )
  })
})
