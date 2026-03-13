export type PostPrivacyLevel = 'public' | 'private' | 'custom'
export type PostPrivacyRule = 'followers' | 'following' | 'specific_users'
export type PostPrivacyIconKind = 'public' | 'private' | 'custom'

export interface PostAudienceInput {
  privacyLevel?: string | null
  privacyRules?: string[] | null
  specificUsers?: number[] | null
  specificUsersCount?: number
}

export interface PostAudienceDisplay {
  label: string
  ariaLabel: string
  iconKind: PostPrivacyIconKind
}

function pluralizeUsers(count: number): string {
  return `${count} User${count === 1 ? '' : 's'}`
}

export function getPostPrivacyRuleFlags(input: PostAudienceInput): {
  privacyLevel: PostPrivacyLevel
  includesFollowers: boolean
  includesFollowing: boolean
  includesSpecificUsers: boolean
  specificCount: number
} {
  const privacyLevel = (input.privacyLevel || 'public').toLowerCase() as PostPrivacyLevel
  const rawRules = Array.isArray(input.privacyRules) ? input.privacyRules : []
  const normalizedRules = rawRules.map((rule) => String(rule).trim().toLowerCase())
  const specificCount = typeof input.specificUsersCount === 'number'
    ? input.specificUsersCount
    : Array.isArray(input.specificUsers)
      ? input.specificUsers.length
      : 0

  return {
    privacyLevel,
    includesFollowers: normalizedRules.includes('followers'),
    includesFollowing: normalizedRules.includes('following'),
    includesSpecificUsers: normalizedRules.includes('specific_users') || specificCount > 0,
    specificCount,
  }
}

export function getPostAudience(input: PostAudienceInput): PostAudienceDisplay {
  const {
    privacyLevel,
    includesFollowers,
    includesFollowing,
    includesSpecificUsers,
    specificCount,
  } = getPostPrivacyRuleFlags(input)

  if (privacyLevel === 'public') {
    return { label: 'Public', ariaLabel: 'Public', iconKind: 'public' }
  }

  if (privacyLevel === 'private') {
    return { label: 'Private', ariaLabel: 'Private', iconKind: 'private' }
  }

  const parts: string[] = []

  if (includesFollowers) parts.push('Followers')
  if (includesFollowing) parts.push('Following')
  if (includesSpecificUsers) parts.push(pluralizeUsers(specificCount))

  const label = parts.length > 0 ? parts.join(' + ') : 'Custom'
  const ariaLabel = parts.length > 0 ? parts.join(' and ') : 'Custom audience'

  return {
    label,
    ariaLabel,
    iconKind: 'custom',
  }
}
