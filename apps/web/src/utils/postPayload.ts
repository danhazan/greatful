import { PostStyle } from '@/types/post'

type PrivacyLevel = 'public' | 'private' | 'custom'

export type PostPayloadMode = 'create' | 'edit'

export interface BuildPostPayloadInput {
  content: string
  richContent?: string | null
  postStyle?: PostStyle | null
  location?: string | null
  locationData?: any | null
  mentions?: string[]
  imageUrl?: string
  imageFile?: File
  imageFiles?: File[]
  privacyLevel?: PrivacyLevel
  privacyRules?: string[]
  specificUsers?: number[]
}

const ALLOWED_STYLE_KEYS = new Set([
  'id',
  'name',
  'backgroundColor',
  'backgroundGradient',
  'backgroundImage',
  'backgroundOpacity',
  'backgroundBlendMode',
])

export function sanitizePostStyleForApi(style?: PostStyle | null): PostStyle | null {
  if (!style || typeof style !== 'object') return null

  const { id, name, backgroundColor } = style
  if (typeof id !== 'string' || !id.trim()) return null
  if (typeof name !== 'string' || !name.trim()) return null
  if (typeof backgroundColor !== 'string' || !backgroundColor.trim()) return null

  const sanitized: Record<string, any> = {}
  for (const key of Object.keys(style)) {
    if (ALLOWED_STYLE_KEYS.has(key)) {
      sanitized[key] = (style as any)[key]
    }
  }

  return sanitized as PostStyle
}

export function buildPostPayload(input: BuildPostPayloadInput, mode: PostPayloadMode) {
  const payload: Record<string, any> = {
    content: input.content,
  }

  if (input.richContent !== undefined) {
    payload.richContent = input.richContent ?? null
  }

  const sanitizedStyle = sanitizePostStyleForApi(input.postStyle)
  if (sanitizedStyle) {
    payload.postStyle = sanitizedStyle
  }

  const privacyLevel: PrivacyLevel = input.privacyLevel ?? 'public'
  const privacyRules = Array.isArray(input.privacyRules) ? input.privacyRules : []
  const specificUsers = Array.isArray(input.specificUsers) ? input.specificUsers : []
  const isCustom = privacyLevel === 'custom'

  if (mode === 'edit') {
    payload.privacyLevel = privacyLevel
    payload.privacyRules = isCustom ? privacyRules : []
    payload.specificUsers = isCustom ? specificUsers : []
    payload.location = input.location ? input.location : null
    payload.locationData = input.locationData ? input.locationData : null
    return payload
  }

  // create mode
  payload.privacyLevel = privacyLevel
  if (isCustom) {
    payload.privacyRules = privacyRules
    payload.specificUsers = specificUsers
  }

  if (input.location) {
    payload.location = input.location
  }
  if (input.locationData) {
    payload.locationData = input.locationData
  }
  if (input.mentions && input.mentions.length > 0) {
    payload.mentions = input.mentions
  }
  if (input.imageFiles && input.imageFiles.length > 0) {
    payload.imageFiles = input.imageFiles
  }
  if (input.imageFile) {
    payload.imageFile = input.imageFile
  }
  if (input.imageUrl) {
    payload.imageUrl = input.imageUrl
  }

  return payload
}
