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
  title: string
  message: string
  read: boolean
  read_at?: string
  post_id?: string
  related_user_id?: number
  emoji_code?: EmojiCode
  data?: NotificationData
  
  // Batching fields
  is_batch: boolean
  batch_count: number
  batch_types?: NotificationType[]  // Multiple types in batch (future enhancement)
  parent_id?: string
  batch_key?: string
  last_updated_at?: string
  
  // Enhanced features (planned)
  links?: NotificationLink[]
  clickable_elements?: ClickableElements
  from_users?: NotificationUser[]  // Multiple users for batches
  primary_user?: NotificationUser  // Primary user for display
  theme_data?: NotificationThemeData
  
  // Relations
  user?: UserInfo
  related_user?: UserInfo
  post?: Post
}

// Enhanced notification data structure
export interface NotificationData {
  post_id?: string
  user_id?: number
  username?: string
  display_name?: string
  emoji_code?: EmojiCode
  share_method?: ShareMethod
  reactor_username?: string
  author_username?: string
  liker_username?: string
  follower_username?: string
  sharer_username?: string
  post_preview?: string
  message_content?: string
  
  // New actor fields for proper user profile navigation
  actor_user_id?: string  // Canonical user ID for navigation
  actor_username?: string // Username for display
  
  // Enhanced data (planned)
  links?: NotificationLink[]
  user_data?: NotificationUser
  batch_metadata?: BatchMetadata
  performance_data?: PerformanceData
}

// Notification link interface (planned enhancement)
export interface NotificationLink {
  type: 'post' | 'user' | 'external'
  url: string
  text: string
  metadata?: Record<string, any>
}

// Clickable elements interface (planned enhancement)
export interface ClickableElements {
  usernames: string[]
  post_content: boolean
  custom_links?: NotificationLink[]
}

// Enhanced notification user interface (planned enhancement)
export interface NotificationUser {
  id: number
  username: string
  display_name?: string
  profile_image_url?: string
  profile_photo_filename?: string
}

// Notification theme data interface (planned enhancement)
export interface NotificationThemeData {
  primary_color?: string
  accent_color?: string
  icon_type?: 'heart' | 'reaction' | 'share' | 'mention' | 'follow'
  custom_styling?: Record<string, any>
}

// Batch metadata interface (planned enhancement)
export interface BatchMetadata {
  types: NotificationType[]
  post_ids: string[]
  user_ids: number[]
  time_range: {
    start: string
    end: string
  }
  summary_data: Record<string, any>
}

// Performance data interface (planned enhancement)
export interface PerformanceData {
  creation_time?: number
  processing_time?: number
  delivery_time?: number
  cache_hit?: boolean
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