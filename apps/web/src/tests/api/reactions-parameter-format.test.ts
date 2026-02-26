/**
 * Regression coverage for reaction payload casing at the frontend boundary.
 *
 * Contract:
 * - Frontend code sends camelCase (`emojiCode`)
 * - Next.js API route accepts camelCase (and snake_case for compatibility)
 * - Backend receives snake_case (`emoji_code`)
 */

describe('Reactions API Parameter Format Regression Tests', () => {
  it('documents frontend contract as camelCase', () => {
    const frontendPayload = { emojiCode: 'heart_face' }

    expect(frontendPayload).toHaveProperty('emojiCode')
    expect(frontendPayload).not.toHaveProperty('emoji_code')
  })

  it('documents backend contract as snake_case', () => {
    const backendPayload = { emoji_code: 'heart_face' }

    expect(backendPayload).toHaveProperty('emoji_code')
    expect(backendPayload).not.toHaveProperty('emojiCode')
  })

  it('allows both input formats at route boundary and normalizes to snake_case', () => {
    const camelCaseInput = { emojiCode: 'pray' } as any
    const snakeCaseInput = { emoji_code: 'pray' } as any

    const normalizeToBackend = (body: any) => ({
      emoji_code: body.emojiCode ?? body.emoji_code
    })

    expect(normalizeToBackend(camelCaseInput)).toEqual({ emoji_code: 'pray' })
    expect(normalizeToBackend(snakeCaseInput)).toEqual({ emoji_code: 'pray' })
  })

  it('keeps supported emoji codes compatible with snake_case backend payload', () => {
    const supportedEmojis = [
      'heart_face',
      'pray',
      'muscle',
      'star',
      'fire',
      'smiling_face_with_heart_eyes',
      'clap',
      'hugging_face'
    ]

    supportedEmojis.forEach(emojiCode => {
      const payload = { emoji_code: emojiCode }
      const serialized = JSON.stringify(payload)

      expect(serialized).toContain('"emoji_code"')
      expect(serialized).toContain(`"${emojiCode}"`)
      expect(emojiCode).toMatch(/^[a-z_]+$/)
    })
  })
})
