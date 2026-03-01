import { toAbsoluteImageUrl } from '@/utils/userDataMapping'

const IMAGE_FIELDS = new Set([
  'profileImageUrl',
  'profile_image_url',
  'image',
  'imageUrl',
  'image_url',
  'thumbnailUrl',
  'thumbnail_url',
  'mediumUrl',
  'medium_url',
  'originalUrl',
  'original_url',
  'avatarUrl',
  'avatar_url',
])

export function normalizeImageUrls<T = any>(payload: T): T {
  if (payload === null || payload === undefined) {
    return payload
  }

  if (Array.isArray(payload)) {
    return payload.map(normalizeImageUrls) as T
  }

  if (typeof payload !== 'object') {
    return payload
  }

  const input = payload as Record<string, unknown>
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && IMAGE_FIELDS.has(key)) {
      output[key] = toAbsoluteImageUrl(value)
      continue
    }
    output[key] = normalizeImageUrls(value)
  }

  return output as T
}
