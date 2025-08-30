/**
 * Database model type definitions
 */

import { 
  BaseEntity, 
  UserInfo, 
  ExtendedUserInfo,
  Institution,
  Website,
  UserPreferences,
  NotificationSettings,
  PostType, 
  EmojiCode, 
  NotificationType, 
  ShareMethod, 
  FollowStatus, 
  PrivacyLevel 
} from './core'

// User model
export interface User {
  id: number
  created_at: string
  updated_at?: string
  username: string
  email: string
  hashed_password: string
  bio?: string
  profile_image_url?: string
}

// Enhanced user model with new profile fields
export interface ExtendedUser extends User {
  display_name?: string
  city?: string
  institutions?: Institution[]
  websites?: Website[]
  profile_photo_filename?: string
  profile_preferences?: UserPreferences
}

// Profile photo model
export interface ProfilePhoto extends BaseEntity {
  user_id: number
  filename: string
  original_filename: string
  file_size: number
  content_type: string
  width?: number
  height?: number
  user?: UserInfo
}

// Post model
export interface Post extends BaseEntity {
  author_id: number
  title?: string
  content: string
  post_type: PostType
  image_url?: string
  is_public: boolean
  author?: UserInfo
}

// Emoji reaction model
export interface EmojiReaction extends BaseEntity {
  user_id: number
  post_id: string
  emoji_code: EmojiCode
  user?: UserInfo
  post?: Post
}

// Like/Heart model
export interface Like extends BaseEntity {
  user_id: number
  post_id: string
  user?: UserInfo
  post?: Post
}

// Notification model
export interface Notification extends BaseEntity {
  user_id: number
  type: NotificationType
  message: string
  read: boolean
  post_id?: string
  related_user_id?: number
  emoji_code?: EmojiCode
  data?: Record<string, any>
  
  // Batching fields
  is_batch: boolean
  batch_count: number
  parent_id?: string
  last_updated_at?: string
  
  // Relations
  user?: UserInfo
  related_user?: UserInfo
  post?: Post
}

// Share model
export interface Share extends BaseEntity {
  user_id: number
  post_id: string
  share_method: ShareMethod
  recipient_user_ids?: number[]
  message_content?: string
  user?: UserInfo
  post?: Post
}

// Mention model
export interface Mention extends BaseEntity {
  post_id: string
  author_id: number
  mentioned_user_id: number
  post?: Post
  author?: UserInfo
  mentioned_user?: UserInfo
}

// Follow model
export interface Follow extends BaseEntity {
  follower_id: number
  followed_id: number
  status: FollowStatus
  follower?: UserInfo
  followed?: UserInfo
}

// User preferences model
export interface UserPreference {
  user_id: number
  allow_mentions: boolean
  allow_sharing: boolean
  privacy_level: PrivacyLevel
  notification_settings: Record<string, any>
  updated_at: string
}

// Database query filters
export interface PostFilters {
  author_id?: number
  post_type?: PostType
  is_public?: boolean
  created_after?: string
  created_before?: string
  has_image?: boolean
}

export interface NotificationFilters {
  user_id: number
  type?: NotificationType
  read?: boolean
  created_after?: string
  created_before?: string
  is_batch?: boolean
  parent_id?: string
}

export interface ReactionFilters {
  post_id?: string
  user_id?: number
  emoji_code?: EmojiCode
  created_after?: string
  created_before?: string
}

export interface FollowFilters {
  follower_id?: number
  followed_id?: number
  status?: FollowStatus
  created_after?: string
  created_before?: string
}

// Pagination parameters
export interface PaginationParams {
  limit?: number
  offset?: number
  cursor?: string
}

// Sorting parameters
export interface SortParams {
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// Query parameters combining filters, pagination, and sorting
export interface QueryParams extends PaginationParams, SortParams {
  filters?: Record<string, any>
}