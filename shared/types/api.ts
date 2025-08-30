/**
 * API contract type definitions for all endpoints
 */

import { 
  User, 
  Post, 
  EmojiReaction, 
  Like, 
  Notification, 
  Share, 
  Mention, 
  Follow,
  UserPreference,
  PaginationParams,
  QueryParams
} from './models'
import { 
  UserInfo, 
  ExtendedUserInfo,
  Institution,
  Website,
  UserPreferences,
  NotificationSettings,
  PostType, 
  EmojiCode, 
  ShareMethod, 
  FollowStatus,
  PrivacyLevel
} from './core'

// ============================================================================
// Authentication API
// ============================================================================

export interface SignupRequest {
  username: string
  email: string
  password: string
}

export interface SignupResponse {
  id: number
  email: string
  username: string
  access_token: string
  token_type: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface SessionResponse {
  id: number
  email: string
  username: string
}

// ============================================================================
// Posts API
// ============================================================================

export interface CreatePostRequest {
  content: string
  post_type: PostType
  title?: string
  image_url?: string
  location?: string
  is_public?: boolean
}

export interface PostResponse {
  id: string
  author_id: number
  title?: string
  content: string
  post_type: PostType
  image_url?: string
  location?: string
  is_public: boolean
  created_at: string
  updated_at?: string
  author: UserInfo
  hearts_count: number
  reactions_count: number
  current_user_reaction?: EmojiCode
  is_hearted?: boolean
}

export interface GetFeedRequest extends PaginationParams {
  // Additional feed-specific filters can be added here
}

export interface GetFeedResponse {
  posts: PostResponse[]
  total_count: number
  has_more: boolean
}

// ============================================================================
// Reactions API
// ============================================================================

export interface AddReactionRequest {
  emoji_code: EmojiCode
}

export interface ReactionResponse {
  id: string
  user_id: number
  post_id: string
  emoji_code: EmojiCode
  emoji_display: string
  created_at: string
  user: UserInfo
}

export interface ReactionSummaryResponse {
  total_count: number
  emoji_counts: Record<EmojiCode, number>
  user_reaction?: EmojiCode
}

export interface GetPostReactionsResponse {
  reactions: ReactionResponse[]
  total_count: number
}

// ============================================================================
// Likes/Hearts API
// ============================================================================

export interface LikeResponse {
  id: string
  user_id: number
  post_id: string
  created_at: string
  user: UserInfo
}

export interface GetPostLikesResponse {
  likes: LikeResponse[]
  total_count: number
}

// ============================================================================
// Notifications API
// ============================================================================

export interface NotificationResponse {
  id: string
  user_id: number
  type: string
  message: string
  read: boolean
  post_id?: string
  related_user_id?: number
  emoji_code?: EmojiCode
  created_at: string
  last_updated_at?: string
  
  // Batching fields
  is_batch: boolean
  batch_count: number
  parent_id?: string
  
  // Relations
  related_user?: UserInfo
  post?: PostResponse
}

export interface GetNotificationsRequest extends PaginationParams {
  type?: string
  read?: boolean
}

export interface GetNotificationsResponse {
  notifications: NotificationResponse[]
  unread_count: number
  total_count: number
  has_more: boolean
}

export interface MarkNotificationsReadRequest {
  notification_ids: string[]
}

export interface MarkNotificationsReadResponse {
  marked_count: number
}

export interface GetNotificationChildrenResponse {
  children: NotificationResponse[]
  total_count: number
}

// ============================================================================
// Shares API
// ============================================================================

export interface SharePostRequest {
  share_method: ShareMethod
  recipient_user_ids?: number[]
  message_content?: string
}

export interface ShareResponse {
  id: string
  user_id: number
  post_id: string
  share_method: ShareMethod
  recipient_user_ids?: number[]
  message_content?: string
  created_at: string
  share_url?: string
}

export interface GetShareAnalyticsResponse {
  total_shares: number
  shares_by_method: Record<ShareMethod, number>
  recent_shares: ShareResponse[]
}

// ============================================================================
// Mentions API
// ============================================================================

export interface SearchUsersRequest {
  query: string
  limit?: number
  exclude_user_ids?: number[]
}

export interface SearchUsersResponse {
  users: UserInfo[]
  total_count: number
}

export interface ExtractMentionsRequest {
  content: string
}

export interface ExtractMentionsResponse {
  mentions: string[]
  mentioned_users: UserInfo[]
}

// ============================================================================
// Follows API
// ============================================================================

export interface FollowUserResponse {
  id: string
  follower_id: number
  followed_id: number
  status: FollowStatus
  created_at: string
  followed_user: UserInfo
}

export interface GetFollowersRequest extends PaginationParams {
  user_id: number
}

export interface GetFollowersResponse {
  followers: UserInfo[]
  total_count: number
  has_more: boolean
}

export interface GetFollowingRequest extends PaginationParams {
  user_id: number
}

export interface GetFollowingResponse {
  following: UserInfo[]
  total_count: number
  has_more: boolean
}

export interface GetFollowStatusResponse {
  is_following: boolean
  follow_status?: FollowStatus
  is_followed_by: boolean
}

// ============================================================================
// Users API
// ============================================================================

export interface UpdateProfileRequest {
  username?: string
  bio?: string
  profile_image_url?: string
}

export interface ExtendedProfileUpdateRequest {
  display_name?: string
  city?: string
  institutions?: Institution[]
  websites?: Website[]
}

export interface ProfileResponse {
  id: number
  username: string
  email: string
  bio?: string
  profile_image_url?: string
  created_at: string
  
  // Stats
  posts_count: number
  followers_count: number
  following_count: number
  
  // Current user's relationship to this profile
  is_following?: boolean
  is_followed_by?: boolean
}

export interface ExtendedProfileResponse extends ProfileResponse {
  display_name?: string
  city?: string
  institutions?: Institution[]
  websites?: Website[]
  profile_photo_filename?: string
  profile_preferences?: UserPreferences
  
  // Analytics (only for own profile)
  profile_views?: number
  profile_views_this_month?: number
}

export interface GetUserPostsRequest extends PaginationParams {
  user_id: number
  post_type?: PostType
}

export interface GetUserPostsResponse {
  posts: PostResponse[]
  total_count: number
  has_more: boolean
}

// ============================================================================
// Profile Photo API
// ============================================================================

export interface ProfilePhotoUploadRequest {
  file: File | Blob
}

export interface ProfilePhotoResponse {
  id: string
  user_id: number
  filename: string
  original_filename: string
  file_size: number
  content_type: string
  width?: number
  height?: number
  created_at: string
  urls: {
    thumbnail: string
    small: string
    medium: string
    large: string
    original: string
  }
}

export interface ProfilePhotoDeleteResponse {
  deleted: boolean
  message: string
}

// ============================================================================
// User Preferences API
// ============================================================================

export interface UpdatePreferencesRequest {
  allow_mentions?: boolean
  allow_sharing?: boolean
  privacy_level?: PrivacyLevel
  profile_visibility?: PrivacyLevel
  show_email?: boolean
  show_join_date?: boolean
  show_stats?: boolean
  notification_settings?: NotificationSettings
}

export interface PreferencesResponse {
  user_id: number
  allow_mentions: boolean
  allow_sharing: boolean
  privacy_level: PrivacyLevel
  profile_visibility: PrivacyLevel
  show_email: boolean
  show_join_date: boolean
  show_stats: boolean
  notification_settings: NotificationSettings
  updated_at: string
}

// ============================================================================
// Profile Analytics API
// ============================================================================

export interface ProfileAnalyticsResponse {
  user_id: number
  profile_views: number
  profile_views_this_week: number
  profile_views_this_month: number
  profile_completion_percentage: number
  engagement_stats: {
    posts_count: number
    total_hearts: number
    total_reactions: number
    total_shares: number
    avg_engagement_per_post: number
  }
  follower_growth: {
    current_followers: number
    followers_this_week: number
    followers_this_month: number
    growth_rate: number
  }
}

// ============================================================================
// Analytics API
// ============================================================================

export interface AnalyticsEventRequest {
  event_type: string
  event_data: Record<string, any>
  timestamp?: string
}

export interface AnalyticsEventResponse {
  event_id: string
  recorded_at: string
}

// ============================================================================
// Upload API
// ============================================================================

export interface UploadImageRequest {
  file: File | Blob
  type: 'profile' | 'post'
}

export interface UploadImageResponse {
  url: string
  filename: string
  size: number
  content_type: string
}

// ============================================================================
// Generic API Response Wrappers
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  total_count: number
  limit: number
  offset: number
  has_more: boolean
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  timestamp: string
  request_id?: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
  timestamp: string
  request_id?: string
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse