/**
 * Core shared types used throughout the application
 */

// Base entity interface
export interface BaseEntity {
  id: string
  created_at: string
  updated_at?: string
}

// User identification
export interface UserIdentity {
  id: number
  username: string
  email: string
}

// Extended user info
export interface UserInfo extends UserIdentity {
  bio?: string
  profile_image_url?: string
  created_at: string
}

// Post types enum
export enum PostType {
  DAILY = 'daily',
  PHOTO = 'photo',
  SPONTANEOUS = 'spontaneous'
}

// Post type character limits
export const POST_TYPE_LIMITS: Record<PostType, number> = {
  [PostType.DAILY]: 500,
  [PostType.PHOTO]: 300,
  [PostType.SPONTANEOUS]: 200
}

// Notification types
export enum NotificationType {
  EMOJI_REACTION = 'emoji_reaction',
  POST_SHARED = 'post_shared',
  MENTION = 'mention',
  NEW_FOLLOWER = 'new_follower',
  SHARE_MILESTONE = 'share_milestone',
  HEART = 'heart'
}

// Valid emoji codes for reactions
export enum EmojiCode {
  HEART_EYES = 'heart_eyes',
  HUG = 'hug',
  PRAY = 'pray',
  MUSCLE = 'muscle',
  STAR = 'star',
  FIRE = 'fire',
  HEART_FACE = 'heart_face',
  CLAP = 'clap'
}

// Emoji display mapping
export const EMOJI_DISPLAY: Record<EmojiCode, string> = {
  [EmojiCode.HEART_EYES]: '😍',
  [EmojiCode.HUG]: '🤗',
  [EmojiCode.PRAY]: '🙏',
  [EmojiCode.MUSCLE]: '💪',
  [EmojiCode.STAR]: '⭐',
  [EmojiCode.FIRE]: '🔥',
  [EmojiCode.HEART_FACE]: '🥰',
  [EmojiCode.CLAP]: '👏'
}

// Share methods
export enum ShareMethod {
  URL = 'url',
  MESSAGE = 'message'
}

// Follow status
export enum FollowStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  BLOCKED = 'blocked'
}

// Privacy levels
export enum PrivacyLevel {
  PUBLIC = 'public',
  FOLLOWERS = 'followers',
  PRIVATE = 'private'
}

// Rate limiting constants
export const RATE_LIMITS = {
  SHARES_PER_HOUR: 20,
  NOTIFICATIONS_PER_HOUR: 5,
  MENTIONS_PER_POST: 10,
  SHARE_RECIPIENTS_MAX: 5
} as const

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  LIMIT: 20,
  MAX_LIMIT: 100,
  OFFSET: 0
} as const