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

function pluralizeSpecificUsers(count: number): string {
  return `${count} specific user${count === 1 ? '' : 's'}`
}

export function getPostAudience(input: PostAudienceInput): PostAudienceDisplay {
  const privacyLevel = (input.privacyLevel || 'public').toLowerCase() as PostPrivacyLevel
  const rawRules = Array.isArray(input.privacyRules) ? input.privacyRules : []
  const normalizedRules = rawRules.map((rule) => String(rule).trim().toLowerCase())
  const specificCount = typeof input.specificUsersCount === 'number'
    ? input.specificUsersCount
    : Array.isArray(input.specificUsers)
      ? input.specificUsers.length
      : 0

  if (privacyLevel === 'public') {
    return { label: 'Public', ariaLabel: 'Public', iconKind: 'public' }
  }

  if (privacyLevel === 'private') {
    return { label: 'Private', ariaLabel: 'Private', iconKind: 'private' }
  }

  const includesFollowers = normalizedRules.includes('followers')
  const includesFollowing = normalizedRules.includes('following')
  const includesSpecificUsers = normalizedRules.includes('specific_users') || specificCount > 0
  const parts: string[] = []

  if (includesFollowers) parts.push('Followers')
  if (includesFollowing) parts.push('Following')
  if (includesSpecificUsers) parts.push(pluralizeSpecificUsers(specificCount))

  const label = parts.length > 0 ? parts.join(' + ') : 'Custom'
  const ariaLabel = parts.length > 0 ? parts.join(' and ') : 'Custom audience'

  return {
    label,
    ariaLabel,
    iconKind: 'custom',
  }
}

