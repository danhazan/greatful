import { describe, expect, it } from '@jest/globals'
import { getPostAudience } from '@/utils/privacyUtils'

describe('privacyUtils.getPostAudience', () => {
  it('returns public mapping', () => {
    const result = getPostAudience({ privacyLevel: 'public' })
    expect(result).toEqual({
      label: 'Public',
      ariaLabel: 'Public',
      iconKind: 'public',
    })
  })

  it('returns private mapping', () => {
    const result = getPostAudience({ privacyLevel: 'private' })
    expect(result).toEqual({
      label: 'Private',
      ariaLabel: 'Private',
      iconKind: 'private',
    })
  })

  it('keeps custom icon and computes combined label', () => {
    const result = getPostAudience({
      privacyLevel: 'custom',
      privacyRules: ['followers', 'following', 'specific_users'],
      specificUsersCount: 2,
    })
    expect(result.iconKind).toBe('custom')
    expect(result.label).toBe('Followers + Following + 2 specific users')
  })

  it('supports specific users only custom audience', () => {
    const result = getPostAudience({
      privacyLevel: 'custom',
      privacyRules: ['specific_users'],
      specificUsersCount: 3,
    })
    expect(result.iconKind).toBe('custom')
    expect(result.label).toBe('3 specific users')
  })
})

